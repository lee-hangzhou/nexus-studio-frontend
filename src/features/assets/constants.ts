import type { AssetKind, AssetSource } from '../../domains/asset/types';

export type AssetKindFilter = 'all' | AssetKind;
export type AssetSourceFilter = 'all' | AssetSource;
/** 来源域：产品面，不含导入 */
export type AssetDomainFilter = 'all' | Exclude<AssetSource, 'import'>;

export const ASSET_KIND_OPTIONS: { value: AssetKindFilter; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'image', label: '图片' },
  { value: 'video', label: '视频' },
];

/** 来源域：创作 / 超级工坊 / 画布 */
export const ASSET_DOMAIN_OPTIONS: { value: AssetDomainFilter; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'generate', label: '创作' },
  { value: 'chat', label: '超级工坊' },
  { value: 'canvas', label: '画布' },
];

export const ASSET_SOURCE_LABEL: Record<AssetSource, string> = {
  generate: '创作',
  chat: '超级工坊',
  canvas: '画布',
  import: '导入',
};
