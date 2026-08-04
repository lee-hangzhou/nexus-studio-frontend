import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('UpgradeInviteConfirmModal', () => {
  it('keeps confirm/decline without instructional helper copy', () => {
    const source = readFileSync(
      path.join(__dirname, 'UpgradeInviteConfirmModal.tsx'),
      'utf8',
    );
    expect(source).toContain('升级为工坊项目');
    expect(source).toContain('确认升级');
    expect(source).toContain('拒绝');
    expect(source).toContain('selected.length === 0');
    expect(source).not.toContain('可不选专家');
    expect(source).not.toContain('本次不邀请专家');
  });
});
