import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

const PANEL_WIDTH_STORAGE_KEY = 'nexus-canvas-agent-panel-width';
const DEFAULT_PANEL_WIDTH = 360;
const MIN_PANEL_WIDTH = 320;

function getMaxPanelWidth(): number {
  if (typeof window === 'undefined') return DEFAULT_PANEL_WIDTH;
  return Math.floor(window.innerWidth * 0.8);
}

function clampPanelWidth(width: number): number {
  return Math.min(getMaxPanelWidth(), Math.max(MIN_PANEL_WIDTH, width));
}

function readStoredWidth(): number {
  if (typeof window === 'undefined') return DEFAULT_PANEL_WIDTH;
  const raw = localStorage.getItem(PANEL_WIDTH_STORAGE_KEY);
  const parsed = raw != null ? Number(raw) : NaN;
  if (!Number.isFinite(parsed)) return clampPanelWidth(DEFAULT_PANEL_WIDTH);
  return clampPanelWidth(parsed);
}

function writeStoredWidth(width: number): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PANEL_WIDTH_STORAGE_KEY, String(width));
}

/** Agent 侧栏宽度：左侧拖拽，最小 320，最大 80vw */
export function useAgentPanelWidth() {
  const [width, setWidth] = useState(readStoredWidth);
  const widthRef = useRef(width);
  const draggingRef = useRef(false);

  useEffect(() => {
    widthRef.current = width;
  }, [width]);

  useEffect(() => {
    const handleResize = () => {
      setWidth((prev) => {
        const next = clampPanelWidth(prev);
        if (next !== prev) writeStoredWidth(next);
        return next;
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const startResize = useCallback((startClientX: number) => {
    draggingRef.current = true;
    const startWidth = widthRef.current;

    const handlePointerMove = (event: PointerEvent) => {
      if (!draggingRef.current) return;
      const nextWidth = clampPanelWidth(startWidth - (event.clientX - startClientX));
      setWidth(nextWidth);
    };

    const handlePointerUp = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      writeStoredWidth(widthRef.current);
      document.body.classList.remove('canvas-agent-panel--resizing');
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };

    document.body.classList.add('canvas-agent-panel--resizing');
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  }, []);

  const onResizePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      startResize(event.clientX);
    },
    [startResize],
  );

  return { width, onResizePointerDown };
}
