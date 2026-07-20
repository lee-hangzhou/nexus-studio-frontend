import { DownOutlined } from '@ant-design/icons';
import { Button, Dropdown, Spin } from 'antd';
import type { MenuProps } from 'antd';
import { canvasDropdownProps } from '../storyflow/constants/canvasDropdown';
import { useCallback, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ToolStepView } from '../../../api/chat';
import { ToolRunTimeline } from '../../chat/components/ToolRunTimeline';
import type { CanvasFeedMessage } from '../hooks/useCanvasMessages';
import { stripPseudoToolMarkup } from '../utils/stripPseudoToolMarkup';

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
  projectTitle,
  messages,
  loading,
  busy,
  mode,
  onModeChange,
  composer,
  onComposerChange,
  onSend,
  liveToolSteps,
  toolPending,
  onConfirmTool,
  onRejectTool,
  resumeLoading,
}: {
  projectTitle: string;
  messages: CanvasFeedMessage[];
  loading: boolean;
  busy: boolean;
  mode: CanvasAgentMode;
  onModeChange: (mode: CanvasAgentMode) => void;
  composer: string;
  onComposerChange: (v: string) => void;
  onSend: () => void;
  liveToolSteps: ToolStepView[];
  toolPending: { call_id: string; summary: string } | null;
  onConfirmTool: () => void;
  onRejectTool: () => void;
  resumeLoading: boolean;
}) {
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, liveToolSteps]);

  const handleSend = useCallback(() => {
    if (!composer.trim() || busy) return;
    onSend();
  }, [composer, busy, onSend]);

  const modeMenuItems: MenuProps['items'] = [
    { key: 'auto', label: 'auto' },
    { key: 'manual', label: 'manual' },
  ];

  return (
    <aside className="canvas-agent-float">
      <div className="workflow-canvas-agent-panel">
        <header className="workflow-canvas-agent-panel__head">
          <strong>{projectTitle}</strong>
          <span style={{ opacity: 0.65 }}>Agent</span>
        </header>
        <div className="workflow-canvas-agent-panel__feed" ref={feedRef}>
          {loading ? <Spin /> : null}
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
                  <p style={{ margin: 0 }}>{m.content}</p>
                </article>
              );
            }
            return (
              <article key={m.id} className="workflow-canvas-agent-panel__bubble is-assistant">
                {steps.length > 0 ? <ToolRunTimeline steps={steps} /> : null}
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {stripPseudoToolMarkup(m.content || '') || (m.streaming ? '…' : '')}
                </ReactMarkdown>
              </article>
            );
          })}
          {toolPending ? (
            <div className="workflow-canvas-agent-panel__bubble is-assistant">
              <p style={{ margin: '0 0 8px' }}>{toolPending.summary}</p>
              <Button size="small" type="primary" loading={resumeLoading} onClick={onConfirmTool}>
                确认
              </Button>{' '}
              <Button size="small" disabled={resumeLoading} onClick={onRejectTool}>
                拒绝
              </Button>
            </div>
          ) : null}
        </div>
        <footer className="workflow-canvas-agent-panel__composer">
          <textarea
            className="workflow-canvas-agent-panel__input"
            value={composer}
            onChange={(e) => onComposerChange(e.target.value)}
            placeholder="描述创意或画布修改…"
            rows={3}
            disabled={busy}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <div className="workflow-canvas-agent-panel__composer-actions">
            <Dropdown
              {...canvasDropdownProps({
                items: modeMenuItems,
                selectedKeys: [mode],
                onClick: ({ key }) => onModeChange(key as CanvasAgentMode),
              })}
              trigger={['click']}
              placement="topLeft"
              disabled={busy}
            >
              <button type="button" className="workflow-canvas-agent-panel__mode-select">
                <span>{mode}</span>
                <DownOutlined className="workflow-canvas-agent-panel__mode-chevron" />
              </button>
            </Dropdown>
            <button
              type="button"
              className="workflow-canvas-agent-panel__send"
              onClick={handleSend}
              disabled={busy || !composer.trim()}
            >
              发送
            </button>
          </div>
        </footer>
      </div>
    </aside>
  );
}
