import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));

function read(rel: string): string {
  return readFileSync(path.join(here, rel), 'utf8');
}

const chatPage = read('../chat/pages/ChatPage.tsx');
const chatApi = read('../../api/chat.ts');
const workshopSidePanel = read('./components/WorkshopSidePanel.tsx');
const expertDirectory = read('./utils/expertDirectory.ts');
const workshopApi = read('../../api/workshop.ts');
const workshopEntry = read('./components/WorkshopEntry.tsx');
const resourceCenter = read('./components/WorkshopResourceCenter.tsx');
const sessionListItem = read('../chat/components/SessionListItem.tsx');

const workshopSources = [
  chatPage,
  chatApi,
  workshopSidePanel,
  expertDirectory,
  workshopApi,
  workshopEntry,
  resourceCenter,
];

const forbiddenUi = [
  '新建长期项目',
  '淘宝 / 天猫经营',
  '淘宝/天猫经营',
  '通用协作',
  '工作类型',
  '全部场景',
  '精选场景',
  '专家包',
  '专家团队',
  '专家团',
  '项目进展',
  '收起项目进展',
  '需要持续跟进',
  'listExpertTeams',
  'upgradeWorkshopFromTeam',
  'shouldPromptTeamUpgrade',
  'shouldProposeWorkshopUpgrade',
  'WorkshopUpgradeBanner',
  'CreateWorkshopProjectButton',
  'packDisplayName',
  'onJoinTeam',
  "'资料'",
  '"资料"',
  '普通对话',
];

describe('product model cleanup', () => {
  it('removes pack/scene/team entry UI from ChatPage, Entry, and ResourceCenter', () => {
    for (const phrase of forbiddenUi) {
      expect(chatPage, `ChatPage must not contain ${phrase}`).not.toContain(phrase);
      expect(workshopEntry, `WorkshopEntry must not contain ${phrase}`).not.toContain(
        phrase,
      );
      expect(
        resourceCenter,
        `WorkshopResourceCenter must not contain ${phrase}`,
      ).not.toContain(phrase);
    }
  });

  it('uses 项目 labels instead of pack names in chat chrome', () => {
    expect(chatPage).toContain('studio-chat__mode-chip');
    expect(chatPage).toMatch(/workshopProject\s*\?\s*\(/);
    expect(chatPage).toContain("projectLabel={project ? '项目' : undefined}");
    expect(chatPage).not.toContain('普通对话');
    expect(sessionListItem).not.toContain('长期项目');
  });

  it('keeps empty start as title + soft hint + composer', () => {
    expect(chatPage).toContain('一起开始探索吧');
    expect(chatPage).toContain('studio-chat__start-hint');
    expect(chatPage).toContain('输入 @ 指定专家');
    expect(chatPage).not.toContain('你想完成什么？');
    expect(chatPage).not.toContain('一起干活');
    expect(chatPage).not.toContain('<p>直接描述目标');
  });

  it('resource center is search + platform/mine scope without scene or teams tab', () => {
    expect(resourceCenter).toContain('平台');
    expect(resourceCenter).toContain('我的');
    expect(resourceCenter).not.toContain("label: '电商'");
    expect(resourceCenter).not.toContain("label: '全部'");
    expect(resourceCenter).not.toContain("key: 'teams'");
    expect(resourceCenter).not.toContain('<Empty');
  });

  it('routes workshop sends through turn_target when expert selected', () => {
    expect(chatApi).toContain('turn_target?:');
    expect(chatPage).toContain('turn_target: turnTarget');
    expect(chatPage).toContain('resolveRoomTurnTargetExpertId');
    expect(chatPage).toContain('expert_id: expertId');
  });

  it('does not expose pack/scene/team product surface in workshop FE sources', () => {
    const forbiddenWorkshop = [
      'ecommerce_v1',
      '通用协作',
      '专家团',
      "scene: 'ecommerce'",
      'LOCAL_EXPERT_TEAMS',
      'listExpertTeams',
      'upgradeWorkshopFromTeam',
      'silentBootstrapPack',
    ];
    for (const phrase of forbiddenWorkshop) {
      for (const source of workshopSources) {
        expect(source, `workshop FE source must not contain ${phrase}`).not.toContain(phrase);
      }
    }
  });

  it('does not surface expert skill_refs English paths in project resources', () => {
    expect(workshopSidePanel).not.toContain('enabledSkillPaths');
    expect(workshopSidePanel).not.toContain('skill_refs');
    expect(workshopSidePanel).not.toContain('ecommerce-ppc-strategy-planner');
  });

  it('ChatPage uses one unified side panel entry', () => {
    expect(chatPage).toContain('UnifiedChatSidePanel');
    expect(chatPage).toContain('sidePanelOpen');
    expect(chatPage).toMatch(/>\s*详情\s*</);
    expect(chatPage).not.toContain('WorkshopResourceCenter');
    expect(chatPage).not.toContain('setResourcesOpen');
    expect(chatPage).not.toContain('setWorkshopPanelOpen');
  });
});
