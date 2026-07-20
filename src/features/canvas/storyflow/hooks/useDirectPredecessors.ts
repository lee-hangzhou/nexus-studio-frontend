import { useMemo } from 'react';
import {
  getIncomers,
  useNodeConnections,
  useNodesData,
  useStore,
  type Edge,
  type Node,
} from '@xyflow/react';
import { CONNECT_PREVIEW_NODE_ID } from '../constants';
import type { CanvasNodeData } from '../../schema/canvasSchema';
import { isConnectPreviewNodeId } from '../utils/connectPreview';
import { getNodeWorkflowType } from '../utils/nodeConnectionRules';
import type { WorkflowNodeType } from '../types';

const EMPTY_NODES: Node[] = [];
const EMPTY_EDGES: Edge[] = [];

export type DirectPredecessor = {
  id: string;
  type: WorkflowNodeType;
  data: CanvasNodeData;
};

function getDirectPredecessorNodes(node: Node, nodes: Node[], edges: Edge[]): Node[] {
  return getIncomers(node, nodes, edges).filter((n) => !isConnectPreviewNodeId(n.id) && n.id !== CONNECT_PREVIEW_NODE_ID);
}

function toDirectPredecessor(node: Node): DirectPredecessor | null {
  const type = getNodeWorkflowType(node);
  if (!type || !node.data) {
    return null;
  }
  return { id: node.id, type, data: node.data as CanvasNodeData };
}

/** 选中节点时获取直接前置节点 data；未选中返回空数组且不订阅前置 data。 */
export function useDirectPredecessors(nodeId: string, selected: boolean): DirectPredecessor[] {
  const connections = useNodeConnections({ id: nodeId, handleType: 'target' });

  const sourceIds = useMemo(() => {
    if (!selected) {
      return [];
    }
    return [...new Set(connections.map((c) => c.source))];
  }, [selected, connections]);

  const nodesData = useNodesData(sourceIds);
  const nodes = useStore((s) => (selected ? s.nodes : EMPTY_NODES));
  const edges = useStore((s) => (selected ? s.edges : EMPTY_EDGES));

  return useMemo(() => {
    if (!selected || sourceIds.length === 0) {
      return [];
    }
    const self = nodes.find((n) => n.id === nodeId);
    if (!self) {
      return [];
    }

    const incomers = getDirectPredecessorNodes(self, nodes, edges);
    const dataList = Array.isArray(nodesData) ? nodesData : nodesData ? [nodesData] : [];
    const byId = new Map(dataList.filter(Boolean).map((n) => [n.id, n]));

    return incomers
      .map((n) => {
        const patch = byId.get(n.id);
        if (!patch) {
          return toDirectPredecessor(n);
        }
        return toDirectPredecessor({
          ...n,
          type: patch.type ?? n.type,
          data: patch.data,
        });
      })
      .filter((p): p is DirectPredecessor => p != null);
  }, [selected, nodeId, sourceIds, nodes, edges, nodesData]);
}
