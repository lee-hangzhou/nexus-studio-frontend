import { apiUrl, fetchWithAuth, request } from './base';
import { directUploadAsset } from './directUpload';
import type {
  GenerateTaskListRequest,
  GenerateTaskListResponse,
  GenerationKind,
  GenerationTaskStatus,
} from './generated/generation';
import { filterSelectableModels } from '../shared/utils/hiddenSelectableModels';

export type {
  GenerateTaskCursor,
  GenerateTaskListItem,
  GenerateTaskListRequest,
  GenerateTaskListResponse,
} from './generated/generation';

export type GenerateTaskKind = GenerationKind;

export interface GenerateTaskView {
  task_id: number;
  kind: GenerateTaskKind;
  status: GenerationTaskStatus;
  prompt: string;
  model_id: string;
  ratio?: string;
  resolution?: string;
  duration?: number | null;
  reference_mode?: number | null;
  ref_materials?: {
    asset_id: number;
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
  queue_position?: number | null;
  queue_total?: number | null;
  estimated_wait_seconds?: number | null;
  created_at: string;
}

export interface SubmitGenerateParams {
  kind: GenerateTaskKind;
  prompt: string;
  model_id: string;
  voice_id?: string;
  ratio?: string;
  resolution?: string;
  count?: number;
  duration?: number | null;
  reference_mode?: number;
  ref_asset_ids?: number[];
  episode_id?: number;
  node_id?: string;
  submit_content?: unknown[];
  manual_refs?: { asset_id: number }[];
  preview_media_asset_ids?: number[];
}

export interface GenerateMaterialUploadResult {
  asset_id: number;
  filename: string;
  mime_type: string;
  url: string;
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
    material_limits?: {
      images?: number;
      videos?: number;
      audios?: number;
      requires_any?: boolean;
      allow_audio_only?: boolean;
    };
  };
}

/** 与 ErrorCode 对齐的业务错误（画布提交等可按 code 分支） */
export class GenerateApiError extends Error {
  readonly code: number;
  readonly details: Record<string, unknown> | null | undefined;

  constructor(message: string, code: number, details?: Record<string, unknown> | null) {
    super(message);
    this.name = 'GenerateApiError';
    this.code = code;
    this.details = details;
  }
}

export function isGenerateApiError(err: unknown): err is GenerateApiError {
  return err instanceof GenerateApiError;
}

export async function submitGenerate(params: SubmitGenerateParams) {
  const response = await fetchWithAuth(apiUrl('/generate/submit'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const payload = (await response.json().catch(() => null)) as {
    code: number;
    data: { task_id: number; status: GenerationTaskStatus } | Record<string, unknown> | null;
    msg: string;
  } | null;
  if (!response.ok || payload === null || payload.code !== 0) {
    throw new GenerateApiError(
      payload?.msg ?? `请求失败: ${response.status}`,
      payload?.code ?? response.status,
      payload?.data && typeof payload.data === 'object'
        ? (payload.data as Record<string, unknown>)
        : null,
    );
  }
  return payload.data as { task_id: number; status: GenerationTaskStatus };
}

export async function uploadGenerateMaterial(
  file: File,
  signal?: AbortSignal,
): Promise<GenerateMaterialUploadResult> {
  const asset = await directUploadAsset({
    file,
    sourceType: 'generate_material',
    signal,
  });
  if (!asset.preview_url) {
    throw new Error('上传响应缺少预览地址');
  }
  return {
    asset_id: asset.id,
    filename: asset.filename,
    mime_type: asset.mime_type,
    url: asset.preview_url,
  };
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

export function listGenerateTasks(params: GenerateTaskListRequest) {
  return request<GenerateTaskListResponse>(
    '/generate/tasks/list',
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

export async function listGenerateModels(kind: 'image' | 'video' | 'audio') {
  const res = await request<{ items: GenerateModelItem[] }>(`/generate/models?kind=${kind}`, {
    method: 'GET',
  });
  return {
    ...res,
    items: filterSelectableModels(res.items ?? [], (item) => [item.model_id, item.label]),
  };
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
