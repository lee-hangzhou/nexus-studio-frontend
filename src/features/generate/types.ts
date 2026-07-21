import type { TaskStatus } from '../../domains/task/types';

export type GenerateKind = 'image' | 'video';

export type GenerateFilterType = 'all' | GenerateKind;

export type GenerateStatusFilter = 'all' | 'in_progress' | 'success' | 'failed' | 'cancelled';

export type GenerateTimePreset = 'all' | 'today' | 'week' | 'month';

export interface HistoryFilters {
  query: string;
  kind: GenerateFilterType;
  status: GenerateStatusFilter;
  time: GenerateTimePreset;
  favoritesOnly: boolean;
}

export const DEFAULT_HISTORY_FILTERS: HistoryFilters = {
  query: '',
  kind: 'all',
  status: 'all',
  time: 'all',
  favoritesOnly: false,
};

export type GenerateRatio = string;

export type GenerateResolution = string;

export interface GenerateResultMedia {
  url: string;
  type?: number;
  width?: number;
  height?: number;
}

export interface GenerateRefImage {
  id: string;
  materialId?: number;
  assetId?: number;
  url: string;
  name: string;
  mimeType: string;
}

export interface GenerateFeedItem {
  id: string;
  kind: GenerateKind;
  status: TaskStatus;
  prompt: string;
  modelId: string;
  modelLabel: string;
  createdAt: string;
  resultCount: number;
  resultImages?: GenerateResultMedia[];
  favorite?: boolean;
  errorMessage?: string;
  ratio?: GenerateRatio;
  resolution?: GenerateResolution;
  duration?: number;
  referenceMode?: number;
  refImages?: GenerateRefImage[];
  queueStatus?: number | null;
  queuePosition?: number | null;
  queueTotal?: number | null;
  estimatedWaitSeconds?: number | null;
}

export type HistoryListRow =
  | { type: 'header'; key: string; label: string }
  | { type: 'item'; key: string; item: GenerateFeedItem };
