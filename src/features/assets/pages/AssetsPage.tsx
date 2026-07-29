import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, Input, Pagination, Spin, message } from 'antd';
import {
  deleteAssets,
  getAsset,
  listAssets,
  renameAsset,
  updateAssetFavorite,
  uploadAsset,
} from '../../../api/assets';
import type { AssetBase } from '../../../domains/asset/types';
import type { Dayjs } from 'dayjs';
import { useStudioApp } from '../../../shared/ui/useStudioApp';
import type { AssetKindFilter, AssetSourceFilter } from '../constants';
import { AssetBatchBar } from '../components/AssetBatchBar';
import { AssetGrid } from '../components/AssetGrid';
import { AssetToolbar } from '../components/AssetToolbar';
import { groupAssetsByDate } from '../utils/groupAssetsByDate';

const ASSET_SOURCE_TO_BACKEND: Record<AssetSourceFilter, string> = {
  all: 'library',
  generate: 'generate_result',
  chat: 'chat_upload',
  canvas: 'agent_upload',
  import: 'manual_upload',
};

const ASSET_PAGE_SIZE = 40;

export function AssetsPage() {
  const { modal } = useStudioApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const fromGenerate = searchParams.get('source') === 'generate';

  const [assets, setAssets] = useState<AssetBase[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<AssetKindFilter>('all');
  const [source, setSource] = useState<AssetSourceFilter>(fromGenerate ? 'generate' : 'all');
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [previewAsset, setPreviewAsset] = useState<AssetBase | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const refreshedAssetIdsRef = useRef<Set<string>>(new Set());

  const loadAssets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listAssets({
        page,
        page_size: ASSET_PAGE_SIZE,
        query,
        asset_type: kind,
        source_type: ASSET_SOURCE_TO_BACKEND[source],
        favorites_only: favoritesOnly,
        created_from: dateRange?.[0]?.startOf('day').toISOString() ?? null,
        created_to: dateRange?.[1]?.endOf('day').toISOString() ?? null,
      });
      if (res.items.length === 0 && res.total > 0 && page > 1) {
        setPage(Math.ceil(res.total / ASSET_PAGE_SIZE));
        return;
      }
      setAssets(res.items);
      setTotal(res.total);
      setSelectedIds((prev) => new Set([...prev].filter((id) => res.items.some((item) => item.id === id))));
    } catch (err) {
      message.error(err instanceof Error ? err.message : '资源列表加载失败');
      setAssets([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [dateRange, favoritesOnly, kind, page, query, source]);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  useEffect(() => {
    if (fromGenerate) {
      setPage(1);
      setSource('generate');
    }
  }, [fromGenerate]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const refreshAssetPreview = useCallback(async (asset: AssetBase) => {
    if (refreshedAssetIdsRef.current.has(asset.id)) return;
    refreshedAssetIdsRef.current.add(asset.id);
    try {
      const refreshed = await getAsset(asset.id);
      setAssets((prev) => prev.map((item) => (item.id === refreshed.id ? refreshed : item)));
      setPreviewAsset((prev) => (prev?.id === refreshed.id ? refreshed : prev));
    } catch {
      /* A broken object should not make the whole asset grid fail. */
    }
  }, []);

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const handleUpload = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const asset = await uploadAsset(file);
      message.success('上传成功');
      setTotal((value) => value + 1);
      if (page === 1) {
        setAssets((prev) => [asset, ...prev].slice(0, ASSET_PAGE_SIZE));
      } else {
        setPage(1);
      }
    } catch (err) {
      message.error(err instanceof Error ? err.message : '上传失败');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleToggleFavorite = async (asset: AssetBase) => {
    try {
      const updated = await updateAssetFavorite(asset.id, !asset.favorite);
      setAssets((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setPreviewAsset((prev) => (prev?.id === updated.id ? updated : prev));
    } catch (err) {
      message.error(err instanceof Error ? err.message : '收藏状态更新失败');
    }
  };

  const handleRename = async (asset: AssetBase, filename: string) => {
    const nextName = filename.trim();
    if (!nextName) {
      message.warning('请输入资源名称');
      return;
    }
    try {
      const updated = await renameAsset(asset.id, nextName);
      setAssets((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setPreviewAsset((prev) => (prev?.id === updated.id ? updated : prev));
      message.success('已重命名');
    } catch (err) {
      message.error(err instanceof Error ? err.message : '重命名失败');
    }
  };

  const removeAssetsFromPage = (ids: string[]) => {
    const idSet = new Set(ids);
    setAssets((prev) => prev.filter((item) => !idSet.has(item.id)));
    setSelectedIds((prev) => new Set([...prev].filter((id) => !idSet.has(id))));
    setTotal((value) => Math.max(0, value - ids.length));
    setPreviewAsset((prev) => (prev && idSet.has(prev.id) ? null : prev));
  };

  const handleDelete = async (ids: string[]) => {
    if (ids.length === 0) return;
    modal.confirm({
      title: ids.length === 1 ? '删除这个资源？' : `删除选中的 ${ids.length} 个资源？`,
      content: '删除后不会在资源库中显示',
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteAssets(ids);
          removeAssetsFromPage(ids);
          const nextTotal = Math.max(0, total - ids.length);
          const lastPage = Math.max(1, Math.ceil(nextTotal / ASSET_PAGE_SIZE));
          if (page > lastPage) setPage(lastPage);
          message.success('已删除');
        } catch (err) {
          message.error(err instanceof Error ? err.message : '删除失败');
        }
      },
    });
  };

  const clearGenerateFilter = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('source');
    setSearchParams(next, { replace: true });
    setSource('all');
  };

  const dateSections = useMemo(() => groupAssetsByDate(assets), [assets]);

  return (
    <div className="studio-assets">
      <div className="studio-assets__inner">
      <input
        ref={fileInputRef}
        type="file"
        className="studio-assets__file-input"
        accept="image/*,video/*,audio/*,text/*"
        onChange={(event) => void handleUpload(event.target.files)}
      />
      <AssetToolbar
        query={query}
        kind={kind}
        source={source}
        dateRange={dateRange}
        favoritesOnly={favoritesOnly}
        selectMode={selectMode}
        total={total}
        filteredCount={assets.length}
        uploading={uploading}
        onQueryChange={(value) => {
          setPage(1);
          setQuery(value);
        }}
        onKindChange={(value) => {
          setPage(1);
          setKind(value);
        }}
        onSourceChange={(value) => {
          setPage(1);
          setSource(value);
        }}
        onDateRangeChange={(value) => {
          setPage(1);
          setDateRange(value);
        }}
        onFavoritesOnlyChange={(value) => {
          setPage(1);
          setFavoritesOnly(value);
        }}
        onUploadClick={() => fileInputRef.current?.click()}
        onSelectModeChange={(on) => {
          if (!on) exitSelectMode();
          else setSelectMode(true);
        }}
      />

      {fromGenerate ? (
        <div className="studio-assets__banner">
          <span>当前仅显示来自「创作」的成稿</span>
          <button type="button" className="studio-assets__banner-link" onClick={clearGenerateFilter}>
            查看全部资源
          </button>
        </div>
      ) : null}

      <div className="studio-assets__body">
        {loading ? (
          <div className="studio-assets__loading">
            <Spin />
          </div>
        ) : assets.length > 0 ? (
          <div className="studio-assets__feed">
            {dateSections.map((section) => (
              <section key={section.key} className="studio-assets__section">
                <h2 className="studio-assets__section-title">{section.dateLabel}</h2>
                <AssetGrid
                  items={section.items}
                  selectable={selectMode}
                  selectedIds={selectedIds}
                  onOpen={setPreviewAsset}
                  onToggleSelect={toggleSelect}
                  onMediaError={(asset) => void refreshAssetPreview(asset)}
                />
              </section>
            ))}
          </div>
        ) : (
          <p className="studio-assets__empty">没有匹配的资源，试试调整筛选或搜索关键词。</p>
        )}
        {!loading && total > ASSET_PAGE_SIZE ? (
          <Pagination
            className="studio-assets__pagination"
            current={page}
            pageSize={ASSET_PAGE_SIZE}
            total={total}
            showSizeChanger={false}
            showQuickJumper
            showTotal={(value) => `共 ${value} 项`}
            onChange={(nextPage) => {
              setPreviewAsset(null);
              setPage(nextPage);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        ) : null}
      </div>

      {selectMode ? (
        <AssetBatchBar
          count={selectedIds.size}
          onDelete={() => void handleDelete([...selectedIds])}
          onCancel={exitSelectMode}
        />
      ) : null}
      </div>

      <AssetPreviewOverlay
        assets={assets}
        asset={previewAsset}
        onSelect={setPreviewAsset}
        onClose={() => setPreviewAsset(null)}
        onToggleFavorite={(asset) => void handleToggleFavorite(asset)}
        onRename={(asset, filename) => void handleRename(asset, filename)}
        onDelete={(asset) => void handleDelete([asset.id])}
        onMediaError={(asset) => void refreshAssetPreview(asset)}
      />
    </div>
  );
}

function AssetPreviewOverlay({
  assets,
  asset,
  onSelect,
  onClose,
  onToggleFavorite,
  onRename,
  onDelete,
  onMediaError,
}: {
  assets: AssetBase[];
  asset: AssetBase | null;
  onSelect: (asset: AssetBase) => void;
  onClose: () => void;
  onToggleFavorite: (asset: AssetBase) => void;
  onRename: (asset: AssetBase, filename: string) => void;
  onDelete: (asset: AssetBase) => void;
  onMediaError: (asset: AssetBase) => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  useEffect(() => {
    setRenameValue(asset?.filename || asset?.title || '');
    setRenaming(false);
  }, [asset?.id, asset?.filename, asset?.title]);

  const currentIndex = asset ? assets.findIndex((item) => item.id === asset.id) : -1;
  const previous = currentIndex > 0 ? assets[currentIndex - 1] : null;
  const next =
    currentIndex >= 0 && currentIndex < assets.length - 1 ? assets[currentIndex + 1] : null;

  useEffect(() => {
    if (!asset) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (renaming) return;
      const target = e.target;
      if (
        target instanceof HTMLElement
        && (target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
      ) {
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'ArrowLeft' && previous) {
        e.preventDefault();
        onSelect(previous);
        return;
      }
      if (e.key === 'ArrowRight' && next) {
        e.preventDefault();
        onSelect(next);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [asset, next, onClose, onSelect, previous, renaming]);

  if (!asset) return null;
  const prompt = typeof asset.metadata?.prompt === 'string' ? asset.metadata.prompt : '';
  const config = [
    ['模型', asset.metadata?.model_id],
    ['比例', asset.metadata?.ratio],
    ['分辨率', asset.metadata?.resolution],
    ['时长', asset.metadata?.duration ? `${asset.metadata.duration} 秒` : ''],
  ]
    .filter(([, value]) => value)
    .map(([label, value]) => ({ label: String(label), value: String(value) }));

  return (
    <div className="studio-assets-preview" role="dialog" aria-modal="true">
      <button
        type="button"
        className="studio-assets-preview__close"
        onClick={onClose}
        aria-label="关闭预览"
        title="关闭预览"
      >
        ×
      </button>
      <main
        className="studio-assets-preview__stage"
        onClick={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        {previous ? (
          <button
            type="button"
            className="studio-assets-preview__nav studio-assets-preview__nav--prev"
            onClick={() => onSelect(previous)}
            aria-label="上一张"
          >
            ‹
          </button>
        ) : null}
        {asset.kind === 'video' && asset.previewUrl ? (
          <video
            className="studio-assets-preview__media"
            src={asset.previewUrl}
            controls
            autoPlay
            onError={() => onMediaError(asset)}
          />
        ) : asset.previewUrl ? (
          <img
            className="studio-assets-preview__media"
            src={asset.previewUrl}
            alt=""
            onError={() => onMediaError(asset)}
          />
        ) : null}
        {next ? (
          <button
            type="button"
            className="studio-assets-preview__nav studio-assets-preview__nav--next"
            onClick={() => onSelect(next)}
            aria-label="下一张"
          >
            ›
          </button>
        ) : null}
        {currentIndex >= 0 && assets.length > 1 ? (
          <div className="studio-assets-preview__counter">
            {currentIndex + 1} / {assets.length}
          </div>
        ) : null}
      </main>
      <aside className="studio-assets-preview__side">
        <div className="studio-assets-preview__actions">
          {asset.previewUrl ? (
            <a className="studio-assets-preview__btn" href={asset.previewUrl} download>
              下载
            </a>
          ) : null}
          <button type="button" className="studio-assets-preview__btn" onClick={() => onToggleFavorite(asset)}>
            {asset.favorite ? '取消收藏' : '收藏'}
          </button>
          <button type="button" className="studio-assets-preview__btn is-danger" onClick={() => onDelete(asset)}>
            删除
          </button>
        </div>
        {renaming ? (
          <div className="studio-assets-preview__rename">
            <Input value={renameValue} onChange={(event) => setRenameValue(event.target.value)} autoFocus />
            <Button onClick={() => onRename(asset, renameValue)}>保存</Button>
          </div>
        ) : (
          <div className="studio-assets-preview__title-row">
            <h2>{asset.filename || asset.title}</h2>
            <button type="button" onClick={() => setRenaming(true)}>
              重命名
            </button>
          </div>
        )}
        {prompt ? (
          <section>
            <span>提示词</span>
            <p>{prompt}</p>
          </section>
        ) : null}
        {config.length > 0 ? (
          <dl>
            {config.map(({ label, value }) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </aside>
    </div>
  );
}
