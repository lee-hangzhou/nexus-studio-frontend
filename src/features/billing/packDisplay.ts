import type { CreditPackKey } from '../../api/billing';

/** Mid-tier one-time pack highlighted on the purchase page. */
export const RECOMMENDED_PACK_KEY: CreditPackKey = 'usd_15';

export function formatPackUsd(cents: number): string {
  if (!Number.isFinite(cents) || cents < 0) {
    throw new Error('price_usd_cents must be a non-negative finite number');
  }
  return `$${(cents / 100).toFixed(0)}`;
}

export function isRecommendedPack(packKey: CreditPackKey): boolean {
  return packKey === RECOMMENDED_PACK_KEY;
}

export function formatCreditsPerUsdFootnote(creditsPerUsd: number): string {
  if (!Number.isInteger(creditsPerUsd) || creditsPerUsd <= 0) {
    throw new Error('credits_per_usd must be a positive integer');
  }
  return `1 美元 = ${creditsPerUsd} 积分`;
}
