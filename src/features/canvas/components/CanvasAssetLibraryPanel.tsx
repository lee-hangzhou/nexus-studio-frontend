import { Input, Pagination, Spin, message } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { listAssets } from '../../../api/assets';
import type { AssetBase } from '../../../domains/asset/types';
import { AssetGrid } from '../../assets/components/AssetGrid';
import type { AssetKindFilter } from '../../assets/constants';
import { ASSET_KIND_OPTIONS } from '../../assets/constants';
import { groupAssetsByDate } from '../../assets/utils/groupAssetsByDate';
import { StudioChip } from '../../../shared/ui/StudioChip';

const PAGE_SIZE = 40;

type CanvasAssetLibraryPanelProps = {
  onClose: () => void;
};

/** 画布素材库浮层面板（对齐 Storyflow：按日期分组 + 两列网格） */
export function CanvasAssetLibraryPanel({ onClose }: CanvasAssetLibraryPanelProps) {
  const [assets, setAssets] = useState<AssetBase[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<AssetKindFilter>('all');

  const loadAssets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listAssets({
        page,
        page_size: PAGE_SIZE,
        query,
        asset_type: kind,
        source_type: 'library',
      });
      if (res.items.length === 0 && res.total > 0 && page > 1) {
        setPage(Math.ceil(res.total / PAGE_SIZE));
        return;
      }
      setAssets(res.items);
      setTotal(res.total);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '素材列表加载失败');
      setAssets([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [kind, page, query]);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  const dateSections = useMemo(() => groupAssetsByDate(assets), [assets]);

  return (
    <section className="canvas-asset-library-panel nodrag nopan" aria-label="素材库">
      <header className="canvas-asset-library-panel__header">
        <h2 className="canvas-asset-library-panel__title">素材库</h2>
        <button
          type="button"
          className="canvas-asset-library-panel__close"
          aria-label="关闭素材库"
          onClick={onClose}
        >
          ×
        </button>
      </header>
      <div className="canvas-asset-library-panel__toolbar">
        <div className="canvas-asset-library-panel__kinds" role="group" aria-label="类型筛选">
          {ASSET_KIND_OPTIONS.map((option) => (
            <StudioChip
              key={option.value}
              active={kind === option.value}
              onClick={() => {
                setPage(1);
                setKind(option.value);
              }}
            >
              {option.label}
            </StudioChip>
          ))}
        </div>
        <Input
          className="canvas-asset-library-panel__search"
          prefix={<SearchOutlined />}
          placeholder="按资产名称搜索"
          value={query}
          allowClear
          onChange={(e) => {
            setPage(1);
            setQuery(e.target.value);
          }}
        />
      </div>
      <div className="canvas-asset-library-panel__body">
        {loading ? (
          <div className="canvas-asset-library-panel__loading">
            <Spin />
          </div>
        ) : dateSections.length === 0 ? (
          <div className="canvas-asset-library-panel__empty">暂无素材</div>
        ) : (
          <div className="canvas-asset-library-panel__feed">
            {dateSections.map((section) => (
              <section key={section.key} className="canvas-asset-library-panel__section">
                <h3 className="canvas-asset-library-panel__section-title">{section.dateLabel}</h3>
                <AssetGrid
                  items={section.items}
                  selectable={false}
                  selectedIds={new Set()}
                  onOpen={() => undefined}
                  onToggleSelect={() => undefined}
                  onMediaError={() => undefined}
                />
              </section>
            ))}
          </div>
        )}
      </div>
      {total > PAGE_SIZE ? (
        <div className="canvas-asset-library-panel__pager">
          <Pagination
            size="small"
            current={page}
            pageSize={PAGE_SIZE}
            total={total}
            showSizeChanger={false}
            onChange={setPage}
          />
        </div>
      ) : null}
    </section>
  );
}
