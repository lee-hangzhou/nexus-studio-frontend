/** 画布 Agent turn 历史默认占位，不是合法 chat model key。 */
export const LEGACY_CHAT_MODEL_KEY = 'default';

/** 前端模型下拉默认值；仅当目录含该 key 时选用 */
export const DEFAULT_CHAT_MODEL_KEY = 'deepseek-v4-pro';

export function hasResolvedChatModelKey(modelKey: string | undefined | null): modelKey is string {
  return (
    typeof modelKey === 'string' &&
    modelKey.trim().length > 0 &&
    modelKey !== LEGACY_CHAT_MODEL_KEY
  );
}

export function isPlaceholderChatModelKey(modelKey: string | undefined | null): boolean {
  return !hasResolvedChatModelKey(modelKey);
}

/** 在目录中解析：优先已存 key，否则默认 DEFAULT_CHAT_MODEL_KEY，不再取列表首项 */
export function pickChatModelKey(
  items: ReadonlyArray<{ key: string }>,
  stored: string | undefined,
): string | undefined {
  if (hasResolvedChatModelKey(stored) && items.some((m) => m.key === stored)) {
    return stored;
  }
  if (items.some((m) => m.key === DEFAULT_CHAT_MODEL_KEY)) {
    return DEFAULT_CHAT_MODEL_KEY;
  }
  return undefined;
}
