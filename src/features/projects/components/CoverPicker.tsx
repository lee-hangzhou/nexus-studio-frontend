import { Button, Empty, Modal, Spin, message } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { listAssets } from '../../../api/assets';
import type { AssetBase } from '../../../domains/asset/types';
import styles from './CoverPicker.module.css';

type Props = {
  open: boolean;
  title: string;
  onCancel: () => void;
  onSelect: (assetId: number) => Promise<void> | void;
  onClear: () => Promise<void> | void;
};

export function CoverPicker({ open, title, onCancel, onSelect, onClear }: Props) {
  const [items, setItems] = useState<AssetBase[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [failedIds, setFailedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setItems([]);
    setLoading(true);
    setLoadError(null);
    setFailedIds(new Set());
    void Promise.all([
      listAssets({ page: 1, page_size: 80, asset_type: 'image' }, { signal: controller.signal }),
      listAssets({ page: 1, page_size: 80, asset_type: 'video' }, { signal: controller.signal }),
    ])
      .then(([images, videos]) => {
        if (controller.signal.aborted) return;
        const byId = new Map<string, AssetBase>();
        [...images.items, ...videos.items]
          .filter((item) => item.status === 'ready' && (item.kind === 'image' || item.kind === 'video'))
          .forEach((item) => byId.set(item.id, item));
        setItems(Array.from(byId.values()));
      })
      .catch((err) => {
        if (controller.signal.aborted || (err instanceof DOMException && err.name === 'AbortError')) return;
        setItems([]);
        setLoadError(err instanceof Error ? err.message : '封面资产加载失败');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => {
      controller.abort();
    };
  }, [open, reloadToken]);

  const visualItems = useMemo(() => items.filter((item) => !failedIds.has(item.id)), [failedIds, items]);

  const run = async (action: () => Promise<void> | void) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await action();
      onCancel();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '封面更新失败');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (submitting) return;
    onCancel();
  };

  return (
    <Modal
      title={title}
      open={open}
      onCancel={handleCancel}
      maskClosable={!submitting}
      closable={!submitting}
      keyboard={!submitting}
      footer={[
        <Button key="clear" danger disabled={submitting} onClick={() => void run(onClear)}>
          清空封面
        </Button>,
        <Button key="cancel" disabled={submitting} onClick={handleCancel}>
          取消
        </Button>,
      ]}
      destroyOnClose
      width={720}
    >
      {loading ? (
        <div className={styles.loading}>
          <Spin />
        </div>
      ) : loadError ? (
        <Empty description={loadError}>
          <Button type="link" onClick={() => setReloadToken((token) => token + 1)}>
            重试
          </Button>
        </Empty>
      ) : visualItems.length === 0 ? (
        <Empty description="暂无可用图片或视频资产" />
      ) : (
        <div className={styles.grid}>
          {visualItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={styles.asset}
              disabled={submitting}
              onClick={() => void run(() => onSelect(Number(item.id)))}
              title={item.title}
            >
              {item.kind === 'video' ? (
                <video
                  src={item.previewUrl}
                  muted
                  playsInline
                  preload="metadata"
                  aria-label={item.title}
                  onError={() => setFailedIds((prev) => new Set(prev).add(item.id))}
                />
              ) : (
                <img
                  src={item.previewUrl}
                  alt={item.title}
                  loading="lazy"
                  onError={() => setFailedIds((prev) => new Set(prev).add(item.id))}
                />
              )}
              <span>{item.title}</span>
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}
