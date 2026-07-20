import { createContext, useContext } from 'react';
import type { NodeChangeInput } from '../types';

export interface CanvasActionsContextValue {
  onNodeChange: (input: NodeChangeInput) => void;
  snapshotBeforeChange: () => void;
  deleteEdge: (edgeId: string) => void;
}

export const CanvasActionsContext = createContext<CanvasActionsContextValue | null>(null);

export function useCanvasActions(): CanvasActionsContextValue {
  const ctx = useContext(CanvasActionsContext);
  if (!ctx) {
    throw new Error('useCanvasActions must be used within WorkflowCanvasFlow');
  }
  return ctx;
}
