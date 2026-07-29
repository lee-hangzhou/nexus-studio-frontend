import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getTaskStatus } from '../../../../../api/generate';
import type { CanvasNodeKind } from '../../../api/canvasTypes';

type Props = {
  kind: CanvasNodeKind;
  status: string;
  taskId?: number;
  assetUrls?: string[];
  /** 稳定身份：同 asset 只换签不重载媒体 */
  assetIds?: number[];
};

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function sameStringList(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function sameIdList(a: number[] | undefined, b: number[] | undefined): boolean {
  const left = a ?? [];
  const right = b ?? [];
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) return false;
  }
  return true;
}

/** 节点预览区优先使用后端按资产 ID 生成的 URL，必要时按 task_id 刷新。 */
export function NodeMediaPreview({ kind, status, taskId, assetUrls, assetIds }: Props) {
  const [urls, setUrls] = useState<string[]>([]);
  const refreshAttemptedRef = useRef(false);
  const boundAssetIdsRef = useRef<number[]>([]);
  const urlsRef = useRef<string[]>([]);
  urlsRef.current = urls;

  const fromAssets = useMemo(
    () => (assetUrls ?? []).filter((url) => isHttpUrl(url)),
    // 用 join 稳定依赖，避免父级每次新数组引用刷 effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [assetUrls?.join('\0') ?? ''],
  );

  const assetIdKey = (assetIds ?? []).join(',');

  const applyUrls = useCallback((next: string[], nextAssetIds?: number[]) => {
    if (next.length === 0) {
      if (urlsRef.current.length === 0) return;
      setUrls([]);
      boundAssetIdsRef.current = [];
      return;
    }
    const ids = nextAssetIds ?? boundAssetIdsRef.current;
    const sameAsset = sameIdList(boundAssetIdsRef.current, ids);
    const hasPlayback = urlsRef.current.length > 0;
    // 同一资产仅轮换预签名：保留当前 src，避免 video 重载
    if (sameAsset && hasPlayback && ids.length > 0) {
      return;
    }
    if (sameStringList(urlsRef.current, next)) {
      boundAssetIdsRef.current = ids;
      return;
    }
    setUrls(next);
    boundAssetIdsRef.current = ids;
  }, []);

  const refreshFromTask = useCallback(async () => {
    if (!taskId || (status !== 'success' && status !== 'running')) return;
    try {
      const view = await getTaskStatus(taskId);
      const next = view.result_urls?.map((r: { url: string }) => r.url).filter(Boolean) ?? [];
      if (next.length > 0) {
        refreshAttemptedRef.current = false;
        applyUrls(next, assetIds);
      }
    } catch {
      /* keep the current preview and allow the surrounding UI to remain usable */
    }
  }, [applyUrls, assetIds, status, taskId]);

  useEffect(() => {
    if (fromAssets.length > 0) {
      // 资产 ID 变了才允许 error 重试；同资产换签不重置
      if (!sameIdList(boundAssetIdsRef.current, assetIds)) {
        refreshAttemptedRef.current = false;
      }
      applyUrls(fromAssets, assetIds);
      return;
    }
    if (status !== 'success' && status !== 'running') {
      applyUrls([]);
      return;
    }
    if (!taskId) {
      applyUrls([]);
      return;
    }
    // 已有可播 URL 且资产未清空时，不要因短暂丢 URL 清空预览
    if (urlsRef.current.length > 0 && (assetIds?.length ?? 0) > 0) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const view = await getTaskStatus(taskId);
        if (cancelled) return;
        const next = view.result_urls?.map((r: { url: string }) => r.url).filter(Boolean) ?? [];
        if (next.length > 0) applyUrls(next, assetIds);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyUrls, assetIdKey, assetIds, fromAssets, status, taskId]);

  const handleMediaError = () => {
    if (refreshAttemptedRef.current) return;
    refreshAttemptedRef.current = true;
    void refreshFromTask();
  };

  const src = urls[0];
  if (!src) return null;

  const mediaKey = assetIdKey || src;

  if (kind === 'video') {
    return (
      <video
        key={mediaKey}
        className="workflow-image-node__image"
        src={src}
        controls
        playsInline
        muted
        onError={handleMediaError}
      />
    );
  }

  return (
    <img
      key={mediaKey}
      className="workflow-image-node__image"
      src={src}
      alt=""
      onError={handleMediaError}
    />
  );
}
