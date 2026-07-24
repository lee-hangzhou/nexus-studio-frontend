import { useStore } from '@xyflow/react';
import { useCallback } from 'react';
import { useCanvasActions } from '../context/CanvasActionsContext';

/** 移除顶栏已连接引用：删除 source→当前节点 的入边 */
export function useDisconnectConnectedRef(nodeId: string) {
  const { deleteEdge } = useCanvasActions();
  const edges = useStore(useCallback((s) => s.edges, []));

  return useCallback(
    (sourceNodeId: string) => {
      for (const edge of edges) {
        if (edge.source === sourceNodeId && edge.target === nodeId) {
          deleteEdge(edge.id);
        }
      }
    },
    [deleteEdge, edges, nodeId],
  );
}
