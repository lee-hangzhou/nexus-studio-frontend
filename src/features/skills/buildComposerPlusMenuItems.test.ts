import { describe, expect, it } from 'vitest';

import { LOCAL_EXPERT_DIRECTORY } from '../workshop/utils/expertDirectory';
import {
  buildComposerPlusMenuSpecs,
  composerPlusMenuHasRequiredEntries,
  flattenMenuLabels,
} from './buildComposerPlusMenuItems';

describe('ComposerPlusMenu items', () => {
  const base = {
    onUploadFile: async () => undefined,
    skillsEnabled: true,
    skillsLoading: false,
    availableSkillLabels: [{ key: 'skill:user:demo', name: '演示技能', path: 'demo' }],
    onSkillSelect: () => undefined,
    onSkillsManage: () => undefined,
    experts: {
      loading: false,
      items: LOCAL_EXPERT_DIRECTORY.slice(0, 3),
      selectedKey: null,
      onSelect: () => undefined,
      onBrowseMore: () => undefined,
    },
    connectors: {
      loading: false,
      items: [{ key: 'taobao_shop', name: '淘宝店铺', description: '', scope: 'platform' as const }],
      onSelect: () => undefined,
    },
  };

  it('includes file, send-to, and skill; excludes invite and connectors', () => {
    const withSendTo = buildComposerPlusMenuSpecs({
      ...base,
      experts: { ...base.experts!, menuLabel: '发给' },
      connectors: null,
    });
    expect(composerPlusMenuHasRequiredEntries(withSendTo)).toBe(true);
    expect(flattenMenuLabels(withSendTo)).not.toContain('连接器');
    expect(flattenMenuLabels(withSendTo)).not.toContain('邀请进项目');
  });

  it('shows expert names in submenu', () => {
    const labels = flattenMenuLabels(buildComposerPlusMenuSpecs(base));
    expect(labels).toContain('市场与竞品研究');
    expect(labels).toContain('更多专家');
  });

  it('shows loading state for expert directory', () => {
    const specs = buildComposerPlusMenuSpecs({
      ...base,
      experts: { ...base.experts!, loading: true, items: [] },
    });
    const labels = flattenMenuLabels(specs);
    expect(labels).toContain('加载中…');
  });
});
