import { SearchOutlined, UploadOutlined } from '@ant-design/icons';
import { Input } from 'antd';
import type { Dayjs } from 'dayjs';
import type { ReactNode } from 'react';
import { StudioChip } from '../../../shared/ui/StudioChip';
import type { AssetDomainFilter, AssetKindFilter, AssetSourceFilter } from '../constants';
import { ASSET_DOMAIN_OPTIONS, ASSET_KIND_OPTIONS } from '../constants';
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

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="studio-assets__filter-group" role="group" aria-label={label}>
      <div className="studio-assets__filter-chips">{children}</div>
    </div>
  );
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
  const domainActive: AssetDomainFilter | null =
    source === 'import' ? null : (source as AssetDomainFilter);

  return (
    <header className="studio-assets__toolbar" aria-label="资源库">
      <div className="studio-assets__toolbar-row">
        <span className="studio-assets__count">
          {filteredCount === total ? `${total} 项` : `${filteredCount} / ${total}`}
        </span>

        <div className="studio-assets__toolbar-actions">
          <Input
            className="studio-assets__search"
            prefix={<SearchOutlined />}
            placeholder="搜索资源"
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

      <div className="studio-assets__filters">
        <FilterGroup label="类型">
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
        </FilterGroup>

        <FilterGroup label="来源域">
          {ASSET_DOMAIN_OPTIONS.map((opt) => (
            <StudioChip
              key={`d-${opt.value}`}
              size="sm"
              active={domainActive === opt.value}
              onClick={() => onSourceChange(opt.value)}
            >
              {opt.label}
            </StudioChip>
          ))}
        </FilterGroup>

        <FilterGroup label="方式">
          <StudioChip
            size="sm"
            active={source !== 'import' && !favoritesOnly}
            onClick={() => {
              if (source === 'import') onSourceChange('all');
              if (favoritesOnly) onFavoritesOnlyChange(false);
            }}
          >
            全部
          </StudioChip>
          <StudioChip
            size="sm"
            active={source === 'import'}
            onClick={() => onSourceChange(source === 'import' ? 'all' : 'import')}
          >
            导入
          </StudioChip>
          <StudioChip
            size="sm"
            active={favoritesOnly}
            onClick={() => onFavoritesOnlyChange(!favoritesOnly)}
          >
            仅收藏
          </StudioChip>
        </FilterGroup>

        <FilterGroup label="时间">
          <AssetDateRangeFilter value={dateRange} onChange={onDateRangeChange} />
        </FilterGroup>
      </div>
    </header>
  );
}
