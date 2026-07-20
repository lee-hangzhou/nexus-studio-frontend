import type { CanvasNodeData } from '../../schema/canvasSchema';
import type { DirectPredecessor } from '../hooks/useDirectPredecessors';
import type {
  CanvasMentionProvider,
  WorkflowMentionItem,
  WorkflowMentionMediaType,
} from '../components/CanvasPromptEditor/types';

const MENTION_TYPE_LABEL: Record<WorkflowMentionMediaType, string> = {
  image: '图片',
  video: '视频',
  audio: '音频',
  text: '文本',
};

function hasNonEmptyPath(path: unknown): path is string {
  return typeof path === 'string' && path.trim() !== '';
}

function connectedNodeMentionName(title: string | undefined): string | undefined {
  const trimmed = title?.trim();
  return trimmed || undefined;
}

function firstAssetUrl(data: CanvasNodeData): string | undefined {
  const url = data.output_asset_urls?.[0]?.trim();
  return url || undefined;
}

function firstAssetId(data: CanvasNodeData): number | undefined {
  const id = data.output_asset_ids?.[0];
  return typeof id === 'number' && id > 0 ? id : undefined;
}

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

/** 直接前置节点 → 已连接节点列表 */
export function mapConnectedPredecessorsToMentionItems(
  predecessors: DirectPredecessor[],
): WorkflowMentionItem[] {
  const items: WorkflowMentionItem[] = [];

  for (const node of predecessors) {
    const data = node.data;
    if (node.type === 'text') {
      const text = data.output_text?.trim() ?? '';
      if (!text) {
        continue;
      }
      items.push({
        id: node.id,
        type: 'text',
        source: 'connected',
        label: '',
        name: connectedNodeMentionName(data.title),
        textContent: text,
      });
      continue;
    }

    const previewUrl = firstAssetUrl(data);
    if (!hasNonEmptyPath(previewUrl)) {
      continue;
    }
    const assetId = firstAssetId(data);
    items.push({
      id: node.id,
      type: node.type,
      source: 'connected',
      label: '',
      name: connectedNodeMentionName(data.title),
      previewUrl,
      ...(assetId != null ? { assetId } : {}),
    });
  }

  return items;
}

export function pickConnectedMediaMentionItems(
  assets: WorkflowMentionItem[],
  allowedTypes: WorkflowMentionMediaType[] = ['image'],
): WorkflowMentionItem[] {
  return assets.filter(
    (item) =>
      item.source === 'connected' &&
      allowedTypes.includes(item.type) &&
      item.type !== 'text' &&
      hasNonEmptyPath(item.previewUrl),
  );
}

export function createCanvasMentionProvider(
  referenceAssetsOrGetter: WorkflowMentionItem[] | (() => WorkflowMentionItem[]),
): CanvasMentionProvider {
  const getReferenceAssets =
    typeof referenceAssetsOrGetter === 'function' ? referenceAssetsOrGetter : () => referenceAssetsOrGetter;
  return {
    getItems: (query) => filterMentionItems(getReferenceAssets(), query),
    getReferenceAssets,
  };
}

export const emptyCanvasMentionProvider: CanvasMentionProvider = createCanvasMentionProvider([]);
