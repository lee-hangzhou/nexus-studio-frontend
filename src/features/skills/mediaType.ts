import type { TurnMediaType } from '../skills/types';

/** mime / asset_type → TurnMediaType；Chat 与 Canvas 共用 */
export function mediaTypeFromMime(mimeType: string): TurnMediaType {
  const mime = mimeType.toLowerCase();
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  return 'file';
}

export function mediaTypeFromAssetFields(asset: {
  asset_type?: string;
  mime_type: string;
}): TurnMediaType {
  if (asset.asset_type === 'image' || asset.asset_type === 'video' || asset.asset_type === 'audio') {
    return asset.asset_type;
  }
  return mediaTypeFromMime(asset.mime_type);
}

/** 图像与视频材料需要视觉模型 */
export function isVisionMime(mimeType: string): boolean {
  const mime = mimeType.toLowerCase();
  return mime.startsWith('image/') || mime.startsWith('video/');
}
