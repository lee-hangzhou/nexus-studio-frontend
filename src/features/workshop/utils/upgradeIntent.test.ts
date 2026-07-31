import { describe, expect, it } from 'vitest';
import { isIdleChatIntent, shouldProposeWorkshopUpgrade } from './upgradeIntent';

describe('upgradeIntent', () => {
  it('proposes upgrade for long-running or scheduled intent', () => {
    expect(shouldProposeWorkshopUpgrade('帮我每周自动复盘投放')).toBe(true);
    expect(shouldProposeWorkshopUpgrade('想做一个长期多专家协作项目')).toBe(true);
  });

  it('does not propose upgrade for idle chat', () => {
    expect(shouldProposeWorkshopUpgrade('只是聊聊，不要开工')).toBe(false);
    expect(isIdleChatIntent('先别开工，随便问问')).toBe(true);
  });

  it('does not propose upgrade for ordinary Q&A', () => {
    expect(shouldProposeWorkshopUpgrade('淘宝标题怎么写比较好')).toBe(false);
  });
});
