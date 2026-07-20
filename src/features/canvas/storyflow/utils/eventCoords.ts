/** 从 Mouse/Touch 事件取屏幕坐标 */
export function getClientCoords(event: MouseEvent | TouchEvent): { x: number; y: number } {
  if ('changedTouches' in event) {
    const t = event.changedTouches[0];
    return { x: t.clientX, y: t.clientY };
  }
  return { x: event.clientX, y: event.clientY };
}
