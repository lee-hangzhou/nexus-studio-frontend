export type TimePreset = 'all' | 'today' | 'week' | 'month';

export function matchesTimePreset(createdAt: string, preset: TimePreset): boolean {
  if (preset === 'all') return true;
  const ts = new Date(createdAt).getTime();
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  if (preset === 'today') {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return ts >= start.getTime();
  }
  if (preset === 'week') return ts >= now - 7 * day;
  if (preset === 'month') return ts >= now - 30 * day;
  return true;
}
