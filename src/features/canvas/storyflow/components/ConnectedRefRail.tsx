import { AudioOutlined, FileTextOutlined, PlayCircleOutlined } from '@ant-design/icons';
import type { WorkflowMentionItem } from './CanvasPromptEditor/types';

type Props = {
  items: WorkflowMentionItem[];
};

/** Prompt 顶栏：展示连线前置节点的媒体缩略图 */
export function ConnectedRefRail({ items }: Props) {
  if (items.length === 0) {
    return null;
  }
  return (
    <div className="workflow-image-prompt-ref-rail">
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
        </div>
      ))}
    </div>
  );
}
