import { apiUrl, fetchWithAuth, request } from './base';

// ── 后端返回的原始视图类型 ───────────────────────────────────────────────────

export interface GenerateTaskView {
  task_id: number;
  kind: 'image' | 'video';
  status: 'pending' | 'running' | 'success' | 'failed';
  prompt: string;
  model_id: string;
  ratio?: string;
  resolution?: string;
  duration?: number | null;
  reference_mode?: number | null;
  ref_materials?: {
    attachment_id?: number | null;
    asset_id?: number | null;
    filename: string;
    mime_type: string;
    url: string;
    source_type?: string | null;
  }[];
  result_asset_ids: number[];
  result_count: number;
  result_urls: { url: string; type?: number; width?: number; height?: number }[];
  error_message?: string | null;
  is_favorited: boolean;
  queue_status?: number | null;
  queue_position?: number | null;
  queue_total?: number | null;
  estimated_wait_seconds?: number | null;
  created_at: string;
}

export interface GenerateHistoryItemView {
  task_id: number;
  kind: 'image' | 'video';
  status: 'pending' | 'running' | 'success' | 'failed';
  prompt: string;
  model_id: string;
  ratio?: string;
  resolution?: string;
  duration?: number | null;
  reference_mode?: number | null;
  result_count: number;
  preview_asset_id?: number | null;
  preview_url?: string | null;
  preview_media_type?: number | null;
  error_message?: string | null;
  is_favorited: boolean;
  queue_status?: number | null;
  queue_position?: number | null;
  queue_total?: number | null;
  estimated_wait_seconds?: number | null;
  created_at: string;
}

// ── 请求参数类型 ──────────────────────────────────────────────────────────────

export interface SubmitGenerateParams {
  kind: 'image' | 'video';
  prompt: string;
  model_id: string;
  ratio?: string;
  resolution?: string;
  count?: number;
  duration?: number | null;
  reference_mode?: number;
  ref_attachment_ids?: number[];
  ref_asset_ids?: number[];
}

export interface GenerateMaterialUploadResult {
  material_id: number;
  asset_id?: number | null;
  filename: string;
  mime_type: string;
  url: string;
}

export interface HistoryParams {
  kind?: 'all' | 'image' | 'video';
  status?: 'all' | 'in_progress' | 'success' | 'failed';
  time_range?: 'all' | 'today' | 'week' | 'month';
  query?: string;
  favorites_only?: boolean;
  page_size?: number;
  cursor?: string | null;
}

export interface GenerateModelItem {
  model_id: string;
  label: string;
  kind: 'image' | 'video' | 'audio';
  supports_vision: boolean;
  param_options?: {
    ratios?: string[];
    resolutions?: string[];
    counts?: number[];
    durations?: number[];
    reference_modes?: { value: number; label: string }[];
    ratios_by_resolution?: Record<string, string[]>;
  };
}

// ── API 调用 ──────────────────────────────────────────────────────────────────

export function submitGenerate(params: SubmitGenerateParams) {
  return request<{ task_id: number; status: string }>('/generate/submit', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function uploadGenerateMaterial(file: File) {
  const form = new FormData();
  form.append('file', file);
  const response = await fetchWithAuth(apiUrl('/generate/material/upload'), {
    method: 'POST',
    body: form,
  });
  const payload = await response.json();
  if (!response.ok || payload.code !== 0) {
    throw new Error(payload.msg ?? 'upload failed');
  }
  return payload.data as GenerateMaterialUploadResult;
}

export function getTaskStatus(taskId: number) {
  return request<GenerateTaskView>('/generate/task/status', {
    method: 'POST',
    body: JSON.stringify({ task_id: taskId }),
  });
}

export async function getTasksStatus(taskIds: number[]) {
  const uniqueTaskIds = Array.from(new Set(taskIds));
  const chunks: number[][] = [];
  for (let index = 0; index < uniqueTaskIds.length; index += 100) {
    chunks.push(uniqueTaskIds.slice(index, index + 100));
  }
  const responses = await Promise.all(
    chunks.map((chunk) =>
      request<{ items: GenerateTaskView[]; missing_task_ids: number[] }>('/generate/tasks/status', {
        method: 'POST',
        body: JSON.stringify({ task_ids: chunk }),
      }),
    ),
  );
  return {
    items: responses.flatMap((response) => response.items),
    missing_task_ids: responses.flatMap((response) => response.missing_task_ids),
  };
}

export function fetchHistory(params: HistoryParams) {
  return request<{ items: GenerateHistoryItemView[]; next_cursor: string | null; has_more: boolean }>(
    '/generate/history',
    { method: 'POST', body: JSON.stringify(params) },
  );
}

export function deleteTask(taskId: number) {
  return request<{ deleted: boolean }>('/generate/task/delete', {
    method: 'POST',
    body: JSON.stringify({ task_id: taskId }),
  });
}

export function cancelTask(taskId: number) {
  return request<{ cancelled: boolean }>('/generate/task/cancel', {
    method: 'POST',
    body: JSON.stringify({ task_id: taskId }),
  });
}

export function favoriteTask(taskId: number, favorited: boolean) {
  return request<{ favorited: boolean }>('/generate/task/favorite', {
    method: 'POST',
    body: JSON.stringify({ task_id: taskId, favorited }),
  });
}

export function listGenerateModels(kind: 'image' | 'video' | 'audio') {
  return request<{ items: GenerateModelItem[] }>(`/generate/models?kind=${kind}`, {
    method: 'GET',
  });
}

export interface GenerateVoiceItem {
  voiceId: string;
  name: string;
  description?: string;
}

export function listGenerateVoices(model: string) {
  return request<{ object: string; model: string; items: GenerateVoiceItem[] }>(
    `/generate/voices?model=${encodeURIComponent(model)}`,
    { method: 'GET' },
  );
}
