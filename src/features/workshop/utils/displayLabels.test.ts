import { describe, expect, it } from 'vitest';

import { taskStatusLabel, deliverableTypeLabel } from './displayLabels';

describe('displayLabels', () => {
  it('maps task statuses to consumer Chinese labels', () => {
    expect(taskStatusLabel('awaiting_go')).toBe('等你确认');
    expect(taskStatusLabel('done')).toBe('已完成');
  });

  it('maps deliverable type keys to Chinese labels', () => {
    expect(deliverableTypeLabel('MarketCompetitorBrief')).toBe('竞品研究简报');
    expect(deliverableTypeLabel('UnknownThing')).toBe('交付物');
  });
});
