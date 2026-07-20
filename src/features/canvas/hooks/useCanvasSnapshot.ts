import { useEffect } from 'react';
import { toFlowEdges, toFlowNodes, type CanvasFlowEdge, type CanvasFlowNode } from '../schema/canvasSchema';
import { useCanvasProject } from '../context/CanvasProjectContext';

export function useCanvasSnapshot(
  setNodes: (nodes: CanvasFlowNode[]) => void,
  setEdges: (edges: CanvasFlowEdge[]) => void,
) {
  const { refetchSnapshot } = useCanvasProject();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const snap = await refetchSnapshot();
      if (cancelled || !snap) return;
      setNodes(toFlowNodes(snap.nodes));
      setEdges(toFlowEdges(snap.edges));
    })();
    return () => {
      cancelled = true;
    };
  }, [refetchSnapshot, setNodes, setEdges]);
}
