import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { Position } from '@xyflow/react';
import { CanvasPlusHandle } from '../CanvasPlusHandle';
import './BaseCanvasNode.less';

export function BaseCanvasNode({
  title,
  onTitleChange,
  icon,
  variant: _variant = 'default',
  dragging = false,
  allowBodyOverflow = false,
  children,
}: {
  title: string;
  /** 提交后写回节点 data.title */
  onTitleChange?: (title: string) => void;
  icon?: ReactNode;
  variant?: 'default' | 'light';
  /** 节点拖拽中：隐藏左右连接点 */
  dragging?: boolean;
  /** 为 true 时 body 不裁切节点下方悬浮面板 */
  allowBodyOverflow?: boolean;
  children: ReactNode;
}) {
  const editable = Boolean(onTitleChange);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) {
      setDraft(title);
    }
  }, [title, editing]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commitTitle = useCallback(() => {
    const trimmed = draft.trim();
    setEditing(false);
    if (!trimmed || trimmed === title) {
      setDraft(title);
      return;
    }
    onTitleChange?.(trimmed);
  }, [draft, onTitleChange, title]);

  const cancelEdit = useCallback(() => {
    setDraft(title);
    setEditing(false);
  }, [title]);

  const handleLabelPointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
  }, []);

  const handleTextClick = useCallback(() => {
    if (!editable || editing) {
      return;
    }
    setDraft(title);
    setEditing(true);
  }, [editable, editing, title]);

  const handleInputKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        e.preventDefault();
        commitTitle();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelEdit();
      }
    },
    [cancelEdit, commitTitle]
  );

  return (
    <div className="workflow-canvas-node-wrap">
      <div
        className={`workflow-canvas-node__label${editable ? ' workflow-canvas-node__label--editable' : ''}`}
        onPointerDown={handleLabelPointerDown}
      >
        <span className="workflow-canvas-node__label-icon">{icon}</span>
        {editing ? (
          <input
            ref={inputRef}
            className="workflow-canvas-node__label-text"
            value={draft}
            size={Math.max(1, Math.min(64, draft.length || title.length || 1))}
            maxLength={64}
            aria-label="节点名称"
            onChange={e => setDraft(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={handleInputKeyDown}
            onPointerDown={e => e.stopPropagation()}
          />
        ) : (
          <span
            className="workflow-canvas-node__label-text"
            role={editable ? 'button' : undefined}
            tabIndex={editable ? 0 : undefined}
            title={editable ? '点击编辑名称' : undefined}
            onClick={handleTextClick}
            onKeyDown={e => {
              if (!editable) {
                return;
              }
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleTextClick();
              }
            }}
          >
            {title}
          </span>
        )}
      </div>
      <div
        className={`workflow-canvas-node${dragging ? ' workflow-canvas-node--dragging' : ''}`}
      >
        <CanvasPlusHandle type="target" position={Position.Left} hidden={dragging} />
        <div
          className={`workflow-canvas-node__body${allowBodyOverflow ? ' workflow-canvas-node__body--overflow-visible' : ''}`}
        >
          {children}
        </div>
        <CanvasPlusHandle type="source" position={Position.Right} hidden={dragging} />
      </div>
    </div>
  );
}
