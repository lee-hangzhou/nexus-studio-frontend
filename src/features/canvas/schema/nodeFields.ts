import type {
  CanvasNodeData as ApiCanvasNodeData,
  CanvasNodeKind,
  CanvasNodeStatus,
  CanvasNodeView,
} from '../../../api/generated/canvas';
import type { WorkflowPromptContent } from '../storyflow/types';
import type { CanvasNodeData } from './canvasSchema';

const NODE_STATUSES = new Set<CanvasNodeStatus>(['idle', 'running', 'success', 'failed']);

/** 与后端禁止经 patch 写入的投影字段对齐（生成状态 / 产物等） */
export const NODE_DATA_PATCH_FORBIDDEN_KEYS = new Set([
  'status',
  'generate_task_id',
  'generate_created_at',
  'generate_operation_type',
  'generate_error',
  'output_asset_ids',
  'asset_id',
  'path',
  'preview_url',
  'paths',
  'results',
  'output_source',
]);

/** 前端 patch data 出站前剥掉投影字段 */
export function stripNodeDataProjectionForPatch(data: ApiCanvasNodeData): ApiCanvasNodeData {
  const next: ApiCanvasNodeData = { ...data };
  for (const key of NODE_DATA_PATCH_FORBIDDEN_KEYS) {
    delete (next as Record<string, unknown>)[key];
  }
  return next;
}

/** UI 侧扁平字段（由 API data 派生，写回时再 fold 成 data） */
export type FlatNodeFields = {
  title: string;
  /** text=生成输入纯文本；media=prompt 纯文本 */
  input_prompt: string;
  /** text 正文；media 不用 */
  output_text: string;
  status: CanvasNodeStatus;
  model_id?: string;
  voice_id?: string;
  ratio?: string;
  duration_sec?: number;
  resolution?: string;
  task_id?: number;
  output_asset_ids?: number[];
  error_message?: string;
};

/** 前端可经扁平 patch 写入的字段；投影字段不得经 fold 进 data */
export const PATCH_WRITABLE_FLAT_KEYS = new Set([
  'title',
  'input_prompt',
  'output_text',
  'model_id',
  'voice_id',
  'ratio',
  'duration_sec',
  'resolution',
]);

function segmentText(content: unknown): string {
  if (!Array.isArray(content)) return '';
  const parts: string[] = [];
  for (const seg of content) {
    if (!seg || typeof seg !== 'object') continue;
    const row = seg as { type?: string; text?: string };
    if (row.type === 'text' && typeof row.text === 'string' && row.text.trim()) {
      parts.push(row.text);
    }
  }
  return parts.join('\n');
}

function parseStatus(raw: unknown): CanvasNodeStatus {
  if (typeof raw === 'string' && NODE_STATUSES.has(raw as CanvasNodeStatus)) {
    return raw as CanvasNodeStatus;
  }
  return 'idle';
}

export function flattenNodeData(
  kind: CanvasNodeKind,
  data: ApiCanvasNodeData | null | undefined,
): FlatNodeFields {
  const d = data ?? {};
  const config = d.config ?? {};
  if (kind === 'text') {
    const prompt =
      (typeof d.prompt === 'string' && d.prompt) ||
      segmentText(d.prompt_content) ||
      '';
    return {
      title: d.title ?? '',
      input_prompt: prompt,
      output_text: typeof d.content === 'string' ? d.content : '',
      status: parseStatus(d.status),
      model_id: d.model ?? config.model ?? undefined,
      voice_id: config.voice_id ?? undefined,
      ratio: config.ratio ?? undefined,
      duration_sec: config.duration_sec ?? undefined,
      resolution: config.resolution ?? undefined,
      task_id: d.generate_task_id ?? undefined,
      output_asset_ids: d.output_asset_ids ?? undefined,
      error_message: d.generate_error ?? undefined,
    };
  }
  const prompt =
    (typeof d.prompt === 'string' && d.prompt) ||
    segmentText(d.content) ||
    '';
  return {
    title: d.title ?? '',
    input_prompt: prompt,
    output_text: '',
    status: parseStatus(d.status),
    model_id: d.model ?? config.model ?? undefined,
    voice_id: config.voice_id ?? undefined,
    ratio: config.ratio ?? undefined,
    duration_sec: config.duration_sec ?? undefined,
    resolution: config.resolution ?? undefined,
    task_id: d.generate_task_id ?? undefined,
    output_asset_ids: d.output_asset_ids ?? undefined,
    error_message: d.generate_error ?? undefined,
  };
}

export function foldFlatIntoNodeData(
  kind: CanvasNodeKind,
  flat: Partial<FlatNodeFields>,
  existing?: ApiCanvasNodeData | null,
): ApiCanvasNodeData {
  const base: ApiCanvasNodeData = { ...(existing ?? {}) };
  const config = { ...(base.config ?? {}) };
  if (flat.title !== undefined) base.title = flat.title;
  if (flat.model_id !== undefined) {
    base.model = flat.model_id ?? null;
    config.model = flat.model_id ?? null;
  }
  if (flat.voice_id !== undefined) config.voice_id = flat.voice_id ?? null;
  if (flat.ratio !== undefined) config.ratio = flat.ratio ?? null;
  if (flat.resolution !== undefined) config.resolution = flat.resolution ?? null;
  if (flat.duration_sec !== undefined) {
    config.duration_sec = flat.duration_sec ?? null;
    config.duration = flat.duration_sec != null ? String(flat.duration_sec) : null;
  }
  if (kind === 'text') {
    // text：input_prompt → prompt + prompt_content；output_text → content 正文
    if (flat.input_prompt !== undefined) {
      const trimmed = flat.input_prompt.trim();
      base.prompt = flat.input_prompt;
      base.prompt_content = trimmed ? [{ type: 'text' as const, text: trimmed }] : [];
    }
    if (flat.output_text !== undefined) base.content = flat.output_text;
  } else if (flat.input_prompt !== undefined) {
    base.prompt = flat.input_prompt;
    const existingContent = Array.isArray(base.content) ? [...base.content] : [];
    const nonText = existingContent.filter(
      (seg) => seg && typeof seg === 'object' && (seg as { type?: string }).type !== 'text',
    );
    base.content = flat.input_prompt
      ? [{ type: 'text' as const, text: flat.input_prompt }, ...nonText]
      : nonText.length
        ? nonText
        : null;
  }
  base.config = Object.values(config).some((v) => v != null && v !== '') ? config : null;
  return stripNodeDataProjectionForPatch(base);
}

/** 手动/节点生成前：把 rich submit_content 整包写入 data */
export function foldSubmitContentIntoNodeData(
  kind: CanvasNodeKind,
  opts: {
    plain_prompt: string;
    submit_content?: WorkflowPromptContent | null;
    model_id?: string | null;
    voice_id?: string | null;
    ratio?: string | null;
    resolution?: string | null;
    duration_sec?: number | null;
  },
  existing?: ApiCanvasNodeData | null,
): ApiCanvasNodeData {
  const base: ApiCanvasNodeData = { ...(existing ?? {}) };
  const config = { ...(base.config ?? {}) };
  const plain = opts.plain_prompt;
  if (opts.model_id !== undefined) {
    base.model = opts.model_id;
    config.model = opts.model_id;
  }
  if (opts.voice_id !== undefined) config.voice_id = opts.voice_id;
  if (opts.ratio !== undefined) config.ratio = opts.ratio;
  if (opts.resolution !== undefined) config.resolution = opts.resolution;
  if (opts.duration_sec !== undefined) {
    config.duration_sec = opts.duration_sec;
    config.duration = opts.duration_sec != null ? String(opts.duration_sec) : null;
  }
  if (kind === 'text') {
    base.prompt = plain;
    base.prompt_content =
      opts.submit_content && opts.submit_content.length > 0
        ? opts.submit_content
        : plain.trim()
          ? [{ type: 'text' as const, text: plain.trim() }]
          : [];
    // 不碰 content 正文
  } else {
    base.prompt = plain;
    base.content =
      opts.submit_content && opts.submit_content.length > 0
        ? opts.submit_content
        : plain.trim()
          ? [{ type: 'text' as const, text: plain.trim() }]
          : null;
  }
  base.config = Object.values(config).some((v) => v != null && v !== '') ? config : null;
  return stripNodeDataProjectionForPatch(base);
}

export function applyFlatToRfData(
  kind: CanvasNodeKind,
  current: CanvasNodeData,
  patch: Partial<FlatNodeFields>,
): CanvasNodeData {
  /** 同步 flat 展示字段与 payload，避免双轨分叉 */
  const existingPayload = current.payload ?? null;
  const nextPayload = foldFlatIntoNodeData(kind, patch, existingPayload);
  const flat = flattenNodeData(kind, nextPayload);
  return {
    ...current,
    ...flat,
    kind,
    payload: nextPayload,
  };
}

export function viewToFlat(view: CanvasNodeView): FlatNodeFields {
  return flattenNodeData(view.kind, view.data);
}
