import { useMemo } from 'react';
import { refsToMentionItems } from '../../../generate/composer';
import type { GenerateRefImage } from '../../../generate/types';
import type { CanvasNodeData } from '../../schema/canvasSchema';
import type { WorkflowMentionItem } from '../components/CanvasPromptEditor/types';

/**
 * 节点 library_refs（资产库参考）→ rail 与 @ 提及。
 * 节点上传结果不进入此路径。
 */
export function useLibraryRefAssets(data: Pick<CanvasNodeData, 'payload'>): {
  libraryAssets: GenerateRefImage[];
  libraryMentionItems: WorkflowMentionItem[];
  selfLibraryRefs: number[];
} {
  const libraryAssets = useMemo(() => {
    const items: GenerateRefImage[] = [];
    for (const [index, ref] of (data.payload.library_refs ?? []).entries()) {
      if (typeof ref.asset_id !== 'number' || ref.asset_id <= 0) continue;
      items.push({
        id: `library-${ref.asset_id}-${index}`,
        assetId: ref.asset_id,
        url: ref.url || ref.thumb_url || '',
        name: ref.name || `资产 ${ref.asset_id}`,
        mimeType: ref.type === 'video' ? 'video/*' : 'image/*',
      });
    }
    return items;
  }, [data.payload.library_refs]);

  const selfLibraryRefs = useMemo(
    () =>
      libraryAssets
        .map((item) => item.assetId)
        .filter((id): id is number => typeof id === 'number' && id > 0),
    [libraryAssets],
  );

  const libraryMentionItems = useMemo(() => refsToMentionItems(libraryAssets), [libraryAssets]);

  return { libraryAssets, libraryMentionItems, selfLibraryRefs };
}
