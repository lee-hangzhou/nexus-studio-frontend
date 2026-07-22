import { SearchOutlined, UploadOutlined } from '@ant-design/icons';
import { Input } from 'antd';
import type { Dayjs } from 'dayjs';
import { StudioChip } from '../../../shared/ui/StudioChip';
import type { AssetKindFilter, AssetSourceFilter } from '../constants';
import { ASSET_KIND_OPTIONS, ASSET_SOURCE_OPTIONS } from '../constants';
import { AssetDateRangeFilter } from './AssetDateRangeFilter';

interface AssetToolbarProps {
  query: string;
  kind: AssetKindFilter;
  source: AssetSourceFilter;
  dateRange: [Dayjs, Dayjs] | null;
  favoritesOnly: boolean;
  selectMode: boolean;
  total: number;
  filteredCount: number;
  uploading: boolean;
  onQueryChange: (q: string) => void;
  onKindChange: (k: AssetKindFilter) => void;
  onSourceChange: (s: AssetSourceFilter) => void;
  onDateRangeChange: (range: [Dayjs, Dayjs] | null) => void;
  onFavoritesOnlyChange: (v: boolean) => void;
  onUploadClick: () => void;
  onSelectModeChange: (v: boolean) => void;
}

export function AssetToolbar({
  query,
  kind,
  source,
  dateRange,
  favoritesOnly,
  selectMode,
  total,
  filteredCount,
  uploading,
  onQueryChange,
  onKindChange,
  onSourceChange,
  onDateRangeChange,
  onFavoritesOnlyChange,
  onUploadClick,
  onSelectModeChange,
}: AssetToolbarProps) {
  return (
    <header className="studio-assets__toolbar">
      <div className="studio-assets__toolbar-row">
        <div className="studio-assets__toolbar-title">
          <div>
            <span className="studio-assets__eyebrow">MEDIA LIBRARY</span>
            <h1 className="studio-assets__title">视觉素材</h1>
          </div>
          <span className="studio-assets__count">
            {filteredCount === total ? `${total} 项` : `${filteredCount} / ${total}`}
          </span>
        </div>

        <div className="studio-assets__toolbar-actions">
          <Input
            className="studio-assets__search"
            prefix={<SearchOutlined />}
            placeholder="搜索素材"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            allowClear
          />
          <button
            type="button"
            className="studio-assets__tool-btn"
            onClick={onUploadClick}
            disabled={uploading}
          >
            <UploadOutlined />
            {uploading ? '上传中' : '上传'}
          </button>
          <button
            type="button"
            className={`studio-assets__tool-btn${selectMode ? ' studio-assets__tool-btn--active' : ''}`}
            onClick={() => onSelectModeChange(!selectMode)}
          >
            {selectMode ? '完成' : '选择'}
          </button>
        </div>
      </div>

      <div className="studio-assets__filter-scroll" role="toolbar" aria-label="筛选">
        {ASSET_KIND_OPTIONS.map((opt) => (
          <StudioChip
            key={`k-${opt.value}`}
            size="sm"
            active={kind === opt.value}
            onClick={() => onKindChange(opt.value)}
          >
            {opt.label}
          </StudioChip>
        ))}
        <span className="studio-assets__filter-sep" aria-hidden />
        {ASSET_SOURCE_OPTIONS.map((opt) => (
          <StudioChip
            key={`s-${opt.value}`}
            size="sm"
            active={source === opt.value}
            onClick={() => onSourceChange(opt.value)}
          >
            {opt.label}
          </StudioChip>
        ))}
        <StudioChip
          size="sm"
          active={favoritesOnly}
          onClick={() => onFavoritesOnlyChange(!favoritesOnly)}
        >
          收藏
        </StudioChip>
      </div>

      <AssetDateRangeFilter value={dateRange} onChange={onDateRangeChange} />
    </header>
  );
}
