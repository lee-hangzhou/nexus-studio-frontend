import type { TurnMaterialBlock, TurnMediaType } from '../../skills/types';
import { mediaTypeFromAssetFields } from '../../skills/mediaType';
import type { CanvasAgentAssetView } from '../api/canvasTypes';

export { materialStableKey } from '../../skills/turnMaterialDisplay';

export function mediaBlockTypeFromAsset(
  asset: Pick<CanvasAgentAssetView, 'asset_type' | 'mime_type'>,
): TurnMediaType {
  return mediaTypeFromAssetFields(asset);
}

/** 构造可上送的 material 块, 不含 previewUrl */
export function turnMaterialFromAgentAsset(asset: CanvasAgentAssetView): TurnMaterialBlock {
  return {
    type: mediaBlockTypeFromAsset(asset),
    origin: 'upload',
    assetId: asset.id,
    name: asset.filename,
  };
}

/** 出站前剥离非 video 的 previewUrl, 避免契约 422 */
export function toWireMaterials(materials: TurnMaterialBlock[]): TurnMaterialBlock[] {
  return materials.map((block) => {
    if (block.type === 'node') {
      return { type: 'node', nodeId: block.nodeId };
    }
    const wire: TurnMaterialBlock = {
      type: block.type,
      origin: block.origin,
      assetId: block.assetId,
    };
    if (block.name !== undefined) {
      wire.name = block.name;
    }
    if (block.type === 'video' && block.previewUrl !== undefined) {
      wire.previewUrl = block.previewUrl;
    }
    return wire;
  });
}
