import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { getCanvasSnapshot } from '../api/canvas';
import type { CanvasSnapshot } from '../api/canvasTypes';

type CanvasProjectContextValue = {
  projectId: number;
  episodeId: number;
  loading: boolean;
  refetchSnapshot: () => Promise<CanvasSnapshot | null>;
};

const CanvasProjectContext = createContext<CanvasProjectContextValue | null>(null);

export function CanvasProjectProvider({
  projectId,
  episodeId,
  children,
}: {
  projectId: number;
  episodeId: number;
  children: ReactNode;
}) {
  const [loading, setLoading] = useState(true);

  const refetchSnapshot = useCallback(async () => {
    setLoading(true);
    try {
      return await getCanvasSnapshot(episodeId);
    } finally {
      setLoading(false);
    }
  }, [episodeId]);

  const value = useMemo(
    () => ({ projectId, episodeId, loading, refetchSnapshot }),
    [projectId, episodeId, loading, refetchSnapshot],
  );

  return <CanvasProjectContext.Provider value={value}>{children}</CanvasProjectContext.Provider>;
}

export function useCanvasProject(): CanvasProjectContextValue {
  const ctx = useContext(CanvasProjectContext);
  if (!ctx) throw new Error('useCanvasProject must be used within CanvasProjectProvider');
  return ctx;
}
