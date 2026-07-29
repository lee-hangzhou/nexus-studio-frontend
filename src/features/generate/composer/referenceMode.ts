import type { GenerateKind, GenerateRefImage } from '../types';
import { DEFAULT_GENERATE_MAX_REFERENCE_IMAGES } from '../constants';

/** 与后端 ReferenceMode 对齐 */
export const REF_MODE_FIRST_FRAME = 1;
export const REF_MODE_FIRST_LAST = 2;
export const REF_MODE_OMNI = 3;

export function isImageRef(img: GenerateRefImage) {
  return img.mimeType.startsWith('image/');
}

export function filledRefs(assets: (GenerateRefImage | null)[]): GenerateRefImage[] {
  return assets.filter((item): item is GenerateRefImage => item != null);
}

export function isFirstFrameMode(kind: GenerateKind, referenceMode?: number) {
  return kind === 'video' && referenceMode === REF_MODE_FIRST_FRAME;
}

export function isDualFrameMode(kind: GenerateKind, referenceMode?: number) {
  return kind === 'video' && referenceMode === REF_MODE_FIRST_LAST;
}

export function isFrameSlotMode(kind: GenerateKind, referenceMode?: number) {
  return isFirstFrameMode(kind, referenceMode) || isDualFrameMode(kind, referenceMode);
}

export function resolveMaxReferenceImages(args: {
  kind: GenerateKind;
  referenceMode?: number;
  materialLimit?: number;
}) {
  if (isFirstFrameMode(args.kind, args.referenceMode)) return 1;
  if (isDualFrameMode(args.kind, args.referenceMode)) return 2;
  return typeof args.materialLimit === 'number' && args.materialLimit > 0
    ? args.materialLimit
    : DEFAULT_GENERATE_MAX_REFERENCE_IMAGES;
}

/** 参考模式切换时规整素材槽位 */
export function normalizeUploadedAssetsForMode(
  kind: GenerateKind,
  referenceMode: number | undefined,
  prev: (GenerateRefImage | null)[],
): (GenerateRefImage | null)[] {
  if (kind !== 'video') {
    return filledRefs(prev);
  }
  if (referenceMode === REF_MODE_FIRST_LAST) {
    if (prev.length >= 2) {
      const first = prev[0] && isImageRef(prev[0]) ? prev[0] : null;
      const last = prev[1] && isImageRef(prev[1]) ? prev[1] : null;
      return [first, last];
    }
    const imgs = filledRefs(prev).filter(isImageRef);
    return [imgs[0] ?? null, imgs[1] ?? null];
  }
  if (referenceMode === REF_MODE_FIRST_FRAME) {
    const img =
      (prev[0] && isImageRef(prev[0]) ? prev[0] : null)
      ?? filledRefs(prev).find(isImageRef)
      ?? null;
    return img ? [img] : [];
  }
  return filledRefs(prev);
}

export function editorPlaceholderForMode(kind: GenerateKind, referenceMode?: number) {
  if (isDualFrameMode(kind, referenceMode)) {
    return '请上传首尾两张参考图，并描述镜头如何从首帧过渡到尾帧';
  }
  if (isFirstFrameMode(kind, referenceMode)) {
    return '请上传首帧参考图，并描述你想生成的视频';
  }
  return '结合参考、输入文字或 @ 引用参考素材，描述你想如何调整图片';
}
