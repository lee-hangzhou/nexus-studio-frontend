/** 画布 Agent turn 历史默认占位，不是合法 chat model key。 */
export const LEGACY_CHAT_MODEL_KEY = 'default';

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
