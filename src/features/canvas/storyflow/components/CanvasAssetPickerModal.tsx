import { Modal, Spin, message } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { listAssets } from '../../../../api/assets';
import type { AssetBase, AssetKind } from '../../../../domains/asset/types';
import { AssetGrid } from '../../../assets/components/AssetGrid';

export const CANVAS_ASSET_PICKER_MODAL_Z_INDEX = 1300;

export type CanvasAssetPickerModalProps = {
  open: boolean;
  onCancel: () => void;
  onSelect: (assets: AssetBase[]) => void;
  allowKinds?: AssetKind[];
  title?: string;
  maxCount?: number;
  zIndex?: number;
};

/** 画布提示栏加号：从资产库多选写入 library_refs */
export function CanvasAssetPickerModal({
  open,
  onCancel,
  onSelect,
  allowKinds = ['image'],
  title = '选择资产',
  maxCount = 6,
  zIndex = CANVAS_ASSET_PICKER_MODAL_Z_INDEX,
}: CanvasAssetPickerModalProps) {
  const [loading, setLoading] = useState(false);
  const [assets, setAssets] = useState<AssetBase[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!open) {
      setSelectedIds(new Set());
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const kind = allowKinds.length === 1 ? allowKinds[0] : 'all';
        const res = await listAssets({
          page: 1,
          page_size: 60,
          asset_type: kind,
          source_type: 'library',
        });
        if (cancelled) return;
        setAssets(
          res.items.filter((item) => allowKinds.length === 0 || allowKinds.includes(item.kind)),
        );
      } catch (err) {
        if (!cancelled) {
          message.error(err instanceof Error ? err.message : '资产列表加载失败');
          setAssets([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [allowKinds, open]);

  const toggleSelect = useCallback(
    (id: string) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
          return next;
        }
        if (next.size >= maxCount) {
          message.warning(`最多选择 ${maxCount} 个资产`);
          return prev;
        }
        next.add(id);
        return next;
      });
    },
    [maxCount],
  );

  const handleOk = useCallback(() => {
    const picked = assets.filter((item) => selectedIds.has(item.id));
    onSelect(picked);
  }, [assets, onSelect, selectedIds]);

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onCancel}
      onOk={handleOk}
      okText={`确定（${selectedIds.size}）`}
      okButtonProps={{ disabled: selectedIds.size === 0 }}
      width={720}
      zIndex={zIndex}
      destroyOnClose
    >
      {loading ? (
        <div style={{ display: 'grid', placeItems: 'center', minHeight: 240 }}>
          <Spin />
        </div>
      ) : (
        <AssetGrid
          items={assets}
          selectable
          selectedIds={selectedIds}
          onOpen={() => undefined}
          onToggleSelect={toggleSelect}
          onMediaError={() => undefined}
        />
      )}
    </Modal>
  );
}
