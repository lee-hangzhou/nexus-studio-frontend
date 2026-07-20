import type { GenerateFeedItem, GenerateKind } from '../types';

export interface PreviewSlide {
  taskId: string;
  mediaIndex: number;
  url: string;
  isVideo: boolean;
  kind: GenerateKind;
}

/** 与右侧历史列表一致：创建时间从新到旧，同任务内按 resultImages 下标 0→N */
function compareTasksNewestFirst(a: GenerateFeedItem, b: GenerateFeedItem): number {
  const t = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  if (t !== 0) return t;
  const idA = Number(a.id);
  const idB = Number(b.id);
  if (Number.isFinite(idA) && Number.isFinite(idB)) return idB - idA;
  return b.id.localeCompare(a.id);
}

/** 将成功任务的结果展平为可预览列表 */
export function buildPreviewSlides(items: GenerateFeedItem[]): PreviewSlide[] {
  const slides: PreviewSlide[] = [];
  const successItems = items
    .filter((item) => item.status === 'success' && (item.resultImages?.length ?? 0) > 0)
    .sort(compareTasksNewestFirst);

  for (const item of successItems) {
    const media = item.resultImages ?? [];
    const isVideo = item.kind === 'video';
    media.forEach((m, mediaIndex) => {
      if (!m.url) return;
      slides.push({
        taskId: item.id,
        mediaIndex,
        url: m.url,
        isVideo: isVideo || m.type === 3,
        kind: item.kind,
      });
    });
  }
  return slides;
}

export function findPreviewIndex(
  slides: PreviewSlide[],
  taskId: string,
  mediaIndex: number,
): number {
  const idx = slides.findIndex((s) => s.taskId === taskId && s.mediaIndex === mediaIndex);
  return idx >= 0 ? idx : 0;
}
