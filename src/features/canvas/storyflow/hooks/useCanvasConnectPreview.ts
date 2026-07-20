import type { Edge, Node, OnEdgesChange, OnNodesChange } from '@xyflow/react';
import { useCallback, useMemo } from 'react';
import type { ConnectDropMenuState, PaneAddNodeMenuState } from '../types';
import {
  buildConnectPreviewElements,
  filterPreviewEdgeChanges,
  filterPreviewNodeChanges,
} from '../utils/connectPreview';

/** 拖线悬停合法目标节点时加在 React Flow 节点 wrapper 上的 class */
export const CONNECT_TARGET_NODE_CLASS = 'workflow-canvas-connect-target';

type UseCanvasConnectPreviewParams = {
  connectMenu: ConnectDropMenuState | null;
  addNodeMenu: PaneAddNodeMenuState | null;
  connectTargetNodeId: string | null;
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
};

/**
 * 连线落点菜单打开时：合并预览节点/边到 React Flow 展示层，
 * 并过滤预览相关变更，避免污染画布状态或触发保存 JSON。
 */
function withConnectTargetClass(node: Node, connectTargetNodeId: string | null): Node {
  if (!connectTargetNodeId || node.id !== connectTargetNodeId) {
    return node;
  }
  const className = [node.className, CONNECT_TARGET_NODE_CLASS].filter(Boolean).join(' ');
  return { ...node, className };
}

export function useCanvasConnectPreview({
  connectMenu,
  addNodeMenu,
  connectTargetNodeId,
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
}: UseCanvasConnectPreviewParams) {
  const connectPreview = useMemo(
    () => buildConnectPreviewElements(connectMenu, addNodeMenu),
    [connectMenu, addNodeMenu],
  );

  const handleNodesChange: OnNodesChange = useCallback(
    changes => {
      const filtered = filterPreviewNodeChanges(changes);
      if (filtered.length > 0) {
        onNodesChange(filtered);
      }
    },
    [onNodesChange],
  );

  const handleEdgesChange: OnEdgesChange = useCallback(
    changes => {
      const filtered = filterPreviewEdgeChanges(changes);
      if (filtered.length > 0) {
        onEdgesChange(filtered);
      }
    },
    [onEdgesChange],
  );

  const flowNodes = useMemo(() => {
    const merged = connectPreview ? [...nodes, connectPreview.node] : nodes;
    if (!connectTargetNodeId) {
      return merged;
    }
    return merged.map(node => withConnectTargetClass(node, connectTargetNodeId));
  }, [nodes, connectPreview, connectTargetNodeId]);

  const flowEdges = useMemo(
    () => (connectPreview ? [...edges, connectPreview.edge] : edges),
    [edges, connectPreview],
  );

  return {
    flowNodes,
    flowEdges,
    handleNodesChange,
    handleEdgesChange,
  };
}
