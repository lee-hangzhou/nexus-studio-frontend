import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getTaskStatus } from '../../../../../api/generate';
import type { CanvasNodeKind } from '../../../api/canvasTypes';

type Props = {
  kind: CanvasNodeKind;
  status: string;
  taskId?: number;
  assetUrls?: string[];
};

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

/** 节点预览区优先使用后端按资产 ID 生成的 URL，必要时按 task_id 刷新。 */
export function NodeMediaPreview({ kind, status, taskId, assetUrls }: Props) {
  const [urls, setUrls] = useState<string[]>([]);
  const refreshAttemptedRef = useRef(false);

  const fromAssets = useMemo(
    () => (assetUrls ?? []).filter((url) => isHttpUrl(url)),
    [assetUrls],
  );

  const refreshFromTask = useCallback(async () => {
    if (!taskId || (status !== 'success' && status !== 'running')) return;
    try {
      const view = await getTaskStatus(taskId);
      const next = view.result_urls?.map((r: { url: string }) => r.url).filter(Boolean) ?? [];
      if (next.length > 0) setUrls(next);
    } catch {
      /* keep the current preview and allow the surrounding UI to remain usable */
    }
  }, [status, taskId]);

  useEffect(() => {
    refreshAttemptedRef.current = false;
    if (fromAssets.length > 0) {
      setUrls(fromAssets);
      return;
    }
    if (status !== 'success' && status !== 'running') {
      setUrls([]);
      return;
    }
    if (!taskId) {
      setUrls([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const view = await getTaskStatus(taskId);
        if (cancelled) return;
        const next = view.result_urls?.map((r: { url: string }) => r.url).filter(Boolean) ?? [];
        if (next.length > 0) setUrls(next);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fromAssets, status, taskId]);

  const handleMediaError = () => {
    if (refreshAttemptedRef.current) return;
    refreshAttemptedRef.current = true;
    void refreshFromTask();
  };

  const src = urls[0];
  if (!src) return null;

  if (kind === 'video') {
    return (
      <video
        className="workflow-image-node__image"
        src={src}
        controls
        playsInline
        muted
        onError={handleMediaError}
      />
    );
  }

  return <img className="workflow-image-node__image" src={src} alt="" onError={handleMediaError} />;
}
