import type { PublishDiff } from '../types';

export function canConfirmPublishDiff(
  diff: Pick<PublishDiff, 'payload_hash'>,
  enteredHash: string,
): boolean {
  const normalized = enteredHash.trim();
  if (!normalized) return false;
  return normalized === diff.payload_hash;
}

export function summarizePublishChanges(
  diff: Pick<PublishDiff, 'changes'>,
): Array<{ path: string; before: string; after: string }> {
  return (diff.changes ?? []).map((change) => ({
    path: changePathLabel(change.path),
    before: formatChangeValue(change.before),
    after: formatChangeValue(change.after),
  }));
}

const CHANGE_PATH_LABELS: Record<string, string> = {
  title: '商品标题',
  price: '价格',
  quantity: '库存',
  stock: '库存',
  description: '商品描述',
  desc: '商品描述',
  images: '商品图片',
  sku: '规格',
  skus: '规格',
  category: '类目',
  status: '商品状态',
  freight: '运费设置',
};

function changePathLabel(path: string): string {
  const parts = path.split(/[./[\]]/).filter(Boolean);
  const key = (parts[parts.length - 1] ?? path).toLowerCase();
  return CHANGE_PATH_LABELS[key] ?? '商品信息';
}

function formatChangeValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '无';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return value.toLocaleString('zh-CN');
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (Array.isArray(value)) return value.map(formatChangeValue).join('、');
  if (typeof value === 'object') {
    return Object.entries(value)
      .map(([key, item]) => `${CHANGE_PATH_LABELS[key.toLowerCase()] ?? key}：${formatChangeValue(item)}`)
      .join('；');
  }
  return String(value);
}
