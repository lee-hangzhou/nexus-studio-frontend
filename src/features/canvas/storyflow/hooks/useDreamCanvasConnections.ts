import type {
  Connection,
  Edge,
  Node,
  OnConnect,
  OnConnectEnd,
  OnConnectStart,
  NodeMouseHandler,
} from '@xyflow/react';
import { useReactFlow } from '@xyflow/react';
import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { CanvasPatchOp } from '../../api/canvasTypes';
import {
  buildNodePairConnection,
  buildDataDependencyPorts,
  canConnectNodePair,
  getNodeWorkflowType,
  getSpawnTypesForHandle,
  isValidNodeConnection,
} from '../utils/nodeConnectionRules';
import type { ConnectDropMenuState, PaneAddNodeMenuState } from '../types';
import { getClientCoords } from '../utils/eventCoords';
function isConnectPreviewNodeId(id: string) {
  return id.startsWith('__workflow_connect');
}

type Params = {
  nodes: Node[];
  nodesRef: React.MutableRefObject<Node[]>;
  edgesRef: React.MutableRefObject<Edge[]>;
  commitOps: (ops: CanvasPatchOp[]) => Promise<import('../../api/canvasTypes').CanvasPatchResult | null>;
  setConnectMenu: Dispatch<SetStateAction<ConnectDropMenuState | null>>;
  setAddNodeMenu: Dispatch<SetStateAction<PaneAddNodeMenuState | null>>;
  markSkipNextPaneClick: () => void;
};

export function useDreamCanvasConnections({
  nodes,
  nodesRef,
  edgesRef,
  commitOps,
  setConnectMenu,
  setAddNodeMenu,
  markSkipNextPaneClick,
}: Params) {
  const { screenToFlowPosition } = useReactFlow();
  const connectDragAnchorRef = useRef<string | null>(null);
  const connectDragHandleRef = useRef<'left' | 'right' | null>(null);
  const connectTargetNodeIdRef = useRef<string | null>(null);
  const [connectTargetNodeId, setConnectTargetNodeId] = useState<string | null>(null);

  const clearConnectDrag = useCallback(() => {
    connectDragAnchorRef.current = null;
    connectDragHandleRef.current = null;
    connectTargetNodeIdRef.current = null;
    setConnectTargetNodeId(null);
  }, []);

  const commitConnection = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return false;
      if (!isValidNodeConnection(connection.source, connection.target, nodesRef.current, edgesRef.current)) {
        return false;
      }
      const sourceType = getNodeWorkflowType(nodesRef.current.find((n) => n.id === connection.source));
      const targetType = getNodeWorkflowType(nodesRef.current.find((n) => n.id === connection.target));
      if (!sourceType || !targetType) return false;
      setConnectMenu(null);
      setAddNodeMenu(null);
      void commitOps([
        {
          op: 'connect',
          edge: {
            source: connection.source,
            target: connection.target,
            ...buildDataDependencyPorts(sourceType, targetType),
          },
        },
      ]);
      return true;
    },
    [commitOps, setConnectMenu, setAddNodeMenu, nodesRef, edgesRef],
  );

  const onConnectStart: OnConnectStart = useCallback((_, { nodeId, handleId }) => {
    connectTargetNodeIdRef.current = null;
    setConnectTargetNodeId(null);
    connectDragAnchorRef.current = nodeId ?? null;
    connectDragHandleRef.current = handleId === 'left' ? 'left' : handleId === 'right' ? 'right' : null;
  }, []);

  const onConnect: OnConnect = useCallback(
    (connection) => {
      commitConnection(connection);
    },
    [commitConnection],
  );

  const onNodeMouseEnter: NodeMouseHandler = useCallback(
    (_, node) => {
      const anchorNodeId = connectDragAnchorRef.current;
      if (!anchorNodeId || anchorNodeId === node.id || isConnectPreviewNodeId(node.id)) return;
      const handleSide = connectDragHandleRef.current ?? 'right';
      if (!canConnectNodePair(anchorNodeId, handleSide, node.id, nodesRef.current, edgesRef.current)) return;
      connectTargetNodeIdRef.current = node.id;
      setConnectTargetNodeId(node.id);
    },
    [nodesRef, edgesRef],
  );

  const onNodeMouseLeave: NodeMouseHandler = useCallback((_, node) => {
    if (connectTargetNodeIdRef.current !== node.id) return;
    connectTargetNodeIdRef.current = null;
    setConnectTargetNodeId(null);
  }, []);

  const onConnectEnd: OnConnectEnd = useCallback(
    (event, connectionState) => {
      const anchorNodeId = connectionState.fromNode?.id ?? connectDragAnchorRef.current ?? undefined;
      const fromHandleId = connectionState.fromHandle?.id ?? connectDragHandleRef.current ?? 'right';
      const handleSide: 'left' | 'right' = fromHandleId === 'left' ? 'left' : 'right';
      const hoveredTargetId = connectTargetNodeIdRef.current;
      clearConnectDrag();

      if (connectionState.isValid || !anchorNodeId) return;

      if (hoveredTargetId) {
        const connection = buildNodePairConnection(anchorNodeId, handleSide, hoveredTargetId);
        if (commitConnection(connection)) {
          markSkipNextPaneClick();
          return;
        }
      }

      const anchorType = getNodeWorkflowType(nodes.find((n) => n.id === anchorNodeId));
      if (!anchorType) return;
      if (getSpawnTypesForHandle(anchorType, handleSide).length === 0) return;

      const { x, y } = getClientCoords(event);
      const flowPos = screenToFlowPosition({ x, y });
      markSkipNextPaneClick();

      if (handleSide === 'left') {
        setConnectMenu(null);
        setAddNodeMenu({
          screenX: x,
          screenY: y,
          flowX: flowPos.x,
          flowY: flowPos.y,
          anchorNodeId,
          handleSide: 'left',
        });
        return;
      }
      setAddNodeMenu(null);
      setConnectMenu({
        screenX: x,
        screenY: y,
        flowX: flowPos.x,
        flowY: flowPos.y,
        anchorNodeId,
        handleSide,
      });
    },
    [
      nodes,
      setConnectMenu,
      setAddNodeMenu,
      markSkipNextPaneClick,
      clearConnectDrag,
      commitConnection,
      screenToFlowPosition,
    ],
  );

  const isValidConnection = useCallback(
    (connection: Connection | Edge) => {
      const c = connection as Connection;
      if (!c.source || !c.target) return false;
      return isValidNodeConnection(c.source, c.target, nodesRef.current, edgesRef.current);
    },
    [nodesRef, edgesRef],
  );

  return {
    onConnect,
    onConnectStart,
    onConnectEnd,
    onNodeMouseEnter,
    onNodeMouseLeave,
    connectTargetNodeId,
    isValidConnection,
  };
}
