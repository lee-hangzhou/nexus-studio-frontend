import {
  HOST_AUTH_SCOPES,
  HOST_SCOPE_TO_CAPABILITY,
  type HostAuthScope,
  type WorkshopToolCapability,
} from '../types';

export function toggleHostScope(
  selected: ReadonlySet<HostAuthScope>,
  scope: HostAuthScope,
): Set<HostAuthScope> {
  const next = new Set(selected);
  if (next.has(scope)) {
    next.delete(scope);
  } else {
    next.add(scope);
  }
  return next;
}

export function hostScopesAreIndependent(
  selected: ReadonlySet<HostAuthScope>,
): boolean {
  return HOST_AUTH_SCOPES.every((scope) => {
    const alone = new Set<HostAuthScope>([scope]);
    return toggleHostScope(alone, scope).size === 0;
  }) && selected.size <= HOST_AUTH_SCOPES.length;
}

export function selectedScopesToCapabilities(
  selected: ReadonlySet<HostAuthScope>,
): WorkshopToolCapability[] {
  return HOST_AUTH_SCOPES.filter((scope) => selected.has(scope)).map(
    (scope) => HOST_SCOPE_TO_CAPABILITY[scope],
  );
}

export function requiresOperationHashConfirmation(
  selected: ReadonlySet<HostAuthScope>,
): boolean {
  return selected.has('TAOBAO_STORE_WRITE') || selected.has('GENERATION_SUBMIT');
}

export function hashChangeRequiresReconfirm(
  confirmedHash: string | null,
  currentHash: string,
): boolean {
  return confirmedHash !== null && confirmedHash !== currentHash;
}

export function hostScopeLabel(scope: HostAuthScope): string {
  const labels: Record<HostAuthScope, string> = {
    TAOBAO_STORE_WRITE: '修改淘宝 / 天猫店铺内容',
    BROWSER_WRITE: '代你操作网页',
    GENERATION_SUBMIT: '提交图片或视频生成',
    CREATE_SCHEDULE: '按计划自动运行',
  };
  return labels[scope];
}
