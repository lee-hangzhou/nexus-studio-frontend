/** Model ids/keys that must not appear in any frontend model dropdown. */
const HIDDEN_MODEL_IDS = new Set(['claude-sonnet-4-6']);

function normalizeModelToken(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_]+/g, '-');
}

/** True when a model id/key/label should be hidden from selectable lists. */
export function isHiddenSelectableModel(...tokens: Array<string | null | undefined>): boolean {
  return tokens.some((token) => {
    if (!token) return false;
    return HIDDEN_MODEL_IDS.has(normalizeModelToken(token));
  });
}

export function filterSelectableModels<T>(
  items: T[],
  getTokens: (item: T) => Array<string | null | undefined>,
): T[] {
  return items.filter((item) => !isHiddenSelectableModel(...getTokens(item)));
}
