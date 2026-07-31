import { describe, expect, it } from 'vitest';

import {
  buildInviteCandidates,
  buildRoomRecipientExperts,
  resolveRoomTurnTargetExpertId,
} from './turnRouting';
import type { ExpertDirectoryEntry, WorkshopRoomMemberView } from './expertDirectory';

const directory: ExpertDirectoryEntry[] = [
  {
    key: 'ecom_market_competitor_advisor',
    name: '市场与竞品研究',
    role_phrase: '',
    avatar_url: '/a.png',
    tags: [],
    applicable_tasks: [],
    scope: 'platform',
    kind: 'expert',
  },
  {
    key: 'ecom_product_copy_advisor',
    name: '商品策划与文案',
    role_phrase: '',
    avatar_url: '/b.png',
    tags: [],
    applicable_tasks: [],
    scope: 'platform',
    kind: 'expert',
  },
];

const room: WorkshopRoomMemberView[] = [
  {
    expert_id: 're_market',
    name: '市场与竞品研究',
    avatar_url: '/a.png',
    preset_key: 'ecom_market_competitor_advisor',
    status: 'idle',
  },
];

const roster = [
  { id: 're_market', name: '市场与竞品研究', preset_key: 'ecom_market_competitor_advisor' },
  { id: 're_copy', name: '商品策划与文案', preset_key: 'ecom_product_copy_advisor' },
];

describe('turnRouting', () => {
  it('发给列表只含房间成员，不含未进房专家', () => {
    const recipients = buildRoomRecipientExperts({ roomMembers: room, roster });
    expect(recipients.map((item) => item.key)).toEqual(['ecom_market_competitor_advisor']);
    expect(recipients.map((item) => item.name)).not.toContain('商品策划与文案');
  });

  it('可邀请列表 = 目录减去已在房间，目录有未在场专家时不为空', () => {
    const candidates = buildInviteCandidates({ directory, roomMembers: room, roster });
    expect(candidates.map((item) => item.key)).toEqual(['ecom_product_copy_advisor']);
    expect(candidates).not.toHaveLength(0);
  });

  it('未进房专家不能解析为 turn_target', () => {
    expect(
      resolveRoomTurnTargetExpertId({
        selectedKey: 'ecom_product_copy_advisor',
        roomMembers: room,
        roster,
      }),
    ).toBeNull();
    expect(
      resolveRoomTurnTargetExpertId({
        selectedKey: 'ecom_market_competitor_advisor',
        roomMembers: room,
        roster,
      }),
    ).toBe('re_market');
  });
});
