import type {
  GenerateTaskListItem,
  GenerateTaskKind,
  GenerateTaskView,
} from '../../../api/generate';
import type { GenerateFeedItem, GenerateKind } from '../types';

function toFeatureKind(kind: GenerateTaskKind): GenerateKind | null {
  if (kind === 'image' || kind === 'video') return kind;
  return null;
}

/** 历史列表轻量条目 → 侧栏展示（仅首图预览） */
export function toFeedItemFromTaskList(view: GenerateTaskListItem): GenerateFeedItem | null {
  const kind = toFeatureKind(view.kind);
  if (kind === null) return null;

  return {
    id: String(view.task_id),
    kind,
    status: view.status,
    prompt: view.prompt,
    modelId: view.model_id,
    modelLabel: view.model_id.replace(/-/g, ' '),
    createdAt: view.created_at,
    resultCount: view.result_count ?? 0,
    resultImages: view.preview_url
      ? [{ url: view.preview_url, type: view.preview_media_type ?? undefined }]
      : undefined,
    favorite: view.is_favorited ?? false,
    errorMessage: view.error_message ?? undefined,
    ratio: view.ratio ?? undefined,
    resolution: view.resolution ?? undefined,
    duration: view.duration ?? undefined,
    referenceMode: view.reference_mode ?? undefined,
    queuePosition: view.queue_position ?? null,
    queueTotal: view.queue_total ?? null,
    estimatedWaitSeconds: view.estimated_wait_seconds ?? null,
  };
}

/** 任务详情 / 轮询 → 完整 FeedItem */
export function toFeedItem(view: GenerateTaskView): GenerateFeedItem | null {
  const kind = toFeatureKind(view.kind);
  if (kind === null) return null;

  return {
    id: String(view.task_id),
    kind,
    status: view.status,
    prompt: view.prompt,
    modelId: view.model_id,
    modelLabel: view.model_id.replace(/-/g, ' '),
    createdAt: view.created_at,
    resultCount: view.result_count,
    resultImages: view.result_urls?.map((r) => ({
      url: r.url,
      type: r.type,
      width: r.width,
      height: r.height,
    })),
    favorite: view.is_favorited,
    errorMessage: view.error_message ?? undefined,
    refImages: view.ref_materials?.map((m) => ({
      id: `asset-${m.asset_id}`,
      assetId: m.asset_id,
      url: m.url,
      name: m.filename,
      mimeType: m.mime_type,
    })),
    ratio: view.ratio ?? undefined,
    resolution: view.resolution ?? undefined,
    duration: view.duration ?? undefined,
    referenceMode: view.reference_mode ?? undefined,
    queuePosition: view.queue_position ?? null,
    queueTotal: view.queue_total ?? null,
    estimatedWaitSeconds: view.estimated_wait_seconds ?? null,
  };
}

/** 详情更新后同步侧栏缩略图等字段 */
export function toHistoryListPatch(detail: GenerateFeedItem): Partial<GenerateFeedItem> {
  const preview = detail.resultImages?.[0];
  return {
    status: detail.status,
    prompt: detail.prompt,
    resultCount: detail.resultCount,
    resultImages: preview ? [preview] : detail.resultImages,
    favorite: detail.favorite,
    errorMessage: detail.errorMessage,
    queuePosition: detail.queuePosition,
    queueTotal: detail.queueTotal,
    estimatedWaitSeconds: detail.estimatedWaitSeconds,
  };
}
