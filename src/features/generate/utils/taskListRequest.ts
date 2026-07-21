import type {
  GenerateTaskCursor,
  GenerateTaskListRequest,
} from '../../../api/generate';
import { TASK_STATUS } from '../../../domains/task/types';
import type { TaskStatus } from '../../../domains/task/types';
import type {
  GenerateStatusFilter,
  GenerateTimePreset,
  HistoryFilters,
} from '../types';

function statusesForFilter(filter: GenerateStatusFilter): TaskStatus[] {
  switch (filter) {
    case 'all':
      return [];
    case 'in_progress':
      return [
        TASK_STATUS.CREATED,
        TASK_STATUS.QUEUED,
        TASK_STATUS.WAITING,
        TASK_STATUS.RUNNING,
      ];
    case 'success':
      return [TASK_STATUS.SUCCEEDED];
    case 'failed':
      return [TASK_STATUS.FAILED];
    case 'cancelled':
      return [TASK_STATUS.CANCELLED];
  }
}

function createdAfterForPreset(preset: GenerateTimePreset): string | undefined {
  if (preset === 'all') return undefined;

  const boundary = new Date();
  if (preset === 'today') {
    boundary.setHours(0, 0, 0, 0);
  }
  if (preset === 'week') {
    boundary.setDate(boundary.getDate() - 7);
  }
  if (preset === 'month') {
    boundary.setDate(boundary.getDate() - 30);
  }
  return boundary.toISOString();
}

export function buildGenerateTaskListRequest(
  filters: HistoryFilters,
  cursor: GenerateTaskCursor | null,
  pageSize: number,
): GenerateTaskListRequest {
  let kind: GenerateTaskListRequest['kind'];
  if (filters.kind !== 'all') kind = filters.kind;

  return {
    kind,
    statuses: statusesForFilter(filters.status),
    created_after: createdAfterForPreset(filters.time),
    query: filters.query.trim(),
    favorites_only: filters.favoritesOnly,
    page_size: pageSize,
    cursor,
  };
}
