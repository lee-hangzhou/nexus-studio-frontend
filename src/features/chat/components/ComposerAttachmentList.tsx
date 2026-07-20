import { CloseOutlined, FileOutlined } from '@ant-design/icons';

import type { UploadedAttachment } from '../../../api/chat';
import { isImageMime } from '../hooks/useAttachmentUrl';

type Props = {
  attachments: UploadedAttachment[];
  onRemove: (attachmentId: number) => void;
};

export function ComposerAttachmentList({ attachments, onRemove }: Props) {
  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className="studio-composer-box__attachments">
      {attachments.map((item) => (
        <div key={item.attachment_id} className="studio-composer-chip">
          {isImageMime(item.mime_type) && item.preview_url ? (
            <img className="studio-composer-chip__thumb" src={item.preview_url} alt={item.filename} />
          ) : (
            <span className="studio-composer-chip__icon">
              <FileOutlined />
            </span>
          )}
          <span className="studio-composer-chip__name" title={item.filename}>
            {item.filename}
          </span>
          <button
            type="button"
            className="studio-composer-chip__remove"
            aria-label={`移除 ${item.filename}`}
            onClick={() => onRemove(item.attachment_id)}
          >
            <CloseOutlined />
          </button>
        </div>
      ))}
    </div>
  );
}
