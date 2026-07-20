import { useStore } from '@xyflow/react';
import { useCallback } from 'react';
import { useCanvasTask } from '../context/CanvasTaskContext';
import type { CanvasNodeData } from '../schema/canvasSchema';

/** 节点是否处于生成中：服务端 running 或本地已发起尚未回写。 */
export function useNodeGenerating(nodeId: string): boolean {
  const { pendingNodeIds } = useCanvasTask();
  const status = useStore(
    useCallback(
      (s) => ((s.nodeLookup.get(nodeId)?.data ?? {}) as CanvasNodeData).status,
      [nodeId],
    ),
  );
  return status === 'running' || pendingNodeIds.has(nodeId);
}
