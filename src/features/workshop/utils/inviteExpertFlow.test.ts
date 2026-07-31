import { describe, expect, it } from 'vitest';

import { confirmInviteUpgradeCopy } from './inviteExpertFlow';

describe('inviteExpertFlow', () => {
  it('builds short confirm copy without teaching prose', () => {
    const copy = confirmInviteUpgradeCopy('商品策划与文案');
    expect(copy.title).toBe('升级为项目并邀请');
    expect(copy.content).toContain('商品策划与文案');
    expect(copy.content).toContain('保存为项目');
    expect(copy.okText).toBe('邀请');
    expect(copy.title).not.toMatch(/。/);
    expect(copy.okText).not.toMatch(/。/);
  });
});
