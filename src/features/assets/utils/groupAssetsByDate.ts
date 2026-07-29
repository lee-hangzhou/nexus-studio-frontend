import dayjs from 'dayjs';
import type { AssetBase } from '../../../domains/asset/types';

export interface AssetDateSection {
  key: string;
  dateLabel: string;
  items: AssetBase[];
}

function formatDateLabel(createdAt: string): string {
  const time = dayjs(createdAt);
  if (!time.isValid()) return '未知日期';
  return time.format('M月D日');
}

/** Group assets by calendar day of createdAt, preserving list order. */
export function groupAssetsByDate(items: AssetBase[]): AssetDateSection[] {
  const sections: AssetDateSection[] = [];
  const indexByKey = new Map<string, number>();

  for (const item of items) {
    const dateLabel = formatDateLabel(item.createdAt);
    const key = dayjs(item.createdAt).isValid()
      ? dayjs(item.createdAt).format('YYYY-MM-DD')
      : 'unknown';
    const existingIndex = indexByKey.get(key);
    if (existingIndex !== undefined) {
      sections[existingIndex].items.push(item);
      continue;
    }
    indexByKey.set(key, sections.length);
    sections.push({ key, dateLabel, items: [item] });
  }

  return sections;
}
