import type { Dayjs } from 'dayjs';

export function isWithinDateRange(createdAt: string, range: [Dayjs, Dayjs] | null): boolean {
  if (!range) return true;
  const ts = new Date(createdAt).getTime();
  const start = range[0].startOf('day').valueOf();
  const end = range[1].endOf('day').valueOf();
  return ts >= start && ts <= end;
}
