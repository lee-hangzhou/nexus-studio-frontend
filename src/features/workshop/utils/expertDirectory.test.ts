import { describe, expect, it } from 'vitest';

import {
  LOCAL_EXPERT_DIRECTORY,
  expertDirectoryViewState,
  filterExpertDirectory,
  findExpertByKey,
  resolveSpeakerAttribution,
} from './expertDirectory';

describe('expertDirectory', () => {
  it('includes host and six ecommerce experts', () => {
    const businessExperts = LOCAL_EXPERT_DIRECTORY.filter((item) => item.key !== 'host');
    expect(businessExperts).toHaveLength(6);
    expect(findExpertByKey('host')).toBeTruthy();
    expect(businessExperts.every((item) => !item.name.includes('顾问'))).toBe(true);
    expect(businessExperts.every((item) => !item.name.includes('执行'))).toBe(true);
  });

  it('filters by scope and search without scene tabs in product UI', () => {
    const filtered = filterExpertDirectory({
      items: LOCAL_EXPERT_DIRECTORY,
      scope: 'platform',
      query: '广告',
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.name).toContain('广告');
  });

  it('resolves speaker attribution from roster id first', () => {
    const speaker = resolveSpeakerAttribution({
      expert_id: 'expert-1',
      roster: [{ id: 'expert-1', name: '项目内专家', avatar_url: '/avatars/experts/custom.png' }],
    });
    expect(speaker?.name).toBe('项目内专家');
    expect(speaker?.avatar_url).toContain('/avatars/experts/custom.png');
  });

  it('resolves speaker attribution from preset key via directory', () => {
    const speaker = resolveSpeakerAttribution({
      expert_id: 'ecom_listing_planner_executor',
      speaker_role: 'executor',
    });
    expect(speaker?.name).toContain('商品策划');
    expect(speaker?.avatar_url).toContain('/avatars/experts/');
  });

  it('covers loading, empty, and error states for directory', () => {
    expect(expertDirectoryViewState({ loading: true, items: [] }).status).toBe('loading');
    expect(expertDirectoryViewState({ loading: false, items: [] }).status).toBe('empty');
    expect(
      expertDirectoryViewState({ loading: false, items: [], error: '加载失败' }).status,
    ).toBe('error');
    expect(
      expertDirectoryViewState({ loading: false, items: LOCAL_EXPERT_DIRECTORY }).status,
    ).toBe('ready');
  });
});
