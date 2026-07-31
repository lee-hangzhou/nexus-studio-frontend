import type { WorkshopRosterExpertView } from '../types';

const ADS_PRESET_KEY = 'ecom_ads_strategy_analyzer_executor';

export function shouldShowBetaBadge(expert: Pick<WorkshopRosterExpertView, 'beta' | 'preset_key'>): boolean {
  if (expert.beta === true) return true;
  return expert.preset_key === ADS_PRESET_KEY;
}
