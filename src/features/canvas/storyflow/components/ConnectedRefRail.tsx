import { CloseOutlined } from '@ant-design/icons';
import { AudioOutlined, FileTextOutlined, PlayCircleOutlined } from '@ant-design/icons';
import type { WorkflowMentionItem } from './CanvasPromptEditor/types';

type Props = {
  items: WorkflowMentionItem[];
  onRemove?: (itemId: string) => void;
};

/** Prompt 顶栏：展示连线前置节点的媒体缩略图；可删并断连线 */
export function ConnectedRefRail({ items, onRemove }: Props) {
  if (items.length === 0) {
    return null;
  }
  return (
    <>
      {items.map((item) => (
        <div
          key={item.id}
          className="workflow-image-prompt-ref-rail__thumb workflow-image-prompt-ref-rail__thumb--connected"
          title={item.name ?? item.label}
        >
          {item.type === 'text' ? (
            <span className="workflow-image-prompt-ref-rail__icon" aria-hidden>
              <FileTextOutlined />
            </span>
          ) : item.type === 'audio' ? (
            <span className="workflow-image-prompt-ref-rail__icon" aria-hidden>
              <AudioOutlined />
            </span>
          ) : item.previewUrl ? (
            <>
              <img src={item.previewUrl} alt="" />
              {item.type === 'video' ? (
                <span className="workflow-image-prompt-ref-rail__video-badge" aria-hidden>
                  <PlayCircleOutlined />
                </span>
              ) : null}
            </>
          ) : null}
          {onRemove ? (
            <button
              type="button"
              className="workflow-image-prompt-ref-rail__thumb-remove"
              aria-label={`移除引用 ${item.name ?? item.label ?? item.id}`}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onRemove(item.id);
              }}
            >
              <CloseOutlined aria-hidden />
            </button>
          ) : null}
        </div>
      ))}
    </>
  );
}
