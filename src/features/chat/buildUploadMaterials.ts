import type { UploadedAttachment } from '../../api/chat';
import type { TurnMaterialBlock } from '../skills/types';
import { isVisionMime, mediaTypeFromMime } from '../skills/mediaType';

export { isVisionMime, mediaTypeFromMime } from '../skills/mediaType';

export function buildMaterialsFromUploads(
  attachments: UploadedAttachment[],
  options: { supportsVision: boolean },
): TurnMaterialBlock[] {
  const eligible = options.supportsVision
    ? attachments
    : attachments.filter((item) => !isVisionMime(item.mime_type));
  return eligible.map((item) => ({
    type: mediaTypeFromMime(item.mime_type),
    origin: 'upload',
    assetId: item.asset_id,
    name: item.filename,
  }));
}
