import type { CanvasNodeData } from '../../schema/canvasSchema';
import type { DirectPredecessor } from '../hooks/useDirectPredecessors';
import type {
  CanvasMentionProvider,
  WorkflowMentionItem,
  WorkflowMentionMediaType,
} from '../../../generate/composer/promptEditor/types';
import {
  assignMentionLabels,
  createMentionProvider,
  filterMentionItems,
  parseAssetIdFromMentionId,
  collectReferencedAssetIds,
  resolveMentionDisplayLabel,
} from '../../../generate/composer/mentionProvider';

export {
  parseAssetIdFromMentionId,
  collectReferencedAssetIds,
  resolveMentionDisplayLabel,
  assignMentionLabels,
  filterMentionItems,
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
  return createMentionProvider(referenceAssetsOrGetter);
}

export const emptyCanvasMentionProvider: CanvasMentionProvider = createCanvasMentionProvider([]);
