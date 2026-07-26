import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { getCanvasSnapshot } from '../api/canvas';
import type { CanvasSnapshot } from '../api/canvasTypes';

type CanvasProjectContextValue = {
  projectId: number;
  episodeId: number;
  revision: number;
  revisionRef: React.MutableRefObject<number>;
  setRevision: (n: number) => void;
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
  const [revision, setRevisionState] = useState(0);
  const revisionRef = useRef(0);
  const [loading, setLoading] = useState(true);

  const setRevision = useCallback((n: number) => {
    revisionRef.current = n;
    setRevisionState(n);
  }, []);

  const refetchSnapshot = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getCanvasSnapshot(episodeId);
      setRevision(snap.revision);
      return snap;
    } finally {
      setLoading(false);
    }
  }, [episodeId, setRevision]);

  const value = useMemo(
    () => ({ projectId, episodeId, revision, revisionRef, setRevision, loading, refetchSnapshot }),
    [projectId, episodeId, revision, setRevision, loading, refetchSnapshot],
  );

  return <CanvasProjectContext.Provider value={value}>{children}</CanvasProjectContext.Provider>;
}

export function useCanvasProject(): CanvasProjectContextValue {
  const ctx = useContext(CanvasProjectContext);
  if (!ctx) throw new Error('useCanvasProject must be used within CanvasProjectProvider');
  return ctx;
}
