import type { CanvasNodeKind } from '../api/canvasTypes';

export const KIND_LABEL: Record<CanvasNodeKind, string> = {
  text: '文本',
  image: '生图',
  video: '生视频',
  audio: '音频',
};

export const DEFAULT_NODE_META: Record<
  CanvasNodeKind,
  { title: string; description: string; model_id?: string; ratio?: string; duration_sec?: number }
> = {
  text: { title: '文本节点', description: '剧情、分镜或提示词' },
  image: { title: '生图节点', description: '角色或场景图', ratio: '16:9' },
  video: { title: '生视频节点', description: '镜头视频', ratio: '16:9', duration_sec: 15 },
  audio: { title: '音频节点', description: '旁白或配乐', duration_sec: 8 },
};
