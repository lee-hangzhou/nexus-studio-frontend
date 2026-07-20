import { useEffect, useState } from 'react';

import { getAttachmentPreviewUrl, type MessageAttachment } from '../../../api/chat';

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
  return mimeType.startsWith('image/');
}
