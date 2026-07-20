import { DEFAULT_NODE_SIZE } from '../../constants';

/** storyflow 悬浮输入条最小宽度 680，窄节点也拉齐视觉 */
export const FLOAT_PROMPT_MIN_WIDTH = 680;

export function resolveFloatPromptWidth(
  nodeWidth: number | undefined | null,
  kind: keyof typeof DEFAULT_NODE_SIZE,
): number {
  const base = typeof nodeWidth === 'number' && nodeWidth > 0 ? nodeWidth : DEFAULT_NODE_SIZE[kind].width;
  return Math.max(base, FLOAT_PROMPT_MIN_WIDTH);
}
