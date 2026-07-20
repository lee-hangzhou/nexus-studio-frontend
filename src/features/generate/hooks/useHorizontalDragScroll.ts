import { useCallback, useRef, useState, type PointerEvent } from 'react';

/** 横向轨道：鼠标/触控拖动滚动；拖动时抑制子项 click */
export function useHorizontalDragScroll() {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ active: false, startX: 0, scrollLeft: 0, moved: false });
  const [dragging, setDragging] = useState(false);

  const onPointerDown = useCallback((e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const el = trackRef.current;
    if (!el) return;
    dragRef.current = { active: true, startX: e.clientX, scrollLeft: el.scrollLeft, moved: false };
    setDragging(true);
    el.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) return;
    const el = trackRef.current;
    if (!el) return;
    const dx = e.clientX - dragRef.current.startX;
    if (Math.abs(dx) > 4) {
      dragRef.current.moved = true;
    }
    el.scrollLeft = dragRef.current.scrollLeft - dx;
  }, []);

  const endDrag = useCallback((e: PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) return;
    dragRef.current.active = false;
    setDragging(false);
    trackRef.current?.releasePointerCapture(e.pointerId);
  }, []);

  const shouldSuppressClick = useCallback(() => {
    if (dragRef.current.moved) {
      dragRef.current.moved = false;
      return true;
    }
    return false;
  }, []);

  const scrollByPx = useCallback((delta: number) => {
    trackRef.current?.scrollBy({ left: delta, behavior: 'smooth' });
  }, []);

  return {
    trackRef,
    dragging,
    onPointerDown,
    onPointerMove,
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
    shouldSuppressClick,
    scrollByPx,
  };
}
