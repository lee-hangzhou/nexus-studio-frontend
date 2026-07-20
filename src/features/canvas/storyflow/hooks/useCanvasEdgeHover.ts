import { useCallback, useRef, useState } from 'react';

/** 边 hover 状态：用于描边高亮与删除按钮展示 */
export function useCanvasEdgeHover() {
  const clearHoveredEdgeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hoveredEdgeId, setHoveredEdgeIdState] = useState<string | null>(null);

  const setHoveredEdgeId = useCallback((edgeId: string | null) => {
    if (clearHoveredEdgeTimerRef.current) {
      clearTimeout(clearHoveredEdgeTimerRef.current);
      clearHoveredEdgeTimerRef.current = null;
    }
    setHoveredEdgeIdState(edgeId);
  }, []);

  /** 离开连线后延迟清除 hover，便于移入删除按钮 */
  const scheduleClearHoveredEdge = useCallback(() => {
    if (clearHoveredEdgeTimerRef.current) {
      clearTimeout(clearHoveredEdgeTimerRef.current);
    }
    clearHoveredEdgeTimerRef.current = setTimeout(() => {
      setHoveredEdgeIdState(null);
      clearHoveredEdgeTimerRef.current = null;
    }, 150);
  }, []);

  return { hoveredEdgeId, setHoveredEdgeId, scheduleClearHoveredEdge };
}
