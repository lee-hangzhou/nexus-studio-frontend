import { CloseOutlined, CommentOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Popover, Select, Spin } from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ToolStepView } from '../../../api/chat';
import { ComposerSendButton } from '../../../shared/ui/ComposerSendButton';
import { ComposerShell } from '../../../shared/ui/ComposerShell';
import { StudioButton } from '../../../shared/ui/StudioButton';
import { StudioChip } from '../../../shared/ui/StudioChip';
import { ToolRunTimeline } from '../../chat/components/ToolRunTimeline';
import { ComposerPlusMenu } from '../../skills/ComposerPlusMenu';
import { SkillManageModal } from '../../skills/SkillManageModal';
import { SkillPill } from '../../skills/SkillPill';
import { SkillWritePendingCard } from '../../skills/SkillWritePendingCard';
import { SKILL_WRITE_OPERATION_TYPE } from '../../skills/constants';
import { UserMessageContent } from '../../skills/UserMessageContent';
import type { SkillWriteOperation, ToolPendingState, TurnMaterialBlock } from '../../skills/types';
import type { ToolPendingOperation } from '../../../api/toolPending';
import { CanvasNodePendingCard } from './CanvasNodePendingCard';
import { CanvasMaterialChipList } from './CanvasMaterialChipList';
import type { CanvasSessionView } from '../api/canvasTypes';
import { CANVAS_DEFAULT_SESSION_TITLE } from '../constants';
import { useChatModelCatalog } from '../context/ChatModelCatalogContext';
import type { CanvasFeedMessage } from '../hooks/useCanvasMessages';
import { stripPseudoToolMarkup } from '../utils/stripPseudoToolMarkup';
import { CanvasAgentSessionList } from './CanvasAgentSessionList';
import {
  CanvasAgentTurnModeMenu,
  type CanvasAgentMode,
} from './CanvasAgentTurnModeMenu';
import { useAgentPanelWidth } from './useAgentPanelWidth';

function toolStepsFromMetadata(metadata: Record<string, unknown>): ToolStepView[] {
  const raw = metadata.tool_steps;
  if (!Array.isArray(raw)) return [];
  return raw.map((item, index) => {
    const step = item as Record<string, unknown>;
    const ok = step.ok !== false;
    const preview =
      typeof step.result_preview === 'string'
        ? step.result_preview
        : typeof step.preview === 'string'
          ? step.preview
          : '';
    return {
      call_id: String(step.call_id ?? `meta-${index}`),
      name: String(step.name ?? 'tool'),
      args: (typeof step.args === 'object' && step.args !== null
        ? step.args
        : {}) as Record<string, unknown>,
      result_preview: ok ? preview : `失败: ${preview}`,
    };
  });
}

export type { CanvasAgentMode };

export function CanvasAgentPanel({
  open,
  onOpenChange,
  messages,
  loading,
  busy,
  mode,
  onModeChange,
  modelKey,
  onModelChange,
  composer,
  onComposerChange,
  selectedSkillPaths,
  onSelectedSkillPathsChange,
  materials,
  materialPreviewUrls,
  onMaterialsChange,
  onUploadFile,
  projectId,
  onSend,
  onStop,
  liveToolSteps,
  toolPending,
  onConfirmTool,
  onRejectTool,
  resumeLoading,
  sessions,
  activeSessionId,
  onSessionChange,
  onCreateSession,
  onRenameSession,
  onCloseSession,
  sessionsLoading,
  creatingSession,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messages: CanvasFeedMessage[];
  loading: boolean;
  busy: boolean;
  mode: CanvasAgentMode;
  onModeChange: (mode: CanvasAgentMode) => void;
  modelKey: string | undefined;
  onModelChange: (modelKey: string) => void;
  composer: string;
  onComposerChange: (v: string) => void;
  selectedSkillPaths: string[];
  onSelectedSkillPathsChange: (paths: string[]) => void;
  materials: TurnMaterialBlock[];
  materialPreviewUrls: ReadonlyMap<number, string>;
  onMaterialsChange: (materials: TurnMaterialBlock[]) => void;
  onUploadFile: (file: File) => Promise<void>;
  projectId: number;
  onSend: () => void;
  onStop: () => void;
  liveToolSteps: ToolStepView[];
  toolPending: ToolPendingState | null;
  onConfirmTool: (operation?: ToolPendingOperation | SkillWriteOperation | null) => void;
  onRejectTool: () => void;
  resumeLoading: boolean;
  sessions: CanvasSessionView[];
  activeSessionId: number | null;
  onSessionChange: (sessionId: number) => void;
  onCreateSession: () => void;
  onRenameSession: (sessionId: number, title: string) => void | Promise<void>;
  onCloseSession: (sessionId: number) => void | Promise<void>;
  sessionsLoading: boolean;
  creatingSession: boolean;
}) {
  const feedRef = useRef<HTMLDivElement>(null);
  const chatModels = useChatModelCatalog();
  const { width, onResizePointerDown } = useAgentPanelWidth();
  const [sessionListOpen, setSessionListOpen] = useState(false);
  const [sessionListEditing, setSessionListEditing] = useState(false);
  const [skillManageOpen, setSkillManageOpen] = useState(false);

  const sessionTitle = useMemo(() => {
    const active = sessions.find((s) => s.id === activeSessionId);
    return active?.title?.trim() || CANVAS_DEFAULT_SESSION_TITLE;
  }, [sessions, activeSessionId]);

  useEffect(() => {
    if (!open) return;
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, liveToolSteps, open]);

  const handleSend = useCallback(() => {
    if (!composer.trim() || busy || !modelKey || activeSessionId == null) return;
    onSend();
  }, [composer, busy, modelKey, activeSessionId, onSend]);

  const handleSelectSession = useCallback(
    (sessionId: number) => {
      setSessionListOpen(false);
      onSessionChange(sessionId);
    },
    [onSessionChange],
  );

  const canSend =
    Boolean(composer.trim())
    && !busy
    && Boolean(modelKey)
    && activeSessionId != null;

  const sessionOptions = useMemo(
    () =>
      sessions.map((session) => ({
        value: session.id,
        label: session.title?.trim() || CANVAS_DEFAULT_SESSION_TITLE,
      })),
    [sessions],
  );

  if (!open) {
    return (
      <div className="canvas-agent-float canvas-agent-float--collapsed">
        <StudioChip
          icon={<CommentOutlined aria-hidden />}
          onClick={() => onOpenChange(true)}
          aria-controls="canvas-agent-panel"
        >
          画布 Agent
        </StudioChip>
        <Select
          className="canvas-agent-float__session-select"
          size="small"
          popupMatchSelectWidth={false}
          value={activeSessionId ?? undefined}
          options={sessionOptions}
          loading={sessionsLoading}
          disabled={sessionsLoading || sessions.length === 0}
          onChange={(sessionId) => onSessionChange(sessionId)}
          placeholder={CANVAS_DEFAULT_SESSION_TITLE}
          aria-label="切换会话"
        />
        {busy ? (
          <StudioButton variant="primary" size="sm" onClick={onStop} aria-label="停止生成">
            停止
          </StudioButton>
        ) : null}
      </div>
    );
  }

  return (
    <aside className="canvas-agent-float" style={{ width }} aria-label="画布 Agent">
      <div
        className="canvas-agent-float__resize-handle"
        role="separator"
        aria-orientation="vertical"
        aria-label="调整面板宽度"
        onPointerDown={onResizePointerDown}
      />
      <div className="workflow-canvas-agent-panel" id="canvas-agent-panel">
        <header className="workflow-canvas-agent-panel__head">
          <span className="workflow-canvas-agent-panel__title" title={sessionTitle}>
            {sessionTitle}
          </span>
          <div className="workflow-canvas-agent-panel__head-actions">
            <button
              type="button"
              className="workflow-canvas-agent-panel__icon-btn"
              title="新建会话"
              aria-label="新建会话"
              disabled={busy || sessionsLoading || creatingSession}
              onClick={onCreateSession}
            >
              <PlusOutlined />
            </button>
            <Popover
              trigger="click"
              placement="bottomRight"
              destroyOnHidden
              open={sessionListOpen}
              onOpenChange={(next) => {
                if (!next && sessionListEditing) return;
                setSessionListOpen(next);
              }}
              content={
                <CanvasAgentSessionList
                  sessions={sessions}
                  activeSessionId={activeSessionId}
                  loading={sessionsLoading}
                  onSelect={handleSelectSession}
                  onRename={onRenameSession}
                  onClose={onCloseSession}
                  onEditingChange={setSessionListEditing}
                />
              }
            >
              <button
                type="button"
                className="workflow-canvas-agent-panel__icon-btn"
                title="会话列表"
                aria-label="会话列表"
                aria-expanded={sessionListOpen}
              >
                <CommentOutlined />
              </button>
            </Popover>
            <button
              type="button"
              className="workflow-canvas-agent-panel__icon-btn"
              title="收起面板"
              aria-label="收起面板"
              onClick={() => onOpenChange(false)}
            >
              <CloseOutlined />
            </button>
          </div>
        </header>

        <div className="workflow-canvas-agent-panel__feed" ref={feedRef}>
          {loading ? (
            <div className="workflow-canvas-agent-panel__feed-state">
              <Spin />
            </div>
          ) : null}

          {!loading && messages.length === 0 ? (
            <div className="workflow-canvas-agent-panel__feed-empty">
              描述节点或镜头，Agent 会在这里保留完整会话。
            </div>
          ) : null}

          {messages.map((m) => {
            const steps =
              m.role === 'assistant'
                ? toolStepsFromMetadata(m.metadata).length > 0
                  ? toolStepsFromMetadata(m.metadata)
                  : m.streaming && liveToolSteps.length > 0
                    ? liveToolSteps
                    : []
                : [];
            if (m.role === 'user') {
              return (
                <article key={m.id} className="workflow-canvas-agent-panel__bubble is-user">
                  <span className="workflow-canvas-agent-panel__who">你</span>
                  <UserMessageContent content={m.content} input={m.input} />
                </article>
              );
            }
            const body = stripPseudoToolMarkup(m.content || '');
            return (
              <article key={m.id} className="workflow-canvas-agent-panel__bubble is-assistant">
                <span className="workflow-canvas-agent-panel__who">
                  Agent{m.streaming ? ' · 进行中' : ''}
                </span>
                {steps.length > 0 ? <ToolRunTimeline steps={steps} /> : null}
                {!body && m.streaming ? (
                  <div className="studio-bubble__typing" aria-label="Agent 正在回复">
                    <span />
                    <span />
                    <span />
                  </div>
                ) : body ? (
                  <div className="workflow-canvas-agent-panel__markdown">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
                  </div>
                ) : null}
              </article>
            );
          })}

          {toolPending ? (
            <div className="workflow-canvas-agent-panel__bubble is-assistant">
              {toolPending.enrich_status === 'failed' || !toolPending.operation ? (
                <>
                  <p className="workflow-canvas-agent-panel__text">
                    {toolPending.summary}
                    {toolPending.enrich_status === 'failed'
                      ? toolPending.parse_error === 'malformed_operation'
                        ? '（操作载荷畸形，只能拒绝）'
                        : '（操作解析失败，只能拒绝）'
                      : ''}
                  </p>
                  <div className="workflow-canvas-agent-panel__gate">
                    <Button size="small" disabled={resumeLoading} onClick={onRejectTool}>
                      拒绝
                    </Button>
                  </div>
                </>
              ) : toolPending.operation.type === SKILL_WRITE_OPERATION_TYPE ? (
                <SkillWritePendingCard
                  summary={toolPending.summary}
                  operation={toolPending.operation}
                  loading={resumeLoading}
                  onConfirm={(operation) => onConfirmTool(operation)}
                  onReject={onRejectTool}
                />
              ) : toolPending.operation.type === 'create' ||
                toolPending.operation.type === 'update' ||
                toolPending.operation.type === 'generate' ? (
                <CanvasNodePendingCard
                  summary={toolPending.summary}
                  operation={toolPending.operation}
                  loading={resumeLoading}
                  onConfirm={(operation) => onConfirmTool(operation)}
                  onReject={onRejectTool}
                />
              ) : (
                <>
                  <p className="workflow-canvas-agent-panel__text">{toolPending.summary}</p>
                  <div className="workflow-canvas-agent-panel__gate">
                    <Button size="small" disabled={resumeLoading} onClick={onRejectTool}>
                      拒绝
                    </Button>
                  </div>
                </>
              )}
            </div>
          ) : null}
        </div>

        <div className="workflow-canvas-agent-panel__composer">
          <ComposerShell
            top={
              selectedSkillPaths.length > 0 || materials.length > 0 ? (
                <div className="workflow-canvas-agent-panel__skill-chips">
                  {selectedSkillPaths.map((path) => (
                    <SkillPill
                      key={path}
                      path={path}
                      onRemove={() =>
                        onSelectedSkillPathsChange(selectedSkillPaths.filter((item) => item !== path))
                      }
                    />
                  ))}
                  <CanvasMaterialChipList
                    materials={materials}
                    previewUrlsByAssetId={materialPreviewUrls}
                    onRemove={(index) => onMaterialsChange(materials.filter((_, i) => i !== index))}
                  />
                </div>
              ) : null
            }
            input={
              <textarea
                className="studio-composer-box__textarea"
                value={composer}
                onChange={(e) => onComposerChange(e.target.value)}
                placeholder="继续描述你想改的节点或镜头…"
                rows={3}
                disabled={busy}
                aria-label="画布 Agent 输入"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />
            }
            footerLeft={
              <>
                <ComposerPlusMenu
                  disabled={busy}
                  onUploadFile={onUploadFile}
                  skills={{
                    surface: 'canvas',
                    projectId,
                    selectedPaths: selectedSkillPaths,
                    onSelectedPathsChange: onSelectedSkillPathsChange,
                    onManage: () => setSkillManageOpen(true),
                  }}
                />
                <CanvasAgentTurnModeMenu
                  value={mode}
                  onChange={onModeChange}
                  disabled={busy}
                />
              </>
            }
            footerRight={
              <>
                <Select
                  className="studio-composer-box__model"
                  popupMatchSelectWidth={false}
                  value={modelKey || undefined}
                  onChange={onModelChange}
                  disabled={busy || chatModels.loading || chatModels.items.length === 0}
                  loading={chatModels.loading}
                  options={chatModels.items.map((item) => ({
                    value: item.key,
                    label: item.display_name || item.key,
                  }))}
                  placeholder={chatModels.failed ? '模型不可用' : '选择模型'}
                  aria-label="对话模型"
                />
                <ComposerSendButton
                  busy={busy}
                  disabled={!canSend}
                  onSend={handleSend}
                  onStop={onStop}
                  title={modelKey ? '发送' : '暂无可用模型'}
                />
              </>
            }
          />
          <SkillManageModal
            open={skillManageOpen}
            onClose={() => setSkillManageOpen(false)}
            surface="canvas"
            projectId={projectId}
          />
        </div>
      </div>
    </aside>
  );
}
