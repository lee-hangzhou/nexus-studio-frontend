import {
  CloseOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EllipsisOutlined,
  HeartFilled,
  HeartOutlined,
  PictureOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { Dropdown, Input, Modal, Spin } from 'antd';
import type { MenuProps } from 'antd';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';
import type { GenerateFeedItem, GenerateFilterType, GenerateStatusFilter, GenerateTimePreset, HistoryFilters } from '../types';
import { StudioChip } from '../../../shared/ui/StudioChip';
import { PromptWithMentions } from './PromptWithMentions';
import { isTaskInProgress, isTaskQueued, TASK_STATUS } from '../../../domains/task/types';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

function statusInfo(status: GenerateFeedItem['status']): { label: string; cls: string } {
  switch (status) {
    case TASK_STATUS.SUCCEEDED:
      return { label: '已完成', cls: 'studio-create-history-panel__status--success' };
    case TASK_STATUS.RUNNING:
      return { label: '进行中', cls: 'studio-create-history-panel__status--running' };
    case TASK_STATUS.FAILED:
      return { label: '失败', cls: 'studio-create-history-panel__status--failed' };
    case TASK_STATUS.CANCELLED:
      return { label: '已取消', cls: 'studio-create-history-panel__status--pending' };
    case TASK_STATUS.CREATED:
      return { label: '已创建', cls: 'studio-create-history-panel__status--pending' };
    case TASK_STATUS.QUEUED:
      return { label: '排队中', cls: 'studio-create-history-panel__status--pending' };
    case TASK_STATUS.WAITING:
      return { label: '等待中', cls: 'studio-create-history-panel__status--pending' };
  }
}

function HistoryThumb({ item }: { item: GenerateFeedItem }) {
  const media = item.resultImages?.[0];
  const thumbUrl = media?.url;
  const isVideo = item.kind === 'video' || media?.type === 3;
  const isPending = isTaskInProgress(item.status);
  const isFailed = item.status === TASK_STATUS.FAILED;
  return (
    <div className="studio-create-history-panel__thumb" aria-hidden>
      {!thumbUrl && (isPending || isFailed) ? (
        <img
          src={isPending ? '/generate_pending_state.png' : '/generate_failed_state.png'}
          alt=""
          className={`studio-create-history-panel__state-art${isPending ? ' studio-create-history-panel__state-art--pending' : ''}`}
        />
      ) : null}
      {thumbUrl && isVideo ? (
        <video
          src={thumbUrl}
          muted
          playsInline
          preload="metadata"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : thumbUrl ? (
        <img
          src={thumbUrl}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : !isPending && !isFailed ? (
        <PictureOutlined className="studio-create-history-panel__thumb-placeholder-icon" />
      ) : null}
    </div>
  );
}

function FilterPills<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="studio-create-history-panel__filter-group">
      <span className="studio-create-history-panel__filter-label">{label}</span>
      <div className="studio-create-history__pill-row studio-create-history__pill-row--grow">
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
    </div>
  );
}

function HistoryRow({
  item,
  active,
  onSelect,
  onToggleFavorite,
  onCancel,
  onDelete,
}: {
  item: GenerateFeedItem;
  active: boolean;
  onSelect: () => void;
  onToggleFavorite: () => void;
  onCancel?: () => void;
  onDelete: () => void;
}) {
  const { label, cls } = statusInfo(item.status);
  const timeAgo = dayjs(item.createdAt).fromNow();

  const tags: string[] = [item.modelLabel];
  if (item.ratio) tags.push(item.ratio);
  if (item.resultCount > 0) {
    tags.push(item.kind === 'video' ? `${item.resultCount}个视频` : `${item.resultCount}张`);
  }
  if (isTaskQueued(item.status) && item.queuePosition && item.queueTotal) {
    tags.push(`排队 ${item.queuePosition}/${item.queueTotal}`);
  }

  const menuItems: MenuProps['items'] = [
    {
      key: 'delete',
      label: '删除记录',
      icon: <DeleteOutlined />,
      danger: true,
      onClick: ({ domEvent }) => {
        domEvent.stopPropagation();
        Modal.confirm({
          title: '删除这条生成记录？',
          content: '删除后无法恢复，进行中的任务会先尝试取消。',
          okText: '删除',
          okType: 'danger',
          cancelText: '取消',
          onOk: onDelete,
        });
      },
    },
  ];

  return (
    <div
      className={`studio-create-history-panel__row${active ? ' studio-create-history-panel__row--active' : ''}`}
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
    >
      <HistoryThumb item={item} />

      <div className="studio-create-history-panel__body">
        <div className="studio-create-history-panel__meta-row">
          <span className={`studio-create-history-panel__status ${cls}`}>{label}</span>
          <span className="studio-create-history-panel__time">{timeAgo}</span>
        </div>
        <p className="studio-create-history-panel__prompt" title={item.prompt}>
          <PromptWithMentions prompt={item.prompt} refs={item.refImages} compact />
        </p>
        <div className="studio-create-history-panel__tags">
          {tags.map((t) => (
            <span key={t} className="studio-create-history-panel__tag">{t}</span>
          ))}
        </div>
      </div>

      <div className="studio-create-history-panel__actions">
        <button
          type="button"
          className={`studio-create-history-panel__action-btn${item.favorite ? ' studio-create-history-panel__action-btn--fav-active' : ''}`}
          title={item.favorite ? '取消收藏' : '收藏'}
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
        >
          {item.favorite ? <HeartFilled /> : <HeartOutlined />}
        </button>
        {item.status === TASK_STATUS.SUCCEEDED && (
          <button
            type="button"
            className="studio-create-history-panel__action-btn"
            title="下载"
            onClick={(e) => e.stopPropagation()}
          >
            <DownloadOutlined />
          </button>
        )}
        {item.kind !== 'image' && isTaskQueued(item.status) && onCancel && Number.isFinite(Number(item.id)) && (
          <button
            type="button"
            className="studio-create-history-panel__action-btn studio-create-history-panel__action-btn--danger"
            title="取消任务"
            onClick={(e) => { e.stopPropagation(); onCancel(); }}
          >
            <CloseOutlined />
          </button>
        )}
        <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="bottomRight">
          <button
            type="button"
            className="studio-create-history-panel__action-btn"
            title="更多操作"
            onClick={(e) => e.stopPropagation()}
          >
            <EllipsisOutlined />
          </button>
        </Dropdown>
      </div>
    </div>
  );
}

const KIND_OPTS: { value: GenerateFilterType; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'image', label: '图片' },
  { value: 'video', label: '视频' },
];

const STATUS_OPTS: { value: GenerateStatusFilter; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'in_progress', label: '进行中' },
  { value: 'success', label: '已完成' },
  { value: 'failed', label: '失败' },
  { value: 'cancelled', label: '已取消' },
];

const TIME_OPTS: { value: GenerateTimePreset; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'today', label: '今天' },
  { value: 'week', label: '最近一周' },
  { value: 'month', label: '最近一月' },
];

interface CreateHistoryPanelProps {
  items: GenerateFeedItem[];
  filters: HistoryFilters;
  onFiltersChange: (next: HistoryFilters) => void;
  activeId: string | null;
  onSelect: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onCancel?: (id: string) => void;
  onDelete: (id: string) => void;
  hasMore?: boolean;
  onLoadMore?: () => void;
  loadingMore?: boolean;
  initialLoading?: boolean;
}

export function CreateHistoryPanel({
  items,
  filters,
  onFiltersChange,
  activeId,
  onSelect,
  onToggleFavorite,
  onCancel,
  onDelete,
  hasMore = false,
  onLoadMore,
  loadingMore = false,
  initialLoading = false,
}: CreateHistoryPanelProps) {
  const patchFilters = (patch: Partial<HistoryFilters>) => {
    onFiltersChange({ ...filters, ...patch });
  };

  return (
    <div className="studio-create-history-panel">
      <div className="studio-create-history-panel__header">
        <div className="studio-create-history-panel__title">生成历史</div>
        <Input
          className="studio-create-history-panel__search"
          prefix={<SearchOutlined style={{ color: 'var(--studio-text-secondary)', fontSize: 13 }} />}
          placeholder="搜索提示词"
          value={filters.query}
          onChange={(e) => patchFilters({ query: e.target.value })}
          allowClear
          size="small"
        />
      </div>

      <div className="studio-create-history-panel__filters">
        <FilterPills label="类型" options={KIND_OPTS} value={filters.kind} onChange={(v) => patchFilters({ kind: v })} />
        <FilterPills label="状态" options={STATUS_OPTS} value={filters.status} onChange={(v) => patchFilters({ status: v })} />
        <FilterPills label="时间" options={TIME_OPTS} value={filters.time} onChange={(v) => patchFilters({ time: v })} />
        <div className="studio-create-history-panel__filter-group">
          <span className="studio-create-history-panel__filter-label">收藏</span>
          <div className="studio-create-history__pill-row studio-create-history__pill-row--grow">
            <StudioChip
              size="sm"
              active={filters.favoritesOnly}
              onClick={() => patchFilters({ favoritesOnly: !filters.favoritesOnly })}
            >
              仅收藏
            </StudioChip>
          </div>
        </div>
      </div>

      <div className="studio-create-history-panel__list">
        {initialLoading ? (
          <div className="studio-create-history-panel__loading">
            <Spin size="small" />
          </div>
        ) : items.length === 0 ? (
          <p className="studio-create-history__empty">没有符合条件的记录</p>
        ) : (
          items.map((item) => (
            <HistoryRow
              key={item.id}
              item={item}
              active={item.id === activeId}
              onSelect={() => onSelect(item.id)}
              onToggleFavorite={() => onToggleFavorite(item.id)}
              onCancel={onCancel ? () => onCancel(item.id) : undefined}
              onDelete={() => onDelete(item.id)}
            />
          ))
        )}

        {hasMore && !initialLoading && (
          <div className="studio-create-history-panel__footer">
            <button
              type="button"
              className="studio-create-history-panel__load-more"
              disabled={loadingMore}
              onClick={() => onLoadMore?.()}
            >
              {loadingMore ? '加载中…' : '加载更多'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
