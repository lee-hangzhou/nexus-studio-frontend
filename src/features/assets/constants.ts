import type { AssetKind, AssetSource } from '../../domains/asset/types';

export type AssetKindFilter = 'all' | AssetKind;
export type AssetSourceFilter = 'all' | AssetSource;

export const ASSET_KIND_OPTIONS: { value: AssetKindFilter; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'image', label: '图片' },
  { value: 'video', label: '视频' },
];

export const ASSET_SOURCE_OPTIONS: { value: AssetSourceFilter; label: string }[] = [
  { value: 'all', label: '全部来源' },
  { value: 'generate', label: '创作' },
  { value: 'chat', label: '对话' },
  { value: 'canvas', label: '画布' },
  { value: 'import', label: '导入' },
];

export const ASSET_SOURCE_LABEL: Record<AssetSource, string> = {
  generate: '创作',
  chat: '对话',
  canvas: '画布',
  import: '导入',
};
