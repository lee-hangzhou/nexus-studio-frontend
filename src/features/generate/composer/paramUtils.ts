import type { GenerateRatio, GenerateResolution } from '../types';

export const PREFERRED_IMAGE_RATIO: GenerateRatio = '4:3';

export function pickImageRatio(options: GenerateRatio[] | undefined): GenerateRatio | undefined {
  if (!options?.length) return undefined;
  return options.includes(PREFERRED_IMAGE_RATIO) ? PREFERRED_IMAGE_RATIO : options[0];
}

export function resolutionLabel(r: GenerateResolution) {
  const normalized = r.toLowerCase();
  if (normalized === '4k') return '超清 4K';
  if (normalized === '3k') return '高清 3K';
  if (normalized === '2k') return '高清 2K';
  if (normalized === '1k') return '标准 1K';
  if (normalized === '0.5k') return '轻量 0.5K';
  return r;
}

export function ratioShape(value: string) {
  const [wRaw, hRaw] = value.split(':');
  const w = Number(wRaw);
  const h = Number(hRaw);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
    return { w: 1, h: 1 };
  }
  return { w, h };
}

export function normalizeRatioOptions(values?: string[]) {
  if (!values?.length) return [];
  return values.map((value) => ({ value, ...ratioShape(value) }));
}

export function referenceModeLabel(
  value?: number,
  options?: { value: number; label: string }[],
) {
  if (value === undefined) return '';
  return options?.find((opt) => opt.value === value)?.label ?? '';
}

export function buildParamsCapsuleLabel(args: {
  kind: 'image' | 'video';
  ratio: string;
  resolution: string;
  count: number;
  duration?: number;
  referenceMode?: number;
  referenceModeOptions?: { value: number; label: string }[];
  durationFallback?: number;
}) {
  if (args.kind === 'image') {
    return `${args.ratio}  ${resolutionLabel(args.resolution)}  ${args.count}张图片`;
  }
  return [
    referenceModeLabel(args.referenceMode, args.referenceModeOptions),
    args.ratio,
    resolutionLabel(args.resolution),
    `${args.duration ?? args.durationFallback ?? ''}秒`,
  ]
    .filter(Boolean)
    .join('  ');
}
