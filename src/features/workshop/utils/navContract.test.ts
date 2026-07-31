import { describe, expect, it } from 'vitest';
import { WORKSPACE_NAV_ITEMS } from '../../../app/layout/workspaceNav';

describe('超级工坊 navigation', () => {
  it('has exactly one 超级工坊 entry pointing at /chat', () => {
    const workshopEntries = WORKSPACE_NAV_ITEMS.filter((item) => item.label === '超级工坊');
    expect(workshopEntries).toHaveLength(1);
    expect(workshopEntries[0]?.to).toBe('/chat');
  });

  it('places 超级工坊 above 创作', () => {
    const labels = WORKSPACE_NAV_ITEMS.map((item) => item.label);
    expect(labels.indexOf('超级工坊')).toBeLessThan(labels.indexOf('创作'));
  });

  it('does not expose a sibling 工坊项目 or AI 对话 nav label', () => {
    const labels = WORKSPACE_NAV_ITEMS.map((item) => item.label);
    expect(labels).not.toContain('工坊项目');
    expect(labels).not.toContain('AI 对话');
  });
});
