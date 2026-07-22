import { DownloadOutlined, LoadingOutlined, PlusOutlined } from '@ant-design/icons';

import type { ChatMessageView, MessageAttachment } from '../../../api/chat';
import { StudioButton } from '../../../shared/ui/StudioButton';
import { StudioChip } from '../../../shared/ui/StudioChip';
import { isImageAttachment, useAttachmentUrl } from '../hooks/useAttachmentUrl';
import { AttachmentImagePreview } from './AttachmentImagePreview';
import { FileTypeIcon, fileTypeLabel } from './FileTypeIcon';
import { getMessageAttachments } from './MessageAttachmentList';

function DownloadLink({ url, filename }: { url: string; filename: string }) {
  return (
    <a
      className="studio-panel__file-download"
      href={url}
      target="_blank"
      rel="noreferrer"
      download={filename}
      title={`下载 ${filename}`}
      aria-label={`下载 ${filename}`}
      onClick={(event) => event.stopPropagation()}
    >
      <DownloadOutlined />
    </a>
  );
}

/** 生成内容 / 参考素材共用行：与气泡共用 AttachmentImagePreview */
function PanelAttachmentRow({ attachment }: { attachment: MessageAttachment }) {
  const { url, loading } = useAttachmentUrl(attachment);
  const image = isImageAttachment(attachment);

  return (
    <div className="studio-panel__file">
      <div className={`studio-panel__ref-thumb${image ? '' : ' studio-panel__ref-thumb--icon'}`}>
        {loading ? (
          <LoadingOutlined className="studio-panel__ref-thumb-loading" />
        ) : image && url ? (
          <AttachmentImagePreview
            url={url}
            filename={attachment.filename}
            className="studio-panel__ref-thumb-frame"
            imageClassName="studio-panel__ref-thumb-img"
          />
        ) : (
          <FileTypeIcon mime={attachment.mime_type} filename={attachment.filename} size={16} />
        )}
      </div>
      <div className="studio-panel__file-info">
        <div className="studio-panel__file-name" title={attachment.filename}>
          {attachment.filename}
        </div>
        <div className="studio-panel__file-size">
          {fileTypeLabel(attachment.mime_type, attachment.filename)}
        </div>
      </div>
      {url ? <DownloadLink url={url} filename={attachment.filename} /> : null}
    </div>
  );
}

function dedupeById(attachments: MessageAttachment[]): MessageAttachment[] {
  const seen = new Set<number>();
  const result: MessageAttachment[] = [];
  for (const attachment of attachments) {
    if (seen.has(attachment.attachment_id)) continue;
    seen.add(attachment.attachment_id);
    result.push(attachment);
  }
  return result;
}

interface ChatRightPanelProps {
  messages: ChatMessageView[];
  onAddRef?: () => void;
  onCollapse?: () => void;
}

export function ChatRightPanel({ messages, onAddRef, onCollapse }: ChatRightPanelProps) {
  const generated = dedupeById(
    messages
      .filter((message) => message.role === 'assistant')
      .flatMap((message) => getMessageAttachments(message.metadata)),
  );

  const refMaterials = dedupeById(
    messages
      .filter((message) => message.role === 'user')
      .flatMap((message) => getMessageAttachments(message.metadata)),
  );

  return (
    <aside className="studio-chat__panel" id="studio-chat-resources-panel">
      <div className="studio-panel__head">
        <strong className="studio-panel__title">当前会话资源</strong>
        {onCollapse ? (
          <StudioChip size="sm" onClick={onCollapse}>
            收起
          </StudioChip>
        ) : null}
      </div>

      <div className="studio-panel__section">
        <div className="studio-panel__section-header">
          <span className="studio-panel__section-title">
            生成内容{generated.length > 0 ? ` (${generated.length})` : ''}
          </span>
          {generated.length > 0 ? (
            <StudioButton variant="text" title="全部保存到资产">
              全部保存
            </StudioButton>
          ) : null}
        </div>

        {generated.length === 0 ? (
          <div className="studio-panel__placeholder">暂无生成内容</div>
        ) : (
          generated.map((attachment) => (
            <PanelAttachmentRow key={attachment.attachment_id} attachment={attachment} />
          ))
        )}
      </div>

      <div className="studio-panel__section">
        <div className="studio-panel__section-header">
          <span className="studio-panel__section-title">
            参考素材{refMaterials.length > 0 ? ` (${refMaterials.length})` : ''}
          </span>
        </div>

        {refMaterials.length === 0 ? (
          <div className="studio-panel__placeholder">暂无参考素材</div>
        ) : (
          refMaterials.map((attachment) => (
            <PanelAttachmentRow key={attachment.attachment_id} attachment={attachment} />
          ))
        )}

        <button type="button" className="studio-panel__add-btn" onClick={onAddRef}>
          <PlusOutlined />
          添加参考素材
        </button>
      </div>
    </aside>
  );
}
