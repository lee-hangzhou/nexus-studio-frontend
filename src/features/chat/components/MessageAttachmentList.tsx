import { CloudDownloadOutlined, DownloadOutlined, LoadingOutlined } from '@ant-design/icons';
import { Image } from 'antd';

import type { MessageAttachment } from '../../../api/chat';
import { isImageMime, useAttachmentUrl } from '../hooks/useAttachmentUrl';
import { FileTypeIcon } from './FileTypeIcon';

function AttachmentImage({ attachment }: { attachment: MessageAttachment }) {
  const { url, loading } = useAttachmentUrl(attachment);

  if (loading) {
    return (
      <div className="studio-bubble__attachment studio-bubble__attachment--loading">
        <LoadingOutlined spin />
      </div>
    );
  }

  if (!url) {
    return <AttachmentFile attachment={attachment} />;
  }

  return (
    <div className="studio-bubble__attachment studio-bubble__attachment--image">
      <Image
        src={url}
        alt={attachment.filename}
        preview={{ mask: false }}
        rootClassName="studio-bubble__attachment-image"
      />
      <div className="studio-bubble__attachment-toolbar">
        <a
          className="studio-bubble__attachment-toolbar-btn"
          href={url}
          download={attachment.filename}
          title={`下载 ${attachment.filename}`}
          aria-label={`下载 ${attachment.filename}`}
          onClick={(event) => event.stopPropagation()}
        >
          <CloudDownloadOutlined />
        </a>
      </div>
    </div>
  );
}

function AttachmentFile({ attachment }: { attachment: MessageAttachment }) {
  const { url, loading } = useAttachmentUrl(attachment);

  if (loading) {
    return (
      <div className="studio-bubble__attachment studio-bubble__attachment--file studio-bubble__attachment--loading">
        <LoadingOutlined spin />
        <span>加载中…</span>
      </div>
    );
  }

  if (!url) {
    return (
      <div className="studio-bubble__attachment studio-bubble__attachment--file studio-bubble__attachment--disabled">
        <FileTypeIcon mime={attachment.mime_type} filename={attachment.filename} size={18} />
        <span>{attachment.filename}</span>
      </div>
    );
  }

  return (
    <a
      className="studio-bubble__attachment studio-bubble__attachment--file"
      href={url}
      target="_blank"
      rel="noreferrer"
      download={attachment.filename}
      title={`下载 ${attachment.filename}`}
    >
      <FileTypeIcon mime={attachment.mime_type} filename={attachment.filename} size={18} />
      <span className="studio-bubble__attachment-name">{attachment.filename}</span>
      <DownloadOutlined className="studio-bubble__attachment-download" />
    </a>
  );
}

export function MessageAttachmentList({ attachments }: { attachments: MessageAttachment[] }) {
  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className="studio-bubble__attachments">
      {attachments.map((attachment) =>
        isImageMime(attachment.mime_type) ? (
          <AttachmentImage key={attachment.attachment_id} attachment={attachment} />
        ) : (
          <AttachmentFile key={attachment.attachment_id} attachment={attachment} />
        ),
      )}
    </div>
  );
}

function parseAttachmentEntries(raw: unknown): MessageAttachment[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const items: MessageAttachment[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }
    const record = entry as Record<string, unknown>;
    const attachmentId = record.attachment_id;
    const filename = record.filename;
    const mimeType = record.mime_type;
    const previewUrl = record.preview_url;
    if (typeof attachmentId !== 'number' || typeof filename !== 'string' || typeof mimeType !== 'string') {
      continue;
    }
    items.push({
      attachment_id: attachmentId,
      filename,
      mime_type: mimeType,
      preview_url: typeof previewUrl === 'string' ? previewUrl : undefined,
    });
  }
  return items;
}

export function getMessageAttachments(metadata: Record<string, unknown>): MessageAttachment[] {
  const fromAttachments = parseAttachmentEntries(metadata.attachments);
  if (fromAttachments.length > 0) {
    return fromAttachments;
  }
  return parseAttachmentEntries(metadata.artifacts);
}
