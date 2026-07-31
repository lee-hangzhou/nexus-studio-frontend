import { describe, expect, it } from 'vitest';

import {
  hostScopesAreIndependent,
  requiresOperationHashConfirmation,
  selectedScopesToCapabilities,
  toggleHostScope,
} from './authScopes';
import { HOST_AUTH_SCOPES, type HostAuthScope } from '../types';

describe('authScopes', () => {
  it('toggles host scopes independently', () => {
    let selected = new Set<HostAuthScope>();
    selected = toggleHostScope(selected, 'BROWSER_WRITE');
    selected = toggleHostScope(selected, 'CREATE_SCHEDULE');
    expect(selected.has('BROWSER_WRITE')).toBe(true);
    expect(selected.has('CREATE_SCHEDULE')).toBe(true);
    expect(selected.has('TAOBAO_STORE_WRITE')).toBe(false);

    selected = toggleHostScope(selected, 'BROWSER_WRITE');
    expect(selected.has('BROWSER_WRITE')).toBe(false);
    expect(selected.has('CREATE_SCHEDULE')).toBe(true);
    expect(hostScopesAreIndependent(selected)).toBe(true);
  });

  it('maps only selected scopes to capabilities', () => {
    const selected = new Set<HostAuthScope>(['GENERATION_SUBMIT', 'CREATE_SCHEDULE']);
    expect(selectedScopesToCapabilities(selected)).toEqual([
      'generation_submit',
      'create_schedule',
    ]);
    expect(requiresOperationHashConfirmation(selected)).toBe(true);
  });

  it('covers all host scopes in catalog', () => {
    expect(HOST_AUTH_SCOPES).toHaveLength(4);
  });
});
