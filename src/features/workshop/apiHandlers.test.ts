import { describe, expect, it } from 'vitest';

import * as workshopApi from '../../api/workshop';

describe('workshop expert API handlers', () => {
  it('exports invite/remove/assign/unassign and chat expert selection handlers', () => {
    expect(typeof workshopApi.listExpertDirectory).toBe('function');
    expect(typeof workshopApi.listWorkshopRoomMembers).toBe('function');
    expect(typeof workshopApi.inviteWorkshopExpert).toBe('function');
    expect(typeof workshopApi.removeWorkshopExpert).toBe('function');
    expect(typeof workshopApi.unassignWorkshopTaskExpert).toBe('function');
    expect(typeof workshopApi.setChatSelectedExpert).toBe('function');
    expect(typeof workshopApi.clearChatSelectedExpert).toBe('function');
    expect(typeof workshopApi.getWorkshopDataSources).toBe('function');
    expect(typeof workshopApi.beginWorkshopShopAuth).toBe('function');
  });
});
