import { CloseOutlined, FileOutlined } from '@ant-design/icons';

import { isImageMime } from '../hooks/useAttachmentUrl';

export type ComposerAttachmentChip = {
  id: string;
  filename: string;
  mime_type: string;
  preview_url?: string;
};

type Props = {
  attachments: ComposerAttachmentChip[];
  onRemove: (id: string) => void;
};

export function ComposerAttachmentList({ attachments, onRemove }: Props) {
  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className="studio-composer-box__attachments">
      {attachments.map((item) => {
        const isImage = isImageMime(item.mime_type) && Boolean(item.preview_url);
        return (
          <div key={item.id} className="studio-composer-chip">
            {isImage ? (
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
              onClick={() => onRemove(item.id)}
            >
              <CloseOutlined />
            </button>
          </div>
        );
      })}
    </div>
  );
}
