import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('UpgradeInviteConfirmModal', () => {
  it('requires at least one expert and exposes confirm/decline', () => {
    const source = readFileSync(
      path.join(__dirname, 'UpgradeInviteConfirmModal.tsx'),
      'utf8',
    );
    expect(source).toContain('至少选择一位专家');
    expect(source).toContain('确认升级');
    expect(source).toContain('拒绝');
    expect(source).toContain('selected.length >= 1');
  });
});
