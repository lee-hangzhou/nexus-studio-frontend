import { createContext, useContext } from 'react';

export type CanvasEdgeHoverContextValue = {
  hoveredEdgeId: string | null;
  setHoveredEdgeId: (id: string | null) => void;
  scheduleClearHoveredEdge: () => void;
};

export const CanvasEdgeHoverContext = createContext<CanvasEdgeHoverContextValue | null>(null);

export function useCanvasEdgeHoverContext(): CanvasEdgeHoverContextValue {
  const ctx = useContext(CanvasEdgeHoverContext);
  if (!ctx) {
    throw new Error('useCanvasEdgeHoverContext missing provider');
  }
  return ctx;
}
