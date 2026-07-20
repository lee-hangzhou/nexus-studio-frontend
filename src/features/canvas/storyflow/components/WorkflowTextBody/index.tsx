import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react';
import './WorkflowTextBody.less';

type Props = {
  value: string;
  selected?: boolean;
  placeholder?: string;
  readOnly?: boolean;
  onChange: (value: string) => void;
};

/**
 * 文本节点正文：默认只读展示，双击进入编辑（对齐 storyflow TextRichEditor 交互，无 TipTap 依赖）。
 */
export function WorkflowTextBody({
  value,
  selected = false,
  placeholder = '双击开始编辑',
  readOnly = false,
  onChange,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const rootRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isEditing) {
      setDraft(value);
    }
  }, [value, isEditing]);

  useEffect(() => {
    if (isEditing) {
      textareaRef.current?.focus();
    }
  }, [isEditing]);

  const shouldCaptureEditorMouseEvent = (detail: number): boolean => isEditing || detail >= 2;

  const handleEditorPointerDownCapture = (e: PointerEvent<HTMLDivElement>) => {
    if (!shouldCaptureEditorMouseEvent(e.detail)) return;
    e.stopPropagation();
  };

  const handleEditorMouseDownCapture = (e: MouseEvent<HTMLDivElement>) => {
    if (!shouldCaptureEditorMouseEvent(e.detail)) return;
    e.stopPropagation();
  };

  const handleEditorDoubleClick = (e: MouseEvent<HTMLDivElement>) => {
    if (readOnly) return;
    e.stopPropagation();
    setDraft(value);
    setIsEditing(true);
  };

  const commitEdit = useCallback(() => {
    setIsEditing(false);
    if (draft !== value) {
      onChange(draft);
    }
  }, [draft, onChange, value]);

  const handleEditorBlur = (e: FocusEvent<HTMLDivElement>) => {
    const nextTarget = e.relatedTarget;
    if (nextTarget instanceof Node && rootRef.current?.contains(nextTarget)) {
      return;
    }
    commitEdit();
  };

  const safeValue = value ?? '';
  const isEmpty = !safeValue.trim();

  return (
    <div
      ref={rootRef}
      className="workflow-text-rich-editor nowheel"
      data-empty={isEmpty ? 'true' : 'false'}
    >
      {selected && isEditing ? (
        <div className="workflow-text-rich-editor__toolbar nodrag nopan" aria-label="文本编辑">
          <span className="workflow-text-rich-editor__hint">编辑中</span>
        </div>
      ) : null}
      <div
        className={`workflow-text-rich-editor__content${isEditing ? ' nodrag nopan' : ''}`}
        onPointerDownCapture={handleEditorPointerDownCapture}
        onMouseDownCapture={handleEditorMouseDownCapture}
        onDoubleClick={handleEditorDoubleClick}
        onBlur={handleEditorBlur}
      >
        {isEditing ? (
          <textarea
            ref={textareaRef}
            className="workflow-text-rich-editor__prosemirror workflow-text-rich-editor__textarea"
            value={draft}
            placeholder={placeholder}
            onChange={(e) => setDraft(e.target.value)}
            onPointerDown={(e) => e.stopPropagation()}
          />
        ) : (
          <div
            className="workflow-text-rich-editor__prosemirror workflow-text-rich-editor__readonly"
            data-placeholder={placeholder}
          >
            {safeValue.trim() ? safeValue : null}
          </div>
        )}
      </div>
    </div>
  );
}
