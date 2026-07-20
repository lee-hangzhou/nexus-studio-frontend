import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

type CanvasTaskContextValue = {
  pendingNodeIds: ReadonlySet<string>;
  setNodePending: (nodeId: string, pending: boolean) => void;
};

const CanvasTaskContext = createContext<CanvasTaskContextValue | null>(null);

export function CanvasTaskProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Set<string>>(() => new Set());

  const setNodePending = useCallback((nodeId: string, on: boolean) => {
    setPending((prev) => {
      const next = new Set(prev);
      if (on) next.add(nodeId);
      else next.delete(nodeId);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ pendingNodeIds: pending, setNodePending }),
    [pending, setNodePending],
  );

  return <CanvasTaskContext.Provider value={value}>{children}</CanvasTaskContext.Provider>;
}

export function useCanvasTask(): CanvasTaskContextValue {
  const ctx = useContext(CanvasTaskContext);
  if (!ctx) throw new Error('useCanvasTask must be used within CanvasTaskProvider');
  return ctx;
}
