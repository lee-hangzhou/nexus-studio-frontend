import { createContext, useContext, type ReactNode } from 'react';
import type { CanvasPatchOp } from '../api/canvasTypes';

export type CanvasActionsValue = {
  commitOps: (ops: CanvasPatchOp[]) => Promise<boolean>;
  onNodeGenerate: (nodeId: string) => Promise<void>;
  updateNodeData: (nodeId: string, patch: Record<string, unknown>) => void;
  deleteNode: (nodeId: string) => void;
};

const CanvasActionsContext = createContext<CanvasActionsValue | null>(null);

export function CanvasActionsProvider({
  value,
  children,
}: {
  value: CanvasActionsValue;
  children: ReactNode;
}) {
  return <CanvasActionsContext.Provider value={value}>{children}</CanvasActionsContext.Provider>;
}

export function useCanvasActions(): CanvasActionsValue {
  const ctx = useContext(CanvasActionsContext);
  if (!ctx) throw new Error('useCanvasActions must be used within CanvasActionsProvider');
  return ctx;
}

export function useCanvasNodeActions(): CanvasActionsValue {
  return useCanvasActions();
}
