import type { GenerateRefImage } from '../types';
import type {
  CanvasMentionProvider,
  WorkflowMentionItem,
  WorkflowMentionMediaType,
} from './promptEditor/types';

const MENTION_TYPE_LABEL: Record<WorkflowMentionMediaType, string> = {
  image: '图片',
  video: '视频',
  audio: '音频',
  text: '文本',
};

export function parseAssetIdFromMentionId(id: string): number {
  const matched = /^asset-(\d+)$/.exec(id);
  if (matched) {
    return Number(matched[1]);
  }
  const numeric = Number(id);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
}

export function collectReferencedAssetIds(items: WorkflowMentionItem[]): Set<number> {
  const ids = new Set<number>();
  for (const item of items) {
    if (typeof item.assetId === 'number' && item.assetId > 0) {
      ids.add(item.assetId);
      continue;
    }
    const parsed = parseAssetIdFromMentionId(item.id);
    if (parsed > 0) {
      ids.add(parsed);
    }
  }
  return ids;
}

export function resolveMentionDisplayLabel(item: WorkflowMentionItem): string {
  const name = item.name?.trim();
  if (name) {
    return name;
  }
  return item.label;
}

export function assignMentionLabels(assets: WorkflowMentionItem[]): WorkflowMentionItem[] {
  const counts: Record<WorkflowMentionMediaType, number> = {
    image: 0,
    video: 0,
    audio: 0,
    text: 0,
  };
  return assets.map((asset) => {
    counts[asset.type] += 1;
    return {
      ...asset,
      label: `${MENTION_TYPE_LABEL[asset.type]}${counts[asset.type]}`,
    };
  });
}

export function filterMentionItems(assets: WorkflowMentionItem[], query: string): WorkflowMentionItem[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return assets;
  }
  return assets.filter((item) => {
    const label = item.label.toLowerCase();
    const name = (item.name ?? '').toLowerCase();
    const text = (item.textContent ?? '').toLowerCase();
    return label.includes(q) || name.includes(q) || text.includes(q);
  });
}

export function createMentionProvider(
  referenceAssetsOrGetter: WorkflowMentionItem[] | (() => WorkflowMentionItem[]),
): CanvasMentionProvider {
  const getReferenceAssets =
    typeof referenceAssetsOrGetter === 'function' ? referenceAssetsOrGetter : () => referenceAssetsOrGetter;
  return {
    getItems: (query) => filterMentionItems(getReferenceAssets(), query),
    getReferenceAssets,
  };
}

export const emptyMentionProvider: CanvasMentionProvider = createMentionProvider([]);

export function refsToMentionItems(refs: GenerateRefImage[]): WorkflowMentionItem[] {
  return assignMentionLabels(
    refs.map((ref) => {
      const type: WorkflowMentionMediaType = ref.mimeType.startsWith('video/')
        ? 'video'
        : ref.mimeType.startsWith('audio/')
          ? 'audio'
          : 'image';
      return {
        id: ref.assetId != null ? `asset-${ref.assetId}` : ref.id,
        assetId: ref.assetId,
        type,
        label: '',
        name: ref.name,
        previewUrl: ref.url,
      };
    }),
  );
}
