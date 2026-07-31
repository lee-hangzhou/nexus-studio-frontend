import { describe, expect, it } from 'vitest';

import {
  detectComposerTrigger,
  filterByQuery,
  stripComposerTrigger,
} from './detectComposerTrigger';

describe('detectComposerTrigger', () => {
  it('detects @ at start', () => {
    expect(detectComposerTrigger('@广', 2)).toEqual({
      kind: 'at',
      query: '广',
      start: 0,
    });
  });

  it('recovers when caret lags behind a leading trigger', () => {
    expect(detectComposerTrigger('/', 0)).toEqual({
      kind: 'slash',
      query: '',
      start: 0,
    });
    expect(detectComposerTrigger('@广告', 0)).toEqual({
      kind: 'at',
      query: '广告',
      start: 0,
    });
  });

  it('detects / after whitespace', () => {
    const text = '帮我 /docx';
    expect(detectComposerTrigger(text, text.length)).toEqual({
      kind: 'slash',
      query: 'docx',
      start: 3,
    });
  });

  it('ignores @ inside email-like tokens', () => {
    const text = 'a@b';
    expect(detectComposerTrigger(text, text.length)).toBeNull();
  });

  it('ignores / in urls', () => {
    const text = 'https://x.com/a';
    expect(detectComposerTrigger(text, text.length)).toBeNull();
  });

  it('strips trigger and query', () => {
    expect(stripComposerTrigger('请 @广告 处理', { start: 2 }, 5)).toBe('请  处理');
  });

  it('filters by query', () => {
    const items = [{ name: '广告策略与分析' }, { name: '市场与竞品研究' }];
    expect(filterByQuery(items, '广告', (item) => item.name)).toEqual([
      { name: '广告策略与分析' },
    ]);
  });
});
