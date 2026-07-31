import { describe, expect, it } from 'vitest';

import { shouldShowBetaBadge } from './rosterDisplay';
import type { WorkshopRosterExpertView } from '../types';

describe('rosterDisplay', () => {
  it('shows beta badge for ads expert preset', () => {
    const adsExpert: Pick<WorkshopRosterExpertView, 'beta' | 'preset_key'> = {
      preset_key: 'ecom_ads_strategy_analyzer_executor',
      beta: true,
    };
    expect(shouldShowBetaBadge(adsExpert)).toBe(true);
  });

  it('does not show beta badge for non-beta listing expert', () => {
    const listingExpert: Pick<WorkshopRosterExpertView, 'beta' | 'preset_key'> = {
      preset_key: 'ecom_listing_planner_executor',
      beta: false,
    };
    expect(shouldShowBetaBadge(listingExpert)).toBe(false);
  });
});
