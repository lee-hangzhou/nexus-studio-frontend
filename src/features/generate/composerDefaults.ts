import type { CreateComposerParams } from './components/CreateComposer';

/** 创作 composer 默认参数；GeneratePage / Foyer 共用，避免分叉默认值。 */
export const DEFAULT_CREATE_COMPOSER_PARAMS: CreateComposerParams = {
  ratio: '4:3',
  resolution: '2k',
  count: 1,
  duration: 5,
  referenceMode: 3,
  model: 'image-5-lite',
};
