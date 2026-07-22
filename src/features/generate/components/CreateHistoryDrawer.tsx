import { SearchOutlined } from '@ant-design/icons';
import { Drawer, Input } from 'antd';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { StudioChip } from '../../../shared/ui/StudioChip';
import type { GenerateFeedItem, GenerateFilterType, GenerateStatusFilter, GenerateTimePreset } from '../types';
import { buildHistoryListRows, filterGenerateHistory } from '../utils/createHistory';
import { CreateHistoryVirtualList } from './CreateHistoryVirtualList';

interface CreateHistoryDrawerProps {
  open: boolean;
  totalCount: number;
  items: GenerateFeedItem[];
  activeId: string | null;
  onClose: () => void;
  onSelect: (id: string) => void;
  onToggleFavorite: (id: string) => void;
}

const kindOptions: { value: GenerateFilterType; label: string }[] = [
  { value: 'all', label: '全部类型' },
  { value: 'image', label: '图片' },
  { value: 'video', label: '视频' },
];

const statusOptions: { value: GenerateStatusFilter; label: string }[] = [
  { value: 'all', label: '全部状态' },
  { value: 'in_progress', label: '进行中' },
  { value: 'success', label: '已完成' },
  { value: 'failed', label: '失败' },
  { value: 'cancelled', label: '已取消' },
];

const timeOptions: { value: GenerateTimePreset; label: string }[] = [
  { value: 'all', label: '全部时间' },
  { value: 'today', label: '今天' },
  { value: 'week', label: '最近一周' },
  { value: 'month', label: '最近一月' },
];

export function CreateHistoryDrawer({
  open,
  totalCount,
  items,
  activeId,
  onClose,
  onSelect,
  onToggleFavorite,
}: CreateHistoryDrawerProps) {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<GenerateFilterType>('all');
  const [status, setStatus] = useState<GenerateStatusFilter>('all');
  const [time, setTime] = useState<GenerateTimePreset>('all');
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  const filtered = useMemo(
    () => filterGenerateHistory(items, { query, kind, status, time, favoritesOnly }),
    [favoritesOnly, items, kind, query, status, time]
  );

  const rows = useMemo(() => buildHistoryListRows(filtered), [filtered]);

  const handleSelect = (id: string) => {
    onSelect(id);
    onClose();
  };

  return (
    <Drawer
      title="创作历史"
      placement="right"
      width={Math.min(480, typeof window !== 'undefined' ? window.innerWidth - 24 : 480)}
      open={open}
      onClose={onClose}
      className="studio-create-history-drawer"
      destroyOnClose={false}
      footer={
        <div className="studio-create-history__footer">
          <span className="studio-create-history__footer-meta">
            共 {totalCount} 条 · 当前筛选 {filtered.length} 条
          </span>
          <Link to="/assets?source=generate" className="studio-create-history__assets-link" onClick={onClose}>
            在资产库查看成稿
          </Link>
        </div>
      }
    >
      <div className="studio-create-history">
        <Input
          className="studio-create-history__search"
          prefix={<SearchOutlined />}
          placeholder="搜索提示词"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          allowClear
        />

        <div className="studio-create-history__filters" role="toolbar" aria-label="筛选">
          <FilterPills options={kindOptions} value={kind} onChange={setKind} />
          <FilterPills options={statusOptions} value={status} onChange={setStatus} />
          <FilterPills options={timeOptions} value={time} onChange={setTime} />
          <StudioChip
            size="sm"
            active={favoritesOnly}
            onClick={() => setFavoritesOnly((v) => !v)}
          >
            仅置顶
          </StudioChip>
        </div>

        <CreateHistoryVirtualList
          rows={rows}
          activeId={activeId}
          onSelect={handleSelect}
          onToggleFavorite={onToggleFavorite}
        />
      </div>
    </Drawer>
  );
}

function FilterPills<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="studio-create-history__pill-row">
      {options.map((opt) => (
        <StudioChip
          key={opt.value}
          size="sm"
          active={value === opt.value}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </StudioChip>
      ))}
    </div>
  );
}
