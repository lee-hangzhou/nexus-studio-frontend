export const VIDEO_PROMPT_PLACEHOLDER =
  '上传最多12个参考素材、输入文字或 @ 参考内容，自由组合图、文、音、视频多元素，定义精彩互动。例如：@图片1 模仿 @视频1 的动作，音色参考 @音频1。';

export const IMAGE_PROMPT_PLACEHOLDER = '描述任何你想要生成的内容';

export const VIDEO_REFERENCE_MODES: { value: number; label: string }[] = [
  { value: 1, label: '首帧参考' },
  { value: 2, label: '首尾帧参考' },
  { value: 3, label: '全能参考' },
  { value: 4, label: '视频编辑' },
];

export const RATIO_OPTIONS = ['16:9', '9:16', '1:1', '4:3', '3:4'];

export const RESOLUTION_OPTIONS = ['2k', '4k'] as const;

export const VIDEO_DURATION_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 4);
