import { describe, expect, it } from 'vitest';
import {
  formatCreditsPerUsdFootnote,
  formatPackUsd,
  isRecommendedPack,
  RECOMMENDED_PACK_KEY,
} from './packDisplay';

describe('formatPackUsd', () => {
  it('formats whole-dollar pack prices without decimals', () => {
    expect(formatPackUsd(500)).toBe('$5');
    expect(formatPackUsd(1500)).toBe('$15');
    expect(formatPackUsd(5000)).toBe('$50');
    expect(formatPackUsd(10000)).toBe('$100');
  });

  it('rejects invalid cents', () => {
    expect(() => formatPackUsd(-1)).toThrow(/non-negative/);
    expect(() => formatPackUsd(Number.NaN)).toThrow(/finite/);
  });
});

describe('isRecommendedPack', () => {
  it('marks only the mid $15 pack', () => {
    expect(RECOMMENDED_PACK_KEY).toBe('usd_15');
    expect(isRecommendedPack('usd_15')).toBe(true);
    expect(isRecommendedPack('usd_5')).toBe(false);
    expect(isRecommendedPack('usd_50')).toBe(false);
    expect(isRecommendedPack('usd_100')).toBe(false);
  });
});

describe('formatCreditsPerUsdFootnote', () => {
  it('uses API credits_per_usd in the footnote', () => {
    expect(formatCreditsPerUsdFootnote(10)).toBe('1 美元 = 10 积分');
  });
});
