import { matchesTimePreset } from '../../../shared/utils/timePreset';
import {
  FILMSTRIP_DISPLAY_MAX,
  FILMSTRIP_PINNED_MAX,
  FILMSTRIP_RECENT_LIMIT,
} from '../constants';
import type {
  GenerateFeedItem,
  GenerateFilterType,
  GenerateStatusFilter,
  GenerateTimePreset,
  HistoryListRow,
} from '../types';

function byNewest(a: GenerateFeedItem, b: GenerateFeedItem) {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

export function buildFilmstripWorkset(
  items: GenerateFeedItem[],
  activeId: string | null
): GenerateFeedItem[] {
  const pinned = items
    .filter((i) => i.favorite)
    .sort(byNewest)
    .slice(0, FILMSTRIP_PINNED_MAX);

  const pinnedIds = new Set(pinned.map((i) => i.id));
  const recent = items
    .filter((i) => !pinnedIds.has(i.id))
    .sort(byNewest)
    .slice(0, FILMSTRIP_RECENT_LIMIT);

  const workset: GenerateFeedItem[] = [];
  const seen = new Set<string>();

  const push = (item: GenerateFeedItem) => {
    if (seen.has(item.id)) return;
    seen.add(item.id);
    workset.push(item);
  };

  if (activeId) {
    const active = items.find((i) => i.id === activeId);
    if (active) push(active);
  }

  pinned.forEach(push);
  recent.forEach(push);

  if (workset.length <= FILMSTRIP_DISPLAY_MAX) {
    return workset;
  }

  const active = activeId ? workset.find((i) => i.id === activeId) : undefined;
  if (!active) {
    return workset.slice(0, FILMSTRIP_DISPLAY_MAX);
  }

  const rest = workset.filter((i) => i.id !== activeId).slice(0, FILMSTRIP_DISPLAY_MAX - 1);
  return [active, ...rest];
}

function matchesStatus(status: GenerateFeedItem['status'], filter: GenerateStatusFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'in_progress') return status === 'pending' || status === 'running';
  if (filter === 'success') return status === 'success';
  if (filter === 'failed') return status === 'failed';
  return true;
}

export function filterGenerateHistory(
  items: GenerateFeedItem[],
  options: {
    query: string;
    kind: GenerateFilterType;
    status: GenerateStatusFilter;
    time: GenerateTimePreset;
    favoritesOnly?: boolean;
  }
): GenerateFeedItem[] {
  const q = options.query.trim().toLowerCase();
  return items
    .filter((item) => {
      if (options.favoritesOnly && !item.favorite) return false;
      if (options.kind !== 'all' && item.kind !== options.kind) return false;
      if (!matchesStatus(item.status, options.status)) return false;
      if (!matchesTimePreset(item.createdAt, options.time)) return false;
      if (q && !item.prompt.toLowerCase().includes(q)) return false;
      return true;
    })
    .sort(byNewest);
}

function formatDayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today.getTime() - target.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return '今天';
  if (diffDays === 1) return '昨天';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function buildHistoryListRows(items: GenerateFeedItem[]): HistoryListRow[] {
  const rows: HistoryListRow[] = [];
  let lastLabel = '';

  for (const item of items) {
    const label = formatDayLabel(item.createdAt);
    if (label !== lastLabel) {
      rows.push({ type: 'header', key: `h-${label}`, label });
      lastLabel = label;
    }
    rows.push({ type: 'item', key: item.id, item });
  }

  return rows;
}

export const HISTORY_ROW_HEADER_HEIGHT = 36;
export const HISTORY_ROW_ITEM_HEIGHT = 80;

export function measureHistoryList(rows: HistoryListRow[]): { offsets: number[]; heights: number[]; total: number } {
  const heights = rows.map((r) =>
    r.type === 'header' ? HISTORY_ROW_HEADER_HEIGHT : HISTORY_ROW_ITEM_HEIGHT
  );
  const offsets: number[] = [];
  let acc = 0;
  for (const h of heights) {
    offsets.push(acc);
    acc += h;
  }
  return { offsets, heights, total: acc };
}

export function statusLabel(status: GenerateFeedItem['status']): string {
  switch (status) {
    case 'pending':
      return '排队中';
    case 'running':
      return '生成中';
    case 'success':
      return '已完成';
    case 'failed':
      return '失败';
    default:
      return status;
  }
}
