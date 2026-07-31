export type MetricDisplayStatus =
  | 'ok'
  | 'unavailable'
  | 'unsupported'
  | 'unit_unverified'
  | 'reauth_required';

export function formatMetricDisplay(input: {
  value: number | null | undefined;
  unit?: string | null;
  unavailable_reason?: string | null;
  status?: MetricDisplayStatus | null;
  raw_value?: string | null;
}): string {
  const status =
    input.status ??
    (input.unavailable_reason === 'unit_unverified_amount'
      ? 'unit_unverified'
      : input.unavailable_reason
        ? 'unavailable'
        : input.value == null
          ? 'unavailable'
          : 'ok');

  if (status === 'unit_unverified') {
    return input.raw_value != null && input.raw_value !== ''
      ? `金额单位待确认（原始值 ${input.raw_value}）`
      : '金额单位待确认';
  }
  if (status === 'reauth_required') return '淘宝授权已过期';
  if (status === 'unsupported') return '当前能力暂不支持';
  if (status === 'unavailable' || input.value == null) {
    return input.unavailable_reason
      ? `数据暂不可用（${reasonLabel(input.unavailable_reason)}）`
      : '数据暂不可用';
  }
  const unit = input.unit ? ` ${unitLabel(input.unit)}` : '';
  return `${input.value}${unit}`;
}

function reasonLabel(reason: string): string {
  if (reason === 'zero_denominator') return '分母为零';
  if (reason === 'missing_source') return '缺少数据源';
  return reason;
}

function unitLabel(unit: string): string {
  if (unit === 'fen') return '分';
  return unit;
}

export function formatShopConnectionStatus(status: string | null | undefined): string {
  if (!status) return '未连接';
  if (status === 'REAUTH_REQUIRED' || status === 'reauth_required') return '淘宝授权已过期';
  if (status === 'unsupported') return '当前能力暂不支持';
  if (status === 'disconnected') return '未连接';
  if (status === 'connected') return '已连接';
  if (status === 'authorizing') return '授权中';
  return '状态未知';
}
