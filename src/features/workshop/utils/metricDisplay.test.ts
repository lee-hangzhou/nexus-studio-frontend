import { describe, expect, it } from 'vitest';
import { formatMetricDisplay, formatShopConnectionStatus } from './metricDisplay';

describe('formatMetricDisplay', () => {
  it('does not show missing values as 0', () => {
    expect(formatMetricDisplay({ value: null })).toBe('数据暂不可用');
    expect(formatMetricDisplay({ value: undefined, unavailable_reason: 'zero_denominator' })).toBe(
      '数据暂不可用（分母为零）',
    );
  });

  it('renders unit_unverified without inventing fen', () => {
    expect(
      formatMetricDisplay({
        value: null,
        status: 'unit_unverified',
        raw_value: 'xxxxx',
      }),
    ).toBe('金额单位待确认（原始值 xxxxx）');
  });

  it('renders ok numeric values with unit', () => {
    expect(formatMetricDisplay({ value: 1200, unit: 'fen' })).toBe('1200 分');
  });
});

describe('formatShopConnectionStatus', () => {
  it('maps REAUTH_REQUIRED', () => {
    expect(formatShopConnectionStatus('REAUTH_REQUIRED')).toBe('淘宝授权已过期');
  });
});
