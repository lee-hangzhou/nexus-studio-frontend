import { describe, expect, it } from 'vitest';

import { shouldPromptTeamUpgrade, shouldPromptTeamUpgradeOnSelect } from './expertSelection';

describe('expertSelection', () => {
  it('does not prompt upgrade for single expert', () => {
    expect(shouldPromptTeamUpgrade('ecom_listing_planner_executor')).toBe(false);
    expect(shouldPromptTeamUpgrade(null)).toBe(false);
  });

  it('never prompts team upgrade — expert teams are not a product path', () => {
    expect(shouldPromptTeamUpgrade('team_ecom_full')).toBe(false);
    expect(
      shouldPromptTeamUpgradeOnSelect({
        previousKey: null,
        nextKey: 'team_general',
      }),
    ).toBe(false);
  });
});
