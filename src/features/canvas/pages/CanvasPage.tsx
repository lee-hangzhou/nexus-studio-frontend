import '@xyflow/react/dist/style.css';
import '../styles/workflow-canvas.entry.less';

import { ReactFlowProvider, type OnNodeDrag, type OnNodesChange } from '@xyflow/react';
import { message } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getProject, type EpisodeView } from '../../../api/projects';
import type { ToolStepView } from '../../../api/chat';
import { appendToolStepStart, updateToolStepResult } from '../../chat/toolStepUtils';
import {
  cancelCanvasTurn,
  createCanvasSession,
  deleteCanvasSession,
  ensureCanvasDefaultSession,
  listCanvasSessions,
  reconnectCanvasTurnWithReplay,
  resumeCanvasTurn,
  streamCanvasEpisodeEvents,
  streamCanvasTurn,
  submitCanvasNodeGenerate,
  updateCanvasSession,
} from '../api/canvas';
import { CANVAS_API_CODE, isCanvasApiError } from '../api/canvasErrors';
import type {
  CanvasNodeGenerateResponse,
  CanvasNodeKind,
  CanvasPatchEvent,
  CanvasPatchOpInput,
  CanvasPatchResult,
  CanvasSessionView,
  CanvasStreamFrame,
  NodeGenerateBody,
} from '../api/canvasTypes';
import { buildTurnUserInput, compileHumanTextFromBlocks } from '../../skills/serializeTurnContent';
import type { ToolPendingState } from '../../skills/types';
import { CanvasAgentPanel } from '../components/CanvasAgentPanel';
import { buildTurnId } from '../components/CanvasAgentPanel.utils';
import { CanvasGenerateProvider, type NodeGenerateExtra } from '../context/CanvasGenerateContext';
import { ChatModelCatalogProvider, useChatModelCatalog } from '../context/ChatModelCatalogContext';
import { GenerateModelCatalogProvider } from '../context/GenerateModelCatalogContext';
import { hasResolvedChatModelKey } from '../lib/chatModelKey';
import { CanvasProjectProvider, useCanvasProject } from '../context/CanvasProjectContext';
import { CanvasTaskProvider, useCanvasTask } from '../context/CanvasTaskContext';
import { WorkflowCanvasFlow } from '../flow/WorkflowCanvasFlow';
import { useCanvasGraph } from '../hooks/useCanvasGraph';
import { useCanvasMessages } from '../hooks/useCanvasMessages';
import { useCanvasPatch, type CanvasRevisionSyncResult } from '../hooks/useCanvasPatch';
import { useCanvasGenerationWatch } from '../hooks/useCanvasGenerationWatch';
import { hasResolvedModelId } from '../lib/generateModelId';
import { useGenerateModelCatalog } from '../context/GenerateModelCatalogContext';
import {
  canvasPatchFromFrame,
  canvasSessionTitleFromFrame,
  generationProgressFromFrame,
  type GenerationProgressEvent,
  toolPendingFromFrame,
} from '../lib/streamFrame';
import { DEFAULT_NODE_META } from '../schema/nodeDefaults';
import {
  toFlowEdges,
  toFlowNodes,
  type CanvasFlowEdge,
  type CanvasFlowNode,
} from '../schema/canvasSchema';
import type { NodeChangeInput } from '../storyflow/types';

type SessionUiCache = {
  composer: string;
  selectedSkillPaths: string[];
  mode: 'auto' | 'manual';
  agentModelKey?: string;
  clientTurnId?: string | null;
  requestId?: string | null;
  lastEventId?: string | null;
  toolPending?: ToolPendingState | null;
};

function CanvasPageInner() {
  const navigate = useNavigate();
  const { projectId, episodeId, refetchSnapshot, loading: snapLoading } = useCanvasProject();
  const { pendingNodeIds, setNodePending } = useCanvasTask();
  const modelCatalog = useGenerateModelCatalog();
  const chatModelCatalog = useChatModelCatalog();
  const [projectName, setProjectName] = useState<string | undefined>();
  const [episodeName, setEpisodeName] = useState<string | undefined>();
  const [episodes, setEpisodes] = useState<EpisodeView[]>([]);
  const [mode, setMode] = useState<'auto' | 'manual'>('auto');
  const [agentOpen, setAgentOpen] = useState(true);
  const [agentModelKey, setAgentModelKey] = useState<string | undefined>(undefined);
  const [busySessionIds, setBusySessionIds] = useState<Set<number>>(() => new Set());
  const [composer, setComposer] = useState('');
  const [selectedSkillPaths, setSelectedSkillPaths] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [liveToolSteps, setLiveToolSteps] = useState<ToolStepView[]>([]);
  const [toolPending, setToolPending] = useState<ToolPendingState | null>(null);
  const [resumeLoading, setResumeLoading] = useState(false);
  const [sessions, setSessions] = useState<CanvasSessionView[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [creatingSession, setCreatingSession] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const agentAbortRef = useRef<AbortController | null>(null);
  const eventsAbortRef = useRef<AbortController | null>(null);
  const nodeAbortRef = useRef<Map<string, AbortController>>(new Map());
  const activeTurnRef = useRef<string | null>(null);
  const streamRequestIdRef = useRef<string | null>(null);
  const lastEventIdRef = useRef<string | null>(null);
  const activeSessionIdRef = useRef<number | null>(null);
  /** 切会话掐本地流时记 switch, 避免 finally 误清 busy */
  const streamAbortReasonRef = useRef<Map<number, 'switch' | 'replace'>>(new Map());
  const streamingSessionRef = useRef<number | null>(null);
  const uiBySessionRef = useRef<Map<number, SessionUiCache>>(new Map());
  const graphRef = useRef<{ nodes: CanvasFlowNode[]; edges: CanvasFlowEdge[] }>({ nodes: [], edges: [] });
  const commitOpsRef = useRef<(ops: CanvasPatchOpInput[]) => Promise<CanvasPatchResult | null>>(
    async () => null,
  );
  const applyResultRef = useRef<((result: CanvasPatchResult | CanvasPatchEvent) => void) | null>(null);
  const applyNodeProgressRef = useRef<((progress: GenerationProgressEvent) => void) | null>(null);
  const replaceGraphQueuedRef = useRef<
    ((nodes: CanvasFlowNode[], edges: CanvasFlowEdge[]) => Promise<CanvasRevisionSyncResult>) | null
  >(null);

  const graph = useCanvasGraph((ops) => commitOpsRef.current(ops));
  const { nodes, edges, setNodes, setEdges, onNodesChange, onEdgesChange, onNodeDragStop } = graph;
  graphRef.current = { nodes, edges };

  const syncCanvasFromServer = useCallback(async () => {
    const snap = await refetchSnapshot();
    if (!snap) return null;
    const nextNodes = toFlowNodes(snap.nodes);
    const nextEdges = toFlowEdges(snap.edges);
    if (replaceGraphQueuedRef.current) {
      return replaceGraphQueuedRef.current(nextNodes, nextEdges);
    }
    setNodes(nextNodes);
    setEdges(nextEdges);
    return { nodes: nextNodes, edges: nextEdges };
  }, [refetchSnapshot, setNodes, setEdges]);

  const { commitOps, applyResult, applyNodeProgress, patchNodeData, replaceGraphQueued } = useCanvasPatch(
    nodes,
    edges,
    setNodes,
    setEdges,
    syncCanvasFromServer,
  );
  commitOpsRef.current = commitOps;
  applyResultRef.current = applyResult;
  applyNodeProgressRef.current = applyNodeProgress;
  replaceGraphQueuedRef.current = replaceGraphQueued;

  // 轮询发现终态后走 replaceGraphQueued 对齐 revision, 不旁路 setNodes
  useCanvasGenerationWatch(nodes, async () => {
    await syncCanvasFromServer();
  });
  const busy = activeSessionId != null && busySessionIds.has(activeSessionId);
  activeSessionIdRef.current = activeSessionId;

  const setSessionBusy = useCallback((sessionId: number, nextBusy: boolean) => {
    setBusySessionIds((prev) => {
      const has = prev.has(sessionId);
      if (nextBusy === has) return prev;
      const copy = new Set(prev);
      if (nextBusy) copy.add(sessionId);
      else copy.delete(sessionId);
      return copy;
    });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setSessionsLoading(true);
    void (async () => {
      try {
        let items = await listCanvasSessions(episodeId);
        if (controller.signal.aborted) return;
        if (items.length === 0) {
          await ensureCanvasDefaultSession(episodeId);
          if (controller.signal.aborted) return;
          items = await listCanvasSessions(episodeId);
        }
        if (controller.signal.aborted) return;
        setSessions(items);
        const defaultSession = items.find((s) => s.is_default) ?? items[0];
        setActiveSessionId(defaultSession?.id ?? null);
      } catch {
        if (controller.signal.aborted) return;
        message.error('加载会话失败');
      } finally {
        if (!controller.signal.aborted) setSessionsLoading(false);
      }
    })();
    return () => controller.abort();
  }, [episodeId]);

  useEffect(() => {
    eventsAbortRef.current?.abort();
    const ac = new AbortController();
    eventsAbortRef.current = ac;
    let attempt = 0;
    let liveSession = false;
    const connect = async () => {
      // 首次进页，或上一轮已成功建流再断线：整图对齐。连不上时的重试不再 snapshot，避免拖线被整图替换打断。
      if (attempt === 0 || liveSession) {
        await syncCanvasFromServer();
        if (ac.signal.aborted) return;
        liveSession = false;
      }
      let opened = false;
      try {
        await streamCanvasEpisodeEvents(
          episodeId,
          (frame) => {
            setEventsError(null);
            try {
              const patch = canvasPatchFromFrame(frame);
              if (patch) applyResultRef.current?.(patch);
            } catch (err) {
              message.error(err instanceof Error ? err.message : '画布增量无效');
            }
            try {
              const progress = generationProgressFromFrame(frame);
              if (progress) applyNodeProgressRef.current?.(progress);
            } catch (err) {
              message.error(err instanceof Error ? err.message : '生成进度无效');
            }
            try {
              const titleEvent = canvasSessionTitleFromFrame(frame);
              if (titleEvent) {
                setSessions((prev) =>
                  prev.map((s) =>
                    s.id === titleEvent.session_id
                      ? {
                          ...s,
                          title: titleEvent.title,
                          ...(titleEvent.updated_at ? { updated_at: titleEvent.updated_at } : {}),
                        }
                      : s,
                  ),
                );
              }
            } catch (err) {
              message.error(err instanceof Error ? err.message : '会话标题无效');
            }
          },
          ac.signal,
          {
            onOpen: () => {
              opened = true;
              liveSession = true;
              setEventsError(null);
            },
          },
        );
        if (ac.signal.aborted) return;
        setEventsError(null);
      } catch (err) {
        if (ac.signal.aborted || (err instanceof Error && err.name === 'AbortError')) return;
        setEventsError(err instanceof Error ? err.message : '画布事件流中断');
        if (!opened) liveSession = false;
      }
      attempt += 1;
      const delayMs = Math.min(800 * 2 ** Math.min(attempt - 1, 4), 8_000);
      await new Promise((r) => setTimeout(r, delayMs));
      if (!ac.signal.aborted) void connect();
    };
    void connect();
    return () => {
      ac.abort();
    };
  }, [episodeId, syncCanvasFromServer]);

  useEffect(() => {
    const controller = new AbortController();
    void getProject(projectId, { signal: controller.signal })
      .then((detail) => {
        if (controller.signal.aborted) return;
        const episode = detail.episodes.find((item) => item.id === episodeId);
        if (!episode) throw new Error('episode not found');
        setProjectName(detail.project.name);
        setEpisodeName(episode.name);
        setEpisodes(detail.episodes);
      })
      .catch((err) => {
        if (controller.signal.aborted || (err instanceof DOMException && err.name === 'AbortError')) return;
        message.error('集不存在或无权访问');
        navigate('/projects', { replace: true });
      });
    return () => controller.abort();
  }, [projectId, episodeId, navigate]);

  useEffect(() => {
    return () => {
      agentAbortRef.current?.abort();
      eventsAbortRef.current?.abort();
      nodeAbortRef.current.forEach((controller) => controller.abort());
      nodeAbortRef.current.clear();
      activeTurnRef.current = null;
      streamRequestIdRef.current = null;
      lastEventIdRef.current = null;
    };
  }, [episodeId]);
  useEffect(() => {
    if (!snapLoading) setLoaded(true);
  }, [snapLoading]);

  const {
    messages,
    loading: messagesLoading,
    loadMessages,
    clearMessages,
    appendUser,
    appendAssistantStream,
    appendAssistantToken,
    finishAssistantStream,
  } = useCanvasMessages(episodeId, activeSessionId);

  useEffect(() => {
    void loadMessages().catch((err) => {
      message.error(err instanceof Error ? err.message : '加载消息失败');
    });
  }, [loadMessages]);

  useEffect(() => {
    if (agentModelKey) return;
    const resolved = chatModelCatalog.resolveModelKey(undefined);
    if (resolved) setAgentModelKey(resolved);
  }, [agentModelKey, chatModelCatalog]);

  const refreshSessions = useCallback(async () => {
    const items = await listCanvasSessions(episodeId);
    setSessions(items);
    return items;
  }, [episodeId]);

  const handleStreamFrame = useCallback(
    (frame: CanvasStreamFrame, clientTurnId: string, sessionId: number) => {
      if (activeSessionIdRef.current !== sessionId) return;
      if (frame.type === 'token' && frame.channel !== 'think' && frame.text) {
        appendAssistantToken(clientTurnId, frame.text);
      }
      if (frame.type === 'tool_start') {
        setLiveToolSteps((steps) =>
          appendToolStepStart(steps, frame.call_id ?? '', frame.name ?? 'tool', frame.args ?? {}),
        );
      }
      if (frame.type === 'tool_end') {
        const preview = frame.ok === false ? `失败: ${frame.preview ?? ''}` : (frame.preview ?? '完成');
        setLiveToolSteps((steps) =>
          updateToolStepResult(steps, frame.call_id ?? '', frame.name ?? 'tool', preview),
        );
      }
      // 图增量 / progress 只吃 episode events, 不从 turn SSE 合并
      const pending = toolPendingFromFrame(frame);
      if (pending) {
        setToolPending(pending);
        const cached = uiBySessionRef.current.get(sessionId);
        if (cached) {
          uiBySessionRef.current.set(sessionId, {
            ...cached,
            toolPending: pending,
          });
        }
      }
      if (frame.type === 'error') message.error(frame.message ?? '执行失败');
      if (frame.type === 'done') {
        finishAssistantStream(clientTurnId);
        setLiveToolSteps([]);
        setToolPending(null);
        void loadMessages().catch(() => undefined);
        void refreshSessions().catch(() => undefined);
      }
      if (frame.type === 'cancelled') {
        finishAssistantStream(clientTurnId);
        setLiveToolSteps([]);
        setToolPending(null);
      }
    },
    [appendAssistantToken, finishAssistantStream, loadMessages, refreshSessions],
  );

  const rememberEventId = useCallback((sessionId: number, eventId: string) => {
    lastEventIdRef.current = eventId;
    const cached = uiBySessionRef.current.get(sessionId);
    if (cached) {
      uiBySessionRef.current.set(sessionId, { ...cached, lastEventId: eventId });
    } else {
      uiBySessionRef.current.set(sessionId, {
        composer: '',
        selectedSkillPaths: [],
        mode: 'auto',
        lastEventId: eventId,
      });
    }
  }, []);

  const turnStreamHooks = useCallback(
    (sessionId: number, signal: AbortSignal, initialLastEventId?: string | null) => ({
      signal,
      lastEventId: initialLastEventId ?? lastEventIdRef.current,
      onEventId: (eventId: string) => rememberEventId(sessionId, eventId),
    }),
    [rememberEventId],
  );

  const runStream = useCallback(
    async (
      sessionId: number,
      runner: (onFrame: (f: CanvasStreamFrame) => void, signal: AbortSignal) => Promise<void>,
    ) => {
      const prevSession = streamingSessionRef.current;
      if (prevSession != null && prevSession !== sessionId) {
        // 不应并行挂两个本地 turn 流; 先前会话若仍在跑应由 switch 标 switch
        if (!streamAbortReasonRef.current.has(prevSession)) {
          streamAbortReasonRef.current.set(prevSession, 'replace');
        }
      } else if (prevSession === sessionId) {
        streamAbortReasonRef.current.set(sessionId, 'replace');
      }
      agentAbortRef.current?.abort();
      const ac = new AbortController();
      agentAbortRef.current = ac;
      streamingSessionRef.current = sessionId;
      setSessionBusy(sessionId, true);
      try {
        await runner(
          (f) => handleStreamFrame(f, activeTurnRef.current ?? '', sessionId),
          ac.signal,
        );
      } catch (err) {
        const reason = streamAbortReasonRef.current.get(sessionId);
        if (ac.signal.aborted && reason === 'switch') {
          return;
        }
        if (err instanceof Error && err.message === 'canvas_session_busy') {
          message.warning('该会话正在执行，请稍后再试');
        } else if (err instanceof Error && err.name !== 'AbortError' && err.message !== 'http_409') {
          message.error(err.message || '请求失败');
        }
      } finally {
        const reason = streamAbortReasonRef.current.get(sessionId);
        streamAbortReasonRef.current.delete(sessionId);
        if (ac.signal.aborted && reason === 'switch') {
          // 切会话掐本地流: 服务端仍在跑, 保持 busy 以便切回重挂
        } else {
          setSessionBusy(sessionId, false);
          const cached = uiBySessionRef.current.get(sessionId);
          if (cached) {
            uiBySessionRef.current.set(sessionId, {
              ...cached,
              requestId: null,
              lastEventId: null,
              clientTurnId: cached.clientTurnId,
              // interrupt 后保留 toolPending, 供 HITL 确认卡继续展示
              toolPending: cached.toolPending ?? null,
            });
          }
          if (activeSessionIdRef.current === sessionId) {
            streamRequestIdRef.current = null;
            lastEventIdRef.current = null;
          }
        }
        if (streamingSessionRef.current === sessionId) streamingSessionRef.current = null;
      }
    },
    [handleStreamFrame, setSessionBusy],
  );

  const setNodeGeneratePending = useCallback(
    (nodeId: string, pending: boolean) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, generatePending: pending } } : n,
        ),
      );
    },
    [setNodes],
  );

  const applyGenerateResult = useCallback(
    (result: CanvasNodeGenerateResponse) => {
      applyResult({
        nodes: [result.node],
        edges: [],
        deleted_node_ids: [],
        deleted_edge_ids: [],
      });
      patchNodeData(result.node_id, { generatePending: false });
    },
    [applyResult, patchNodeData],
  );

  const handleNodeGenerateError = useCallback(
    (err: unknown, nodeId: string) => {
      if (isCanvasApiError(err)) {
        if (err.code === CANVAS_API_CODE.NODE_GENERATION_IN_PROGRESS) {
          message.warning('该节点已有生成任务进行中');
          return;
        }
        if (err.code === CANVAS_API_CODE.REVISION_CONFLICT) {
          void syncCanvasFromServer();
          return;
        }
        if (err.code === CANVAS_API_CODE.SUBMIT_REF_MISMATCH) {
          message.warning('画布引用已变化，正在同步后请重试');
          void syncCanvasFromServer();
          setNodes((nds) =>
            nds.map((n) =>
              n.id === nodeId ? { ...n, data: { ...n.data, generatePending: false } } : n,
            ),
          );
          return;
        }
      }
      message.error(err instanceof Error ? err.message : '生成失败');
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId
            ? { ...n, data: { ...n.data, status: 'failed' as const, generatePending: false } }
            : n,
        ),
      );
    },
    [setNodes, syncCanvasFromServer],
  );

  const sendTurn = useCallback(async () => {
    const text = composer.trim();
    if ((!text && selectedSkillPaths.length === 0) || busy || activeSessionId == null) return;
    if (selectedSkillPaths.length > 0 && !text) {
      message.warning('引用技能后须填写说明文字');
      return;
    }
    const modelKey = chatModelCatalog.resolveModelKey(agentModelKey);
    if (!hasResolvedChatModelKey(modelKey)) {
      message.warning('对话模型不可用，请稍后重试');
      return;
    }
    if (modelKey !== agentModelKey) {
      setAgentModelKey(modelKey);
    }
    const userInput = buildTurnUserInput(text, selectedSkillPaths);
    const content = userInput.content;
    const clientTurnId = buildTurnId();
    const requestId = crypto.randomUUID();
    activeTurnRef.current = clientTurnId;
    streamRequestIdRef.current = requestId;
    lastEventIdRef.current = null;
    uiBySessionRef.current.set(activeSessionId, {
      composer: '',
      selectedSkillPaths: [],
      mode,
      agentModelKey: modelKey,
      clientTurnId,
      requestId,
      lastEventId: null,
      toolPending: null,
    });
    setComposer('');
    setSelectedSkillPaths([]);
    appendUser(compileHumanTextFromBlocks(content), clientTurnId, userInput);
    appendAssistantStream(clientTurnId);
    setLiveToolSteps([]);
    await runStream(activeSessionId, (onFrame, signal) =>
      streamCanvasTurn(
        episodeId,
        {
          session_id: activeSessionId,
          request_id: requestId,
          content,
          materials: [],
          model_key: modelKey,
          client_turn_id: clientTurnId,
          mode,
          enable_tools: true,
        },
        onFrame,
        turnStreamHooks(activeSessionId, signal, null),
      ),
    );
  }, [
    composer,
    selectedSkillPaths,
    busy,
    activeSessionId,
    episodeId,
    mode,
    agentModelKey,
    chatModelCatalog,
    appendUser,
    appendAssistantStream,
    runStream,
    turnStreamHooks,
  ]);

  const reattachSessionStream = useCallback(
    (sessionId: number, cached: SessionUiCache) => {
      if (!cached.requestId || !cached.clientTurnId) return;
      if (streamingSessionRef.current === sessionId) return;
      activeTurnRef.current = cached.clientTurnId;
      streamRequestIdRef.current = cached.requestId;
      lastEventIdRef.current = cached.lastEventId ?? null;
      if (cached.toolPending) setToolPending(cached.toolPending);
      void runStream(sessionId, (onFrame, signal) =>
        reconnectCanvasTurnWithReplay(
          episodeId,
          { session_id: sessionId, request_id: cached.requestId! },
          onFrame,
          turnStreamHooks(sessionId, signal, cached.lastEventId ?? null),
        ),
      );
    },
    [episodeId, runStream, turnStreamHooks],
  );

  const switchSession = useCallback(
    (nextSessionId: number) => {
      if (activeSessionId === nextSessionId) return;
      if (activeSessionId != null) {
        const prevCache = uiBySessionRef.current.get(activeSessionId);
        uiBySessionRef.current.set(activeSessionId, {
          composer,
          selectedSkillPaths,
          mode,
          agentModelKey,
          clientTurnId: activeTurnRef.current ?? prevCache?.clientTurnId ?? null,
          requestId: streamRequestIdRef.current ?? prevCache?.requestId ?? null,
          lastEventId: lastEventIdRef.current ?? prevCache?.lastEventId ?? null,
          toolPending: toolPending ?? prevCache?.toolPending ?? null,
        });
        if (streamingSessionRef.current === activeSessionId) {
          streamAbortReasonRef.current.set(activeSessionId, 'switch');
          agentAbortRef.current?.abort();
        }
      }
      clearMessages();
      const cached = uiBySessionRef.current.get(nextSessionId);
      setActiveSessionId(nextSessionId);
      setComposer(cached?.composer ?? '');
      setSelectedSkillPaths(cached?.selectedSkillPaths ?? []);
      setMode(cached?.mode ?? 'auto');
      // 无 cache 时不沿用上一会话 modelKey
      setAgentModelKey(cached?.agentModelKey);
      setLiveToolSteps([]);
      setToolPending(cached?.toolPending ?? null);
      activeTurnRef.current = cached?.clientTurnId ?? null;
      streamRequestIdRef.current = cached?.requestId ?? null;
      lastEventIdRef.current = cached?.lastEventId ?? null;
      if (busySessionIds.has(nextSessionId) && cached?.requestId && cached.clientTurnId) {
        reattachSessionStream(nextSessionId, cached);
      }
    },
    [
      activeSessionId,
      agentModelKey,
      busySessionIds,
      clearMessages,
      composer,
      selectedSkillPaths,
      mode,
      reattachSessionStream,
      toolPending,
    ],
  );

  const handleCreateSession = useCallback(async () => {
    if (creatingSession) return;
    setCreatingSession(true);
    try {
      const created = await createCanvasSession(episodeId);
      const items = await listCanvasSessions(episodeId);
      setSessions(items);
      switchSession(created.id);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '创建会话失败');
    } finally {
      setCreatingSession(false);
    }
  }, [creatingSession, episodeId, switchSession]);

  const handleRenameSession = useCallback(
    async (sessionId: number, title: string) => {
      try {
        const updated = await updateCanvasSession(episodeId, {
          session_id: sessionId,
          title,
        });
        setSessions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      } catch (err) {
        message.error(err instanceof Error ? err.message : '重命名失败');
        throw err;
      }
    },
    [episodeId],
  );

  const handleCloseSession = useCallback(
    async (sessionId: number) => {
      try {
        await deleteCanvasSession(episodeId, sessionId);
        uiBySessionRef.current.delete(sessionId);
        setSessionBusy(sessionId, false);
        if (streamingSessionRef.current === sessionId) {
          streamAbortReasonRef.current.set(sessionId, 'replace');
          agentAbortRef.current?.abort();
        }
        const items = await listCanvasSessions(episodeId);
        setSessions(items);
        if (activeSessionId !== sessionId) return;
        clearMessages();
        const nextId = items[0]?.id ?? null;
        if (nextId == null) {
          setActiveSessionId(null);
          setComposer('');
          setToolPending(null);
          activeTurnRef.current = null;
          streamRequestIdRef.current = null;
          lastEventIdRef.current = null;
          return;
        }
        const cached = uiBySessionRef.current.get(nextId);
        setActiveSessionId(nextId);
        setComposer(cached?.composer ?? '');
        setMode(cached?.mode ?? 'auto');
        setAgentModelKey(cached?.agentModelKey);
        setLiveToolSteps([]);
        setToolPending(cached?.toolPending ?? null);
        activeTurnRef.current = cached?.clientTurnId ?? null;
        streamRequestIdRef.current = cached?.requestId ?? null;
        lastEventIdRef.current = cached?.lastEventId ?? null;
        if (busySessionIds.has(nextId) && cached?.requestId && cached.clientTurnId) {
          reattachSessionStream(nextId, cached);
        }
      } catch (err) {
        message.error(err instanceof Error ? err.message : '关闭会话失败');
      }
    },
    [
      activeSessionId,
      busySessionIds,
      clearMessages,
      episodeId,
      reattachSessionStream,
      setSessionBusy,
    ],
  );

  const onNodeGenerate = useCallback(
    async (nodeId: string, extra?: NodeGenerateExtra) => {
      if (pendingNodeIds.has(nodeId)) return;
      const node = graphRef.current.nodes.find((n) => n.id === nodeId);
      if (!node) return;
      // 文本同步生成：返回即终态，在途只看 pendingNodeIds；媒体异步才看 running
      if (node.data.kind !== 'text' && node.data.status === 'running') return;

      const kind = node.data.kind;
      const prompt =
        extra?.prompt?.trim() ||
        node.data.input_prompt?.trim() ||
        node.data.output_text?.trim();
      if (!prompt) {
        message.warning('请先填写提示词');
        return;
      }

      const body: NodeGenerateBody = {
        node_id: nodeId,
        kind,
        prompt,
      };

      if (kind === 'text') {
        const modelKey = chatModelCatalog.resolveModelKey(node.data.model_id);
        if (!hasResolvedChatModelKey(modelKey)) {
          message.warning('请先选择对话模型');
          return;
        }
        body.model_key = modelKey;
      } else if (kind === 'audio') {
        const modelId = modelCatalog.resolveModelId('audio', node.data.model_id);
        if (!hasResolvedModelId(modelId)) {
          message.warning('请先选择 TTS 模型');
          return;
        }
        body.model_id = modelId;
        body.voice_id = node.data.voice_id;
      } else if (kind === 'image' || kind === 'video') {
        const modelId = extra?.model_id ?? modelCatalog.resolveModelId(kind, node.data.model_id);
        if (!hasResolvedModelId(modelId)) {
          message.warning('请先选择生成模型');
          return;
        }
        body.model_id = modelId;
        body.ratio = extra?.ratio ?? node.data.ratio;
        body.resolution = extra?.resolution ?? node.data.resolution;
        body.duration = extra?.duration ?? node.data.duration_sec;
        body.reference_mode = extra?.reference_mode;
        body.ref_attachment_ids = extra?.ref_attachment_ids;
        body.ref_asset_ids = extra?.ref_asset_ids;
        if (extra?.submit_content?.length) {
          body.submit_content = extra.submit_content;
        }
        if (extra?.manual_refs?.length) {
          body.manual_refs = extra.manual_refs;
        }
        if (extra?.preview_media_asset_ids?.length) {
          body.preview_media_asset_ids = extra.preview_media_asset_ids;
        }
      } else {
        return;
      }

      const storedInputPrompt =
        extra?.input_prompt?.trim() || node.data.input_prompt?.trim() || prompt;
      const nodePatch: Record<string, unknown> = { input_prompt: storedInputPrompt };
      if (kind === 'text') {
        nodePatch.model_id = body.model_key;
      } else if (kind === 'audio') {
        nodePatch.model_id = body.model_id;
        if (body.voice_id != null) nodePatch.voice_id = body.voice_id;
      } else if (kind === 'image' || kind === 'video') {
        nodePatch.model_id = body.model_id;
        if (body.ratio != null) nodePatch.ratio = body.ratio;
        if (body.resolution != null) nodePatch.resolution = body.resolution;
        if (body.duration != null) nodePatch.duration_sec = body.duration;
      }

      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...nodePatch } } : n)),
      );

      nodeAbortRef.current.get(nodeId)?.abort();
      const ac = new AbortController();
      nodeAbortRef.current.set(nodeId, ac);
      setNodePending(nodeId, true);
      setNodeGeneratePending(nodeId, true);
      try {
        const saved = await commitOps([{ op: 'update_node', node_id: nodeId, patch: nodePatch }]);
        if (!saved) return;

        const result = await submitCanvasNodeGenerate(episodeId, nodeId, body, ac.signal);
        applyGenerateResult(result);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        handleNodeGenerateError(err, nodeId);
      } finally {
        setNodeGeneratePending(nodeId, false);
        setNodePending(nodeId, false);
        nodeAbortRef.current.delete(nodeId);
      }
    },
    [
      applyGenerateResult,
      chatModelCatalog,
      handleNodeGenerateError,
      modelCatalog,
      commitOps,
      pendingNodeIds,
      episodeId,
      setNodeGeneratePending,
      setNodePending,
      setNodes,
    ],
  );

  const onNodeChange = useCallback(
    (input: NodeChangeInput) => {
      const { nodeId, patch, persist } = input;
      setNodes((nds) => nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n)));
      if (persist === 'immediate') {
        void commitOps([{ op: 'update_node', node_id: nodeId, patch }]);
      }
    },
    [commitOps, setNodes],
  );

  const onQuickAdd = useCallback(
    async (kind: CanvasNodeKind, position: { x: number; y: number }) => {
      const meta = DEFAULT_NODE_META[kind];
      await commitOps([
        {
          op: 'create_node',
          node: {
            kind,
            position,
            title: meta.title,
            input_prompt: '',
            output_text: '',
            model_id: meta.model_id,
            ratio: meta.ratio,
            duration_sec: meta.duration_sec,
          },
        },
      ]);
    },
    [commitOps],
  );

  const onStop = useCallback(() => {
    if (activeSessionId != null) {
      streamAbortReasonRef.current.set(activeSessionId, 'replace');
    }
    agentAbortRef.current?.abort();
    if (activeSessionId == null) return;
    void cancelCanvasTurn(episodeId, activeSessionId)
      .then(() => {
        setSessionBusy(activeSessionId, false);
        setToolPending(null);
      })
      .catch((err) => {
        message.error(err instanceof Error ? err.message : '停止失败');
      });
  }, [episodeId, activeSessionId, setSessionBusy]);

  return (
    <div className="workflow-canvas-page">
      <div className="workflow-canvas-page__mobile-gate" role="status">
        <p>画布需要更大的屏幕完成节点编排。</p>
        <button type="button" onClick={() => navigate('/')}>
          返回 Home
        </button>
      </div>
      {eventsError ? (
        <div className="workflow-canvas-page__events-error" role="status">
          画布同步中断：{eventsError}（正在重连…）
        </div>
      ) : null}
      <CanvasGenerateProvider onNodeGenerate={onNodeGenerate}>
        <WorkflowCanvasFlow
          projectId={projectId}
          episodeId={episodeId}
          projectName={projectName}
          episodeName={episodeName}
          episodes={episodes}
          busy={busy}
          nodes={nodes}
          edges={edges}
          loaded={loaded}
          onNodesChange={onNodesChange as OnNodesChange<CanvasFlowNode>}
          onEdgesChange={onEdgesChange}
          onNodeDragStop={onNodeDragStop as OnNodeDrag<CanvasFlowNode>}
          commitOps={commitOps}
          onNodeChange={onNodeChange}
          onQuickAdd={onQuickAdd}
        />
        <CanvasAgentPanel
          open={agentOpen}
          onOpenChange={setAgentOpen}
          messages={messages}
          loading={messagesLoading}
          busy={busy}
          mode={mode}
          onModeChange={setMode}
          modelKey={agentModelKey}
          onModelChange={setAgentModelKey}
          composer={composer}
          onComposerChange={setComposer}
          selectedSkillPaths={selectedSkillPaths}
          onSelectedSkillPathsChange={setSelectedSkillPaths}
          projectId={projectId}
          onSend={() => void sendTurn()}
          onStop={onStop}
          liveToolSteps={liveToolSteps}
          toolPending={toolPending}
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSessionChange={switchSession}
          onCreateSession={() => void handleCreateSession()}
          onRenameSession={handleRenameSession}
          onCloseSession={(sessionId) => void handleCloseSession(sessionId)}
          sessionsLoading={sessionsLoading}
          creatingSession={creatingSession}
          onConfirmTool={(operation) =>
            void (async () => {
              if (!toolPending || !activeTurnRef.current || activeSessionId == null) return;
              const pending = toolPending;
              const modelKey = chatModelCatalog.resolveModelKey(agentModelKey);
              if (!hasResolvedChatModelKey(modelKey)) {
                message.warning('对话模型不可用，请稍后重试');
                return;
              }
              const requestId = crypto.randomUUID();
              streamRequestIdRef.current = requestId;
              lastEventIdRef.current = null;
              setResumeLoading(true);
              let streamFailed = false;
              try {
                await runStream(activeSessionId, async (onFrame, signal) => {
                  try {
                    await resumeCanvasTurn(
                      episodeId,
                      {
                        session_id: activeSessionId,
                        request_id: requestId,
                        tool_call_id: pending.call_id,
                        action: 'confirm',
                        client_turn_id: activeTurnRef.current!,
                        model_key: modelKey,
                        operation: operation ?? pending.operation ?? null,
                      },
                      (frame) => {
                        if (frame.type === 'error') streamFailed = true;
                        onFrame(frame);
                      },
                      turnStreamHooks(activeSessionId, signal, null),
                    );
                  } catch (err) {
                    streamFailed = true;
                    throw err;
                  }
                });
                if (!streamFailed) {
                  setToolPending(null);
                  const cached = uiBySessionRef.current.get(activeSessionId);
                  if (cached) {
                    uiBySessionRef.current.set(activeSessionId, { ...cached, toolPending: null });
                  }
                }
              } finally {
                setResumeLoading(false);
              }
            })()
          }
          onRejectTool={() =>
            void (async () => {
              if (!toolPending || !activeTurnRef.current || activeSessionId == null) return;
              const pending = toolPending;
              const modelKey = chatModelCatalog.resolveModelKey(agentModelKey);
              if (!hasResolvedChatModelKey(modelKey)) {
                message.warning('对话模型不可用，请稍后重试');
                return;
              }
              const requestId = crypto.randomUUID();
              streamRequestIdRef.current = requestId;
              lastEventIdRef.current = null;
              setResumeLoading(true);
              let streamFailed = false;
              try {
                await runStream(activeSessionId, async (onFrame, signal) => {
                  try {
                    await resumeCanvasTurn(
                      episodeId,
                      {
                        session_id: activeSessionId,
                        request_id: requestId,
                        tool_call_id: pending.call_id,
                        action: 'reject',
                        client_turn_id: activeTurnRef.current!,
                        model_key: modelKey,
                      },
                      (frame) => {
                        if (frame.type === 'error') streamFailed = true;
                        onFrame(frame);
                      },
                      turnStreamHooks(activeSessionId, signal, null),
                    );
                  } catch (err) {
                    streamFailed = true;
                    throw err;
                  }
                });
                if (!streamFailed) {
                  setToolPending(null);
                  const cached = uiBySessionRef.current.get(activeSessionId);
                  if (cached) {
                    uiBySessionRef.current.set(activeSessionId, { ...cached, toolPending: null });
                  }
                }
              } finally {
                setResumeLoading(false);
              }
            })()
          }
          resumeLoading={resumeLoading}
        />
      </CanvasGenerateProvider>
    </div>
  );
}

export function CanvasPage() {
  const { projectId: rawProjectId, episodeId: rawEpisodeId } = useParams();
  const projectId = Number(rawProjectId);
  const episodeId = Number(rawEpisodeId);
  if (!Number.isFinite(projectId) || projectId <= 0 || !Number.isFinite(episodeId) || episodeId <= 0) {
    return (
      <div className="workflow-canvas-page workflow-canvas-page--invalid">
        <p>无效的画布，请从画布列表进入。</p>
        <a href="/projects">全部画布</a>
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <CanvasProjectProvider key={`${projectId}:${episodeId}`} projectId={projectId} episodeId={episodeId}>
        <ChatModelCatalogProvider>
          <GenerateModelCatalogProvider>
            <CanvasTaskProvider>
              <CanvasPageInner />
            </CanvasTaskProvider>
          </GenerateModelCatalogProvider>
        </ChatModelCatalogProvider>
      </CanvasProjectProvider>
    </ReactFlowProvider>
  );
}
