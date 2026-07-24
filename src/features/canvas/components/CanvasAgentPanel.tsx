import { CommentOutlined, DownOutlined } from '@ant-design/icons';
import { Button, Dropdown, Spin } from 'antd';
import type { MenuProps } from 'antd';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ToolStepView } from '../../../api/chat';
import { ToolRunTimeline } from '../../chat/components/ToolRunTimeline';
import { useChatModelCatalog } from '../context/ChatModelCatalogContext';
import type { CanvasFeedMessage } from '../hooks/useCanvasMessages';
import { canvasDropdownProps } from '../storyflow/constants/canvasDropdown';
import { stripPseudoToolMarkup } from '../utils/stripPseudoToolMarkup';
import { StudioChip } from '../../../shared/ui/StudioChip';
import { StudioSegment } from '../../../shared/ui/StudioSegment';
import { StudioButton } from '../../../shared/ui/StudioButton';

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

export type CanvasAgentMode = 'auto' | 'manual';

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
  onSend,
  onStop,
  liveToolSteps,
  toolPending,
  onConfirmTool,
  onRejectTool,
  resumeLoading,
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
  onSend: () => void;
  onStop: () => void;
  liveToolSteps: ToolStepView[];
  toolPending: { call_id: string; summary: string } | null;
  onConfirmTool: () => void;
  onRejectTool: () => void;
  resumeLoading: boolean;
}) {
  const feedRef = useRef<HTMLDivElement>(null);
  const chatModels = useChatModelCatalog();

  useEffect(() => {
    if (!open) return;
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, liveToolSteps, open]);

  const handleSend = useCallback(() => {
    if (!composer.trim() || busy || !modelKey) return;
    onSend();
  }, [composer, busy, modelKey, onSend]);

  const modelMenuItems: MenuProps['items'] = useMemo(
    () =>
      chatModels.items.map((item) => ({
        key: item.key,
        label: item.display_name || item.key,
      })),
    [chatModels.items],
  );

  const selectedModelLabel =
    chatModels.items.find((item) => item.key === modelKey)?.display_name ||
    modelKey ||
    (chatModels.loading ? '加载模型…' : chatModels.failed ? '模型不可用' : '选择模型');

  const canSend = Boolean(composer.trim()) && !busy && Boolean(modelKey);

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
        {busy ? (
          <StudioButton variant="primary" size="sm" onClick={onStop} aria-label="停止生成">
            停止
          </StudioButton>
        ) : null}
      </div>
    );
  }

  return (
    <aside className="canvas-agent-float" aria-label="画布 Agent">
      <div className="workflow-canvas-agent-panel" id="canvas-agent-panel">
        <header className="workflow-canvas-agent-panel__head">
          <div className="workflow-canvas-agent-panel__head-main">
            <strong>画布 Agent</strong>
            <span>消息可上滚查看历史</span>
          </div>
          <StudioChip size="sm" onClick={() => onOpenChange(false)}>
            收起
          </StudioChip>
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
                  <p className="workflow-canvas-agent-panel__text">{m.content}</p>
                </article>
              );
            }
            return (
              <article key={m.id} className="workflow-canvas-agent-panel__bubble is-assistant">
                <span className="workflow-canvas-agent-panel__who">
                  Agent{m.streaming ? ' · 进行中' : ''}
                </span>
                {steps.length > 0 ? <ToolRunTimeline steps={steps} /> : null}
                <div className="workflow-canvas-agent-panel__markdown">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {stripPseudoToolMarkup(m.content || '') || (m.streaming ? '…' : '')}
                  </ReactMarkdown>
                </div>
              </article>
            );
          })}

          {toolPending ? (
            <div className="workflow-canvas-agent-panel__bubble is-assistant">
              <p className="workflow-canvas-agent-panel__text">{toolPending.summary}</p>
              <div className="workflow-canvas-agent-panel__gate">
                <Button size="small" type="primary" loading={resumeLoading} onClick={onConfirmTool}>
                  确认
                </Button>
                <Button size="small" disabled={resumeLoading} onClick={onRejectTool}>
                  拒绝
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        <footer className="workflow-canvas-agent-panel__composer">
          <textarea
            className="workflow-canvas-agent-panel__input"
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
          <div className="workflow-canvas-agent-panel__composer-actions">
            <div className="workflow-canvas-agent-panel__composer-left">
              <StudioSegment
                aria-label="运行模式"
                value={mode}
                disabled={busy}
                onChange={onModeChange}
                options={[
                  { value: 'auto', label: '自动' },
                  { value: 'manual', label: '手动' },
                ]}
              />

              <Dropdown
                {...canvasDropdownProps({
                  items: modelMenuItems,
                  selectedKeys: modelKey ? [modelKey] : [],
                  onClick: ({ key }) => onModelChange(key),
                })}
                trigger={['click']}
                placement="topLeft"
                disabled={busy || chatModels.loading || modelMenuItems.length === 0}
              >
                <StudioChip
                  size="sm"
                  aria-label="对话模型"
                  title={selectedModelLabel}
                  disabled={busy || chatModels.loading || modelMenuItems.length === 0}
                >
                  <span className="workflow-canvas-agent-panel__chip-label">{selectedModelLabel}</span>
                  <DownOutlined className="workflow-canvas-agent-panel__chip-chevron" />
                </StudioChip>
              </Dropdown>
            </div>

            <StudioButton
              variant="primary"
              size="sm"
              onClick={busy ? onStop : handleSend}
              disabled={busy ? false : !canSend}
              aria-label={busy ? '停止生成' : '发送'}
              title={busy ? '停止生成' : modelKey ? '发送' : '暂无可用模型'}
            >
              {busy ? '停止' : '发送'}
            </StudioButton>
          </div>
        </footer>
      </div>
    </aside>
  );
}
