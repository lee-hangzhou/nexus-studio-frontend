const THINK_OPEN_MINIMAX = ['<', 'think', '>'].join('');
const THINK_CLOSE_MINIMAX = ['<', '/think', '>'].join('');

export const THINK_TAG_PAIRS = [
  { open: THINK_OPEN_MINIMAX, close: THINK_CLOSE_MINIMAX },
  { open: '<think>', close: '</think>' },
] as const;

const MAX_TAG_LEN = Math.max(
  ...THINK_TAG_PAIRS.flatMap((pair) => [pair.open.length, pair.close.length]),
);

function findEarliestOpen(text: string): { index: number; open: string; close: string } | null {
  let best: { index: number; open: string; close: string } | null = null;
  for (const pair of THINK_TAG_PAIRS) {
    const index = text.indexOf(pair.open);
    if (index >= 0 && (best == null || index < best.index)) {
      best = { index, open: pair.open, close: pair.close };
    }
  }
  return best;
}

/** 从完整文本中拆分思考区与正文（用于历史消息渲染）。 */
export function splitThinkFromContent(text: string): { think: string; content: string } {
  let think = '';
  let content = '';
  let remain = text;
  let activeClose = '';
  let inThink = false;

  while (remain.length > 0) {
    if (!inThink) {
      const open = findEarliestOpen(remain);
      if (!open) {
        content += remain;
        break;
      }
      content += remain.slice(0, open.index);
      remain = remain.slice(open.index + open.open.length);
      activeClose = open.close;
      inThink = true;
      continue;
    }

    const closeIdx = remain.indexOf(activeClose);
    if (closeIdx < 0) {
      think += remain;
      break;
    }
    think += remain.slice(0, closeIdx);
    remain = remain.slice(closeIdx + activeClose.length);
    inThink = false;
    activeClose = '';
  }

  return { think: think.trim(), content: content.trim() };
}

/** 流式分轨：支持 tag 跨 chunk 拆分，返回需缓存的不完整后缀。 */
export function pushThinkAwareText(
  text: string,
  state: { thinkOpen: boolean; activeClose: string; pending: string },
  emit: { onThink: (delta: string) => void; onAnswer: (delta: string) => void },
): void {
  let remain = state.pending + text;
  state.pending = '';

  while (remain.length > 0) {
    if (!state.thinkOpen) {
      const open = findEarliestOpen(remain);
      if (!open) {
        const [safe, tail] = holdbackPartialTag(remain, THINK_TAG_PAIRS.map((pair) => pair.open));
        if (safe) emit.onAnswer(safe);
        state.pending = tail;
        break;
      }
      const before = remain.slice(0, open.index);
      if (before) emit.onAnswer(before);
      remain = remain.slice(open.index + open.open.length);
      state.thinkOpen = true;
      state.activeClose = open.close;
      continue;
    }

    const closeIdx = remain.indexOf(state.activeClose);
    if (closeIdx < 0) {
      const [safe, tail] = holdbackPartialTag(remain, [state.activeClose]);
      if (safe) emit.onThink(safe);
      state.pending = tail;
      break;
    }
    const inside = remain.slice(0, closeIdx);
    if (inside) emit.onThink(inside);
    remain = remain.slice(closeIdx + state.activeClose.length);
    state.thinkOpen = false;
    state.activeClose = '';
  }
}

function holdbackPartialTag(text: string, tags: string[]): [string, string] {
  const maxHold = Math.min(text.length, MAX_TAG_LEN - 1);
  for (let len = maxHold; len > 0; len -= 1) {
    const tail = text.slice(-len);
    for (const tag of tags) {
      if (tag.startsWith(tail) && tail.length < tag.length) {
        return [text.slice(0, -len), tail];
      }
    }
  }
  return [text, ''];
}
