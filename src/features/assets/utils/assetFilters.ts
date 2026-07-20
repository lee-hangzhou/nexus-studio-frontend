import type { Dayjs } from 'dayjs';
import type { AssetBase } from '../../../domains/asset/types';
import type { AssetKindFilter, AssetSourceFilter } from '../constants';
import { isWithinDateRange } from './assetDateRange';

export function filterAssets(
  items: AssetBase[],
  options: {
    query: string;
    kind: AssetKindFilter;
    source: AssetSourceFilter;
    dateRange: [Dayjs, Dayjs] | null;
    favoritesOnly?: boolean;
  }
): AssetBase[] {
  const q = options.query.trim().toLowerCase();

  return items
    .filter((item) => {
      if (item.kind === 'text') return false;
      if (options.favoritesOnly && !item.favorite) return false;
      if (options.kind !== 'all' && item.kind !== options.kind) return false;
      if (options.source !== 'all' && item.source !== options.source) return false;
      if (!isWithinDateRange(item.createdAt, options.dateRange)) return false;
      if (q && !item.title.toLowerCase().includes(q)) return false;
      return true;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
