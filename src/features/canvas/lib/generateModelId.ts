/** 历史占位：新建节点曾写入的假 model_id，不得对用户展示或提交。 */
export const LEGACY_PLACEHOLDER_MODEL_ID = 'default';

export function hasResolvedModelId(modelId: string | undefined | null): modelId is string {
  return (
    typeof modelId === 'string' &&
    modelId.trim().length > 0 &&
    modelId !== LEGACY_PLACEHOLDER_MODEL_ID
  );
}

export function isPlaceholderModelId(modelId: string | undefined | null): boolean {
  return !hasResolvedModelId(modelId);
}
