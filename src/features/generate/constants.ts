import type { GenerateKind } from './types';

/** 创作页/模型未返回 material_limits 时的参考图软上限 */
export const DEFAULT_GENERATE_MAX_REFERENCE_IMAGES = 12;

/** 胶片条中「最近」条数上限（不含置顶） */
export const FILMSTRIP_RECENT_LIMIT = 5;

/** 置顶收藏最多展示在胶片条中的条数 */
export const FILMSTRIP_PINNED_MAX = 2;

/** 胶片条最多展示的缩略图总数（含当前选中） */
export const FILMSTRIP_DISPLAY_MAX = 7;

export const CREATE_INSPIRATIONS: {
  label: string;
  prompt: string;
  kind: GenerateKind;
}[] = [
  {
    label: '电影感夜景',
    kind: 'image',
    prompt: '赛博朋克城市夜景，霓虹在湿润路面反射，浅景深，电影级调色',
  },
  {
    label: '古风意境',
    kind: 'image',
    prompt: '古风庭院晨光，竹林剪影，水墨留白，柔和雾气',
  },
  {
    label: '雨夜推进',
    kind: 'video',
    prompt: '雨夜街道缓慢推进镜头，行人撑伞，胶片颗粒，环境声氛围',
  },
  {
    label: '产品特写',
    kind: 'image',
    prompt: '极简产品特写，柔光棚拍，干净背景，高级质感',
  },
];
