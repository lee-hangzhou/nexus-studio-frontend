import type { Edge, EdgeChange, Node, NodeChange } from '@xyflow/react';
import {
  CONNECT_PREVIEW_EDGE_ID,
  CONNECT_PREVIEW_NODE_ID,
  CONNECT_PREVIEW_NODE_TYPE,
  WORKFLOW_EDGE_CLASSNAME,
  WORKFLOW_EDGE_TYPE,
} from '../constants';
import type { ConnectDropMenuState, PaneAddNodeMenuState } from '../types';

export function isConnectPreviewNodeId(id: string | undefined): boolean {
  return id === CONNECT_PREVIEW_NODE_ID;
}

export function isConnectPreviewEdgeId(id: string | undefined): boolean {
  return id === CONNECT_PREVIEW_EDGE_ID;
}

/** 丢弃 React Flow 对预览节点/边的变更，避免污染画布状态并触发保存 */
function nodeChangeId(change: NodeChange): string | undefined {
  return 'id' in change ? change.id : undefined;
}

function edgeChangeId(change: EdgeChange): string | undefined {
  return 'id' in change ? change.id : undefined;
}

export function filterPreviewNodeChanges(changes: NodeChange[]): NodeChange[] {
  return changes.filter(change => !isConnectPreviewNodeId(nodeChangeId(change)));
}

export function filterPreviewEdgeChanges(changes: EdgeChange[]): EdgeChange[] {
  return changes.filter(change => !isConnectPreviewEdgeId(edgeChangeId(change)));
}

/** 预览连线描边（与拖线视觉接近，略淡） */
export const CONNECT_PREVIEW_EDGE_STYLE = {
  stroke: '#ffffff60',
  strokeWidth: 2,
  strokeOpacity: 0.85,
};

export type ConnectPreviewElements = {
  node: Node;
  edge: Edge;
};

/** 连线落点菜单打开时：用占位节点固定预览连线终点 */
export function buildConnectPreviewElements(
  connectMenu: ConnectDropMenuState | null,
  addNodeMenu: PaneAddNodeMenuState | null,
): ConnectPreviewElements | null {
  if (connectMenu && connectMenu.flowX != null && connectMenu.flowY != null) {
    return buildPreviewForAnchor(
      connectMenu.anchorNodeId,
      connectMenu.handleSide,
      connectMenu.flowX,
      connectMenu.flowY,
    );
  }

  if (
    addNodeMenu?.anchorNodeId &&
    addNodeMenu.flowX != null &&
    addNodeMenu.flowY != null
  ) {
    return buildPreviewForAnchor(
      addNodeMenu.anchorNodeId,
      addNodeMenu.handleSide ?? 'left',
      addNodeMenu.flowX,
      addNodeMenu.flowY,
    );
  }

  return null;
}

function buildPreviewForAnchor(
  anchorNodeId: string,
  handleSide: 'left' | 'right',
  flowX: number,
  flowY: number,
): ConnectPreviewElements {
  const previewNode: Node = {
    id: CONNECT_PREVIEW_NODE_ID,
    type: CONNECT_PREVIEW_NODE_TYPE,
    position: { x: flowX, y: flowY },
    width: 1,
    height: 1,
    draggable: false,
    selectable: false,
    focusable: false,
    connectable: false,
    data: {},
    className: 'workflow-connect-preview-node nodrag nopan',
    style: { opacity: 0, pointerEvents: 'none' },
  };

  const edge: Edge =
    handleSide === 'left'
      ? {
          id: CONNECT_PREVIEW_EDGE_ID,
          source: CONNECT_PREVIEW_NODE_ID,
          target: anchorNodeId,
          sourceHandle: 'right',
          targetHandle: 'left',
          type: WORKFLOW_EDGE_TYPE,
          className: WORKFLOW_EDGE_CLASSNAME,
          selectable: false,
          focusable: false,
          style: CONNECT_PREVIEW_EDGE_STYLE,
        }
      : {
          id: CONNECT_PREVIEW_EDGE_ID,
          source: anchorNodeId,
          target: CONNECT_PREVIEW_NODE_ID,
          sourceHandle: 'right',
          targetHandle: 'left',
          type: WORKFLOW_EDGE_TYPE,
          className: WORKFLOW_EDGE_CLASSNAME,
          selectable: false,
          focusable: false,
          style: CONNECT_PREVIEW_EDGE_STYLE,
        };

  return { node: previewNode, edge };
}
