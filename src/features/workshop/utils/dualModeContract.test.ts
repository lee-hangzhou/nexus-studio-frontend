import { describe, expect, it } from 'vitest';
import { isIdleChatIntent, shouldProposeWorkshopUpgrade } from './upgradeIntent';

describe('超级工坊 dual-mode intent', () => {
  it('defaults to no upgrade for ordinary Q&A', () => {
    expect(shouldProposeWorkshopUpgrade('帮我解释一下这段文案')).toBe(false);
  });

  it('proposes upgrade on long-running or scheduled intent', () => {
    expect(shouldProposeWorkshopUpgrade('帮我做一个长期跟进的店铺周报，每周定时跑')).toBe(true);
  });

  it('does not propose upgrade when user only wants chat', () => {
    expect(isIdleChatIntent('只是聊聊，不要开工')).toBe(true);
    expect(shouldProposeWorkshopUpgrade('只是聊聊，不要开工')).toBe(false);
  });
});
