import type { CreateComposerSubmitPayload } from '../generate/components/CreateComposer';

export const FOYER_HANDOFF_STATE_KEY = 'foyerHandoff' as const;

/** 首页 → 创作页：携带完整提交载荷并自动开跑。 */
export type FoyerCreateHandoff = {
  version: 1;
  target: 'create';
  autoSubmit: true;
  payload: CreateComposerSubmitPayload;
};

/**
 * 首页 → 超级工坊：文本 + 模型 + 可选本地 File。
 * File 仅 SPA 内存跳转可带；刷新后失效，承接页需容错。
 */
export type FoyerAgentHandoff = {
  version: 1;
  target: 'agent';
  autoSubmit: true;
  model: string;
  message: string;
  files: File[];
};

export type FoyerHandoff = FoyerCreateHandoff | FoyerAgentHandoff;

export type LocationStateWithFoyerHandoff = {
  [FOYER_HANDOFF_STATE_KEY]?: FoyerHandoff;
};

export function isFoyerCreateHandoff(value: unknown): value is FoyerCreateHandoff {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<FoyerCreateHandoff>;
  return (
    item.version === 1
    && item.target === 'create'
    && item.autoSubmit === true
    && item.payload != null
    && typeof item.payload === 'object'
    && typeof item.payload.prompt === 'string'
  );
}

export function isFoyerAgentHandoff(value: unknown): value is FoyerAgentHandoff {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<FoyerAgentHandoff>;
  return (
    item.version === 1
    && item.target === 'agent'
    && item.autoSubmit === true
    && typeof item.model === 'string'
    && typeof item.message === 'string'
    && Array.isArray(item.files)
  );
}
