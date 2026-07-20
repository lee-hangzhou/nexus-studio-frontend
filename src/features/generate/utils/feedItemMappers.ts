import type { GenerateHistoryItemView, GenerateTaskView } from '../../../api/generate';
import type { GenerateFeedItem } from '../types';

/** 历史列表轻量条目 → 侧栏展示（仅首图预览） */
export function toFeedItemFromHistory(view: GenerateHistoryItemView): GenerateFeedItem {
  return {
    id: String(view.task_id),
    kind: view.kind,
    status: view.status,
    prompt: view.prompt,
    modelId: view.model_id,
    modelLabel: view.model_id.replace(/-/g, ' '),
    createdAt: view.created_at,
    resultCount: view.result_count,
    resultImages: view.preview_url
      ? [{ url: view.preview_url, type: view.preview_media_type ?? undefined }]
      : undefined,
    favorite: view.is_favorited,
    errorMessage: view.error_message ?? undefined,
    ratio: view.ratio ?? undefined,
    resolution: view.resolution ?? undefined,
    duration: view.duration ?? undefined,
    referenceMode: view.reference_mode ?? undefined,
    queueStatus: view.queue_status ?? null,
    queuePosition: view.queue_position ?? null,
    queueTotal: view.queue_total ?? null,
    estimatedWaitSeconds: view.estimated_wait_seconds ?? null,
  };
}

/** 任务详情 / 轮询 → 完整 FeedItem */
export function toFeedItem(view: GenerateTaskView): GenerateFeedItem {
  return {
    id: String(view.task_id),
    kind: view.kind,
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
    refImages: view.ref_materials
      ?.filter((m) => typeof m.attachment_id === 'number' || typeof m.asset_id === 'number')
      .map((m) => ({
        id: typeof m.attachment_id === 'number' ? `ref-${m.attachment_id}` : `asset-${m.asset_id}`,
        materialId: m.attachment_id ?? undefined,
        assetId: m.asset_id ?? undefined,
        url: m.url,
        name: m.filename,
        mimeType: m.mime_type,
      })),
    ratio: view.ratio ?? undefined,
    resolution: view.resolution ?? undefined,
    duration: view.duration ?? undefined,
    referenceMode: view.reference_mode ?? undefined,
    queueStatus: view.queue_status ?? null,
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
    queueStatus: detail.queueStatus,
    queuePosition: detail.queuePosition,
    queueTotal: detail.queueTotal,
    estimatedWaitSeconds: detail.estimatedWaitSeconds,
  };
}
