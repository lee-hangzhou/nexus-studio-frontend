import { useReactFlow, type Node } from '@xyflow/react';
import { useCallback, useMemo, type Dispatch, type SetStateAction } from 'react';
import type { CanvasPatchOp, CanvasNodeKind } from '../../api/canvasTypes';
import { DEFAULT_NODE_META } from '../../schema/nodeDefaults';
import {
  buildDataDependencyPorts,
  getNodeWorkflowType,
  getSpawnTypesForHandle,
} from '../utils/nodeConnectionRules';
import type { ConnectDropMenuState, PaneAddNodeMenuState, WorkflowNodeType } from '../types';
import type { CanvasPatchResult } from '../../api/canvasTypes';

type Params = {
  nodes: Node[];
  addNodeMenu: PaneAddNodeMenuState | null;
  connectMenu: ConnectDropMenuState | null;
  commitOps: (ops: CanvasPatchOp[]) => Promise<CanvasPatchResult | null>;
  setAddNodeMenu: Dispatch<SetStateAction<PaneAddNodeMenuState | null>>;
  setConnectMenu: Dispatch<SetStateAction<ConnectDropMenuState | null>>;
};

export function useDreamCanvasSpawnMenus({
  nodes,
  addNodeMenu,
  connectMenu,
  commitOps,
  setAddNodeMenu,
  setConnectMenu,
}: Params) {
  const { screenToFlowPosition } = useReactFlow();

  const addNodeMenuAllowedTypes = useMemo(() => {
    if (!addNodeMenu?.anchorNodeId) return undefined;
    const anchorType = getNodeWorkflowType(nodes.find((n) => n.id === addNodeMenu.anchorNodeId));
    if (!anchorType) return [];
    return getSpawnTypesForHandle(anchorType, addNodeMenu.handleSide ?? 'left');
  }, [addNodeMenu, nodes]);

  const connectMenuAllowedTypes = useMemo(() => {
    if (!connectMenu) return undefined;
    const anchorType = getNodeWorkflowType(nodes.find((n) => n.id === connectMenu.anchorNodeId));
    if (!anchorType) return [];
    return getSpawnTypesForHandle(anchorType, connectMenu.handleSide);
  }, [connectMenu, nodes]);

  const spawnNode = useCallback(
    async (
      type: WorkflowNodeType,
      flowPos: { x: number; y: number },
      anchor?: { id: string; side: 'left' | 'right' },
    ) => {
      const meta = DEFAULT_NODE_META[type as CanvasNodeKind];
      const createOp: CanvasPatchOp = {
        op: 'create_node',
        node: {
          kind: type as CanvasNodeKind,
          position: flowPos,
          title: meta.title,
          input_prompt: '',
          output_text: '',
          model_id: meta.model_id,
          ratio: meta.ratio,
          duration_sec: meta.duration_sec,
        },
      };

      if (anchor) {
        const anchorType = getNodeWorkflowType(nodes.find((n) => n.id === anchor.id));
        if (!anchorType) {
          return;
        }
        const ports =
          anchor.side === 'left'
            ? buildDataDependencyPorts(type as WorkflowNodeType, anchorType)
            : buildDataDependencyPorts(anchorType, type as WorkflowNodeType);
        createOp.connect_anchor = {
          node_id: anchor.id,
          side: anchor.side,
          ...ports,
        };
      }

      await commitOps([createOp]);
    },
    [commitOps, nodes],
  );

  const handleAddNodeMenuSelect = useCallback(
    (type: WorkflowNodeType) => {
      if (!addNodeMenu) return;
      const flowPos = screenToFlowPosition({ x: addNodeMenu.screenX, y: addNodeMenu.screenY });
      if (addNodeMenu.anchorNodeId) {
        void spawnNode(type, flowPos, { id: addNodeMenu.anchorNodeId, side: addNodeMenu.handleSide ?? 'left' });
      } else {
        void spawnNode(type, flowPos);
      }
      setAddNodeMenu(null);
    },
    [addNodeMenu, screenToFlowPosition, spawnNode, setAddNodeMenu],
  );

  const handleConnectMenuSelect = useCallback(
    (type: WorkflowNodeType) => {
      if (!connectMenu) return;
      const flowPos = screenToFlowPosition({ x: connectMenu.screenX, y: connectMenu.screenY });
      void spawnNode(type, flowPos, { id: connectMenu.anchorNodeId, side: connectMenu.handleSide });
      setConnectMenu(null);
    },
    [connectMenu, screenToFlowPosition, spawnNode, setConnectMenu],
  );

  return {
    addNodeMenuAllowedTypes,
    connectMenuAllowedTypes,
    handleAddNodeMenuSelect,
    handleConnectMenuSelect,
  };
}
