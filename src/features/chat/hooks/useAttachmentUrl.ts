import { useEffect, useState } from 'react';

import { getAttachmentPreviewUrl, type MessageAttachment } from '../../../api/chat';

const IMAGE_EXTENSIONS = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'bmp',
  'svg',
  'avif',
  'heic',
  'heif',
]);

export function useAttachmentUrl(attachment: MessageAttachment): { url: string; loading: boolean } {
  const [url, setUrl] = useState(attachment.preview_url ?? '');
  const [loading, setLoading] = useState(!attachment.preview_url);

  useEffect(() => {
    if (attachment.preview_url) {
      setUrl(attachment.preview_url);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const preview = await getAttachmentPreviewUrl(attachment.attachment_id);
        if (!cancelled) {
          setUrl(preview.url);
        }
      } catch {
        if (!cancelled) {
          setUrl('');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attachment.attachment_id, attachment.preview_url]);

  return { url, loading };
}

export function isImageMime(mimeType: string): boolean {
  return mimeType.toLowerCase().startsWith('image/');
}

/** mime 或扩展名任一判定为图片即可（publish_file 等路径常落成 octet-stream）。 */
export function isImageAttachment(attachment: Pick<MessageAttachment, 'mime_type' | 'filename'>): boolean {
  if (isImageMime(attachment.mime_type)) return true;
  const filename = attachment.filename ?? '';
  const dot = filename.lastIndexOf('.');
  if (dot < 0) return false;
  return IMAGE_EXTENSIONS.has(filename.slice(dot + 1).toLowerCase());
}
