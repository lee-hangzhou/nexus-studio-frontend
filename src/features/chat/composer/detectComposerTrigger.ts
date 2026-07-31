export type ComposerTriggerKind = 'at' | 'slash';

export type ComposerTriggerMatch = {
  kind: ComposerTriggerKind;
  /** `@` / `/` 之后、光标之前的查询串 */
  query: string;
  /** `@` / `/` 在全文中的起始下标 */
  start: number;
};

/**
 * 检测光标前是否处于 @专家 或 /技能 触发态。
 * 触发符须在行首或空白之后，避免吃掉邮箱、URL 路径。
 */
export function detectComposerTrigger(
  value: string,
  caret: number,
): ComposerTriggerMatch | null {
  // 受控输入下 caret 偶发仍为 0，但值已是 "@"/"/"：按末尾检测，避免刚触发却弹不出
  let pos = caret;
  if (pos < 1 && value.length > 0) {
    pos = value.length;
  }
  if (pos < 1 || pos > value.length) return null;
  const before = value.slice(0, pos);
  const match = /(?:^|[\s\n])([@/])([^\s@/]*)$/.exec(before);
  if (!match) return null;
  const symbol = match[1];
  const query = match[2] ?? '';
  const start = before.length - symbol.length - query.length;
  return {
    kind: symbol === '@' ? 'at' : 'slash',
    query,
    start,
  };
}

/** 选中后去掉触发符与查询串 */
export function stripComposerTrigger(
  value: string,
  trigger: Pick<ComposerTriggerMatch, 'start'>,
  caret: number,
): string {
  const end = Math.max(caret, trigger.start);
  return `${value.slice(0, trigger.start)}${value.slice(end)}`;
}

export function filterByQuery<T>(
  items: T[],
  query: string,
  getText: (item: T) => string,
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => getText(item).toLowerCase().includes(q));
}
