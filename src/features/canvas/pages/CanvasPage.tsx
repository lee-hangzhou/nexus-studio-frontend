import '@xyflow/react/dist/style.css';
import '../styles/workflow-canvas.entry.less';

import { ReactFlowProvider } from '@xyflow/react';
import { message } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getProject } from '../../../api/projects';
import type { ToolStepView } from '../../../api/chat';
import { appendToolStepStart, updateToolStepResult } from '../../chat/toolStepUtils';
import {
  cancelCanvasTurn,
  resumeCanvasTurn,
  streamCanvasTurn,
  submitCanvasNodeGenerate,
} from '../api/canvas';
import { CANVAS_API_CODE, isCanvasApiError } from '../api/canvasErrors';
import type {
  CanvasNodeGenerateResponse,
  CanvasNodeKind,
  CanvasPatchEvent,
  CanvasPatchOp,
  CanvasStreamFrame,
  NodeGenerateBody,
} from '../api/canvasTypes';
import { CanvasAgentPanel } from '../components/CanvasAgentPanel';
import { buildTurnId } from '../components/CanvasAgentPanel.utils';
import { CanvasGenerateProvider } from '../context/CanvasGenerateContext';
import { ChatModelCatalogProvider, useChatModelCatalog } from '../context/ChatModelCatalogContext';
import { GenerateModelCatalogProvider } from '../context/GenerateModelCatalogContext';
import { hasResolvedChatModelKey } from '../lib/chatModelKey';
import { CanvasProjectProvider, useCanvasProject } from '../context/CanvasProjectContext';
import { CanvasTaskProvider, useCanvasTask } from '../context/CanvasTaskContext';
import { WorkflowCanvasFlow } from '../flow/WorkflowCanvasFlow';
import { useCanvasGraph } from '../hooks/useCanvasGraph';
import { useCanvasMessages } from '../hooks/useCanvasMessages';
import { useCanvasPatch } from '../hooks/useCanvasPatch';
import { useCanvasGenerationWatch } from '../hooks/useCanvasGenerationWatch';
import { hasResolvedModelId } from '../lib/generateModelId';
import { useGenerateModelCatalog } from '../context/GenerateModelCatalogContext';
import { useCanvasSnapshot } from '../hooks/useCanvasSnapshot';
import { applyCanvasPatchDelta } from '../lib/applyCanvasPatchDelta';
import {
  canvasPatchFromFrame,
  generationProgressFromFrame,
  toolPendingFromFrame,
} from '../lib/streamFrame';
import { DEFAULT_NODE_META } from '../schema/nodeDefaults';
import {
  recordToNodeData,
  toFlowEdges,
  toFlowNodes,
  type CanvasFlowEdge,
  type CanvasFlowNode,
} from '../schema/canvasSchema';
import type { NodeChangeInput } from '../storyflow/types';

function CanvasPageInner() {
  const navigate = useNavigate();
  const { projectId, setRevision, refetchSnapshot, loading: snapLoading } = useCanvasProject();
  const { pendingNodeIds, setNodePending } = useCanvasTask();
  const modelCatalog = useGenerateModelCatalog();
  const chatModelCatalog = useChatModelCatalog();
  const [projectName, setProjectName] = useState<string | undefined>();
  const [mode, setMode] = useState<'auto' | 'manual'>('auto');
  const [agentModelKey, setAgentModelKey] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [composer, setComposer] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [liveToolSteps, setLiveToolSteps] = useState<ToolStepView[]>([]);
  const [toolPending, setToolPending] = useState<{ call_id: string; summary: string } | null>(null);
  const [resumeLoading, setResumeLoading] = useState(false);
  const agentAbortRef = useRef<AbortController | null>(null);
  const nodeAbortRef = useRef<Map<string, AbortController>>(new Map());
  const activeTurnRef = useRef<string | null>(null);
  const graphRef = useRef<{ nodes: CanvasFlowNode[]; edges: CanvasFlowEdge[] }>({ nodes: [], edges: [] });
  const commitOpsRef = useRef<(ops: CanvasPatchOp[]) => Promise<import('../api/canvasTypes').CanvasPatchResult | null>>(
    async () => null,
  );
  const pendingNodeIdsRef = useRef(pendingNodeIds);
  pendingNodeIdsRef.current = pendingNodeIds;

  const graph = useCanvasGraph((ops) => commitOpsRef.current(ops));
  const { nodes, edges, setNodes, setEdges, onNodesChange, onEdgesChange, onNodeDragStop } = graph;
  graphRef.current = { nodes, edges };

  const syncCanvasFromServer = useCallback(async () => {
    // 节点生成在途时，忽略 autosave 触发的 revision 冲突同步，避免覆盖 generate 结果
    if (pendingNodeIdsRef.current.size > 0) return;
    const snap = await refetchSnapshot();
    if (snap) {
      setNodes(toFlowNodes(snap.nodes));
      setEdges(toFlowEdges(snap.edges));
    }
  }, [refetchSnapshot, setNodes, setEdges]);

  const { commitOps } = useCanvasPatch(nodes, edges, setNodes, setEdges, syncCanvasFromServer);
  commitOpsRef.current = commitOps;

  useCanvasSnapshot(setNodes, setEdges);
  useCanvasGenerationWatch(nodes, setNodes, async () => {
    const snap = await refetchSnapshot();
    if (snap) {
      setNodes(toFlowNodes(snap.nodes));
      setEdges(toFlowEdges(snap.edges));
    }
  });

  useEffect(() => {
    void getProject(projectId)
      .then((p) => setProjectName(p.name))
      .catch(() => {
        message.error('项目不存在或无权访问');
        navigate('/projects', { replace: true });
      });
  }, [projectId, navigate]);
  useEffect(() => {
    if (!snapLoading) setLoaded(true);
  }, [snapLoading]);

  const {
    messages,
    loading: messagesLoading,
    loadMessages,
    appendUser,
    appendAssistantStream,
    appendAssistantToken,
    finishAssistantStream,
  } = useCanvasMessages(projectId);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    if (agentModelKey) return;
    const resolved = chatModelCatalog.resolveModelKey(undefined);
    if (resolved) setAgentModelKey(resolved);
  }, [agentModelKey, chatModelCatalog]);

  const applyPatchEvent = useCallback(
    (event: CanvasPatchEvent) => {
      setRevision(event.revision);
      const prev = graphRef.current;
      const prevIds = new Set(prev.nodes.map((n) => n.id));
      const merged = applyCanvasPatchDelta(prev.nodes, prev.edges, event);
      const createdIds = new Set(merged.nodes.filter((n) => !prevIds.has(n.id)).map((n) => n.id));
      if (createdIds.size > 0) {
        setNodes(
          merged.nodes.map((n) => ({
            ...n,
            selected: createdIds.has(n.id),
          })),
        );
      } else {
        setNodes(merged.nodes);
      }
      setEdges(merged.edges);
    },
    [setRevision, setNodes, setEdges],
  );

  const handleStreamFrame = useCallback(
    (frame: CanvasStreamFrame, clientTurnId: string) => {
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
      const patch = canvasPatchFromFrame(frame);
      if (patch) applyPatchEvent(patch);
      const progress = generationProgressFromFrame(frame);
      if (progress) {
        setNodes((nds) =>
          nds.map((n) =>
            n.id === progress.node_id
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    ...(progress.status ? { status: progress.status as CanvasFlowNode['data']['status'] } : {}),
                    ...(progress.task_id != null ? { task_id: progress.task_id } : {}),
                  },
                }
              : n,
          ),
        );
        if (progress.revision != null) setRevision(progress.revision);
      }
      const pending = toolPendingFromFrame(frame);
      if (pending) setToolPending({ call_id: pending.call_id, summary: pending.summary });
      if (frame.type === 'error') message.error(frame.message ?? '执行失败');
      if (frame.type === 'done') {
        finishAssistantStream(clientTurnId);
        setLiveToolSteps([]);
        void loadMessages();
      }
      if (frame.type === 'cancelled') {
        finishAssistantStream(clientTurnId);
        setLiveToolSteps([]);
      }
    },
    [appendAssistantToken, applyPatchEvent, finishAssistantStream, loadMessages, setNodes, setRevision],
  );

  const runStream = useCallback(
    async (runner: (onFrame: (f: CanvasStreamFrame) => void, signal: AbortSignal) => Promise<void>) => {
      agentAbortRef.current?.abort();
      const ac = new AbortController();
      agentAbortRef.current = ac;
      setBusy(true);
      try {
        await runner((f) => handleStreamFrame(f, activeTurnRef.current ?? ''), ac.signal);
      } catch (err) {
        if (err instanceof Error && err.message === 'canvas_project_busy') {
          message.warning('项目正在执行 Agent，请稍后再试');
        } else if (err instanceof Error && err.message !== 'http_409') {
          message.error(err.message || '请求失败');
        }
      } finally {
        setBusy(false);
        setToolPending(null);
      }
    },
    [handleStreamFrame],
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
      setRevision(result.revision);
      const nodeData = { ...recordToNodeData(result.node), generatePending: false };
      setNodes((nds) =>
        nds.map((n) => (n.id === result.node_id ? { ...n, data: { ...n.data, ...nodeData } } : n)),
      );
    },
    [setNodes, setRevision],
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
    const content = composer.trim();
    if (!content || busy) return;
    const modelKey = chatModelCatalog.resolveModelKey(agentModelKey);
    if (!hasResolvedChatModelKey(modelKey)) {
      message.warning('对话模型不可用，请稍后重试');
      return;
    }
    if (modelKey !== agentModelKey) {
      setAgentModelKey(modelKey);
    }
    const clientTurnId = buildTurnId();
    activeTurnRef.current = clientTurnId;
    setComposer('');
    appendUser(content, clientTurnId);
    appendAssistantStream(clientTurnId);
    setLiveToolSteps([]);
    await runStream((onFrame, signal) =>
      streamCanvasTurn(
        projectId,
        { content, model_key: modelKey, client_turn_id: clientTurnId, mode, enable_tools: true },
        onFrame,
        signal,
      ),
    );
  }, [
    composer,
    busy,
    projectId,
    mode,
    agentModelKey,
    chatModelCatalog,
    appendUser,
    appendAssistantStream,
    runStream,
  ]);

  const onNodeGenerate = useCallback(
    async (nodeId: string, extra?: import('../context/CanvasGenerateContext').NodeGenerateExtra) => {
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

        const result = await submitCanvasNodeGenerate(projectId, nodeId, body, ac.signal);
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
      projectId,
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
    agentAbortRef.current?.abort();
    void cancelCanvasTurn(projectId);
  }, [projectId]);

  return (
    <div className="workflow-canvas-page">
      <div className="workflow-canvas-page__mobile-gate" role="status">
        <p>画布需要更大的屏幕完成节点编排。</p>
        <button type="button" onClick={() => navigate('/')}>
          返回 Home
        </button>
      </div>
      <CanvasGenerateProvider onNodeGenerate={onNodeGenerate}>
        <WorkflowCanvasFlow
          projectId={projectId}
          projectName={projectName}
          busy={busy}
          onStop={onStop}
          nodes={nodes}
          edges={edges}
          loaded={loaded}
          onNodesChange={onNodesChange as import('@xyflow/react').OnNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDragStop={onNodeDragStop as import('@xyflow/react').OnNodeDrag}
          commitOps={commitOps}
          onNodeChange={onNodeChange}
          onQuickAdd={onQuickAdd}
        />
        <CanvasAgentPanel
          messages={messages}
          loading={messagesLoading}
          busy={busy}
          mode={mode}
          onModeChange={setMode}
          modelKey={agentModelKey}
          onModelChange={setAgentModelKey}
          composer={composer}
          onComposerChange={setComposer}
          onSend={() => void sendTurn()}
          liveToolSteps={liveToolSteps}
          toolPending={toolPending}
          onConfirmTool={() =>
            void (async () => {
              if (!toolPending || !activeTurnRef.current) return;
              setResumeLoading(true);
              try {
                await runStream((onFrame, signal) =>
                  resumeCanvasTurn(
                    projectId,
                    {
                      tool_call_id: toolPending.call_id,
                      action: 'confirm',
                      client_turn_id: activeTurnRef.current!,
                    },
                    onFrame,
                    signal,
                  ),
                );
              } finally {
                setResumeLoading(false);
              }
            })()
          }
          onRejectTool={() =>
            void (async () => {
              if (!toolPending || !activeTurnRef.current) return;
              setResumeLoading(true);
              try {
                await runStream((onFrame, signal) =>
                  resumeCanvasTurn(
                    projectId,
                    {
                      tool_call_id: toolPending.call_id,
                      action: 'reject',
                      client_turn_id: activeTurnRef.current!,
                    },
                    onFrame,
                    signal,
                  ),
                );
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
  const { projectId: raw } = useParams();
  const projectId = Number(raw);
  if (!Number.isFinite(projectId) || projectId <= 0) {
    return (
      <div className="workflow-canvas-page workflow-canvas-page--invalid">
        <p>无效的项目 ID，请从项目列表进入。</p>
        <a href="/projects">全部工作</a>
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <CanvasProjectProvider projectId={projectId}>
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
