import {
  Background,
  Controls,
  ReactFlow,
  SelectionMode,
  type ReactFlowInstance,
} from '@xyflow/react';
import { useCallback, useMemo, useRef } from 'react';
import { CanvasAddNodeMenu } from '../storyflow/menus/CanvasAddNodeMenu';
import { ConnectionDropMenu } from '../storyflow/menus/ConnectionDropMenu';
import { CanvasHeader } from '../storyflow/components/CanvasHeader';
import { CanvasEmptyStateHost } from '../storyflow/components/CanvasEmptyStateHost';
import { CanvasActionsContext } from '../storyflow/context/CanvasActionsContext';
import { CanvasEdgeHoverContext } from '../storyflow/context/CanvasEdgeHoverContext';
import { workflowEdgeTypes } from '../storyflow/edgeTypes';
import { workflowNodeTypes } from '../storyflow/nodeTypes';
import { useCanvasConnectPreview } from '../storyflow/hooks/useCanvasConnectPreview';
import { useCanvasEdgeHover } from '../storyflow/hooks/useCanvasEdgeHover';
import { useCanvasOverlayMenus } from '../storyflow/hooks/useCanvasOverlayMenus';
import { useDreamCanvasConnections } from '../storyflow/hooks/useDreamCanvasConnections';
import { useDreamCanvasSpawnMenus } from '../storyflow/hooks/useDreamCanvasSpawnMenus';
import type { CanvasPatchOp } from '../api/canvasTypes';
import type { NodeChangeInput } from '../storyflow/types';
import type { CanvasFlowEdge, CanvasFlowNode } from '../schema/canvasSchema';

type Props = {
  projectId: number;
  projectName?: string;
  busy: boolean;
  onStop: () => void;
  nodes: CanvasFlowNode[];
  edges: CanvasFlowEdge[];
  loaded: boolean;
  onNodesChange: import('@xyflow/react').OnNodesChange;
  onEdgesChange: import('@xyflow/react').OnEdgesChange;
  onNodeDragStop: import('@xyflow/react').OnNodeDrag;
  commitOps: (ops: CanvasPatchOp[]) => Promise<import('../api/canvasTypes').CanvasPatchResult | null>;
  onNodeChange: (input: NodeChangeInput) => void;
  onQuickAdd: (kind: import('../api/canvasTypes').CanvasNodeKind, position: { x: number; y: number }) => void;
};

export function WorkflowCanvasFlow({
  projectId,
  projectName,
  busy,
  onStop,
  nodes,
  edges,
  loaded,
  onNodesChange,
  onEdgesChange,
  onNodeDragStop,
  commitOps,
  onNodeChange,
  onQuickAdd,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const reactFlowRef = useRef<ReactFlowInstance | null>(null);
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  nodesRef.current = nodes;
  edgesRef.current = edges;

  const { hoveredEdgeId, setHoveredEdgeId, scheduleClearHoveredEdge } = useCanvasEdgeHover();

  const {
    connectMenu,
    setConnectMenu,
    addNodeMenu,
    setAddNodeMenu,
    onPaneClick,
    onPaneContextMenu,
    markSkipNextPaneClick,
  } = useCanvasOverlayMenus();

  const {
    onConnect,
    onConnectStart,
    onConnectEnd,
    onNodeMouseEnter,
    onNodeMouseLeave,
    connectTargetNodeId,
    isValidConnection,
  } = useDreamCanvasConnections({
    nodes,
    nodesRef,
    edgesRef,
    commitOps,
    setConnectMenu,
    setAddNodeMenu,
    markSkipNextPaneClick,
  });

  const { addNodeMenuAllowedTypes, connectMenuAllowedTypes, handleAddNodeMenuSelect, handleConnectMenuSelect } =
    useDreamCanvasSpawnMenus({
      nodes,
      addNodeMenu,
      connectMenu,
      commitOps,
      setAddNodeMenu,
      setConnectMenu,
    });

  const { flowNodes, flowEdges, handleNodesChange, handleEdgesChange } = useCanvasConnectPreview({
    connectMenu,
    addNodeMenu,
    connectTargetNodeId,
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
  });

  const deleteEdge = useCallback(
    (edgeId: string) => {
      void commitOps([{ op: 'disconnect', edge_id: edgeId }]);
    },
    [commitOps],
  );

  const actionsValue = useMemo(
    () => ({
      onNodeChange,
      snapshotBeforeChange: () => {},
      deleteEdge,
    }),
    [onNodeChange, deleteEdge],
  );

  const edgeHoverValue = useMemo(
    () => ({ hoveredEdgeId, setHoveredEdgeId, scheduleClearHoveredEdge }),
    [hoveredEdgeId, setHoveredEdgeId, scheduleClearHoveredEdge],
  );

  return (
    <CanvasActionsContext.Provider value={actionsValue}>
      <CanvasEdgeHoverContext.Provider value={edgeHoverValue}>
        <div ref={containerRef} className="workflow-canvas-flow" tabIndex={0}>
          <CanvasHeader
            projectId={projectId}
            projectName={projectName}
            busy={busy}
            onStop={onStop}
          />
          <div className="workflow-canvas-flow__stage">
            <ReactFlow
              onInit={(instance) => {
                reactFlowRef.current = instance as unknown as ReactFlowInstance;
              }}
              nodes={flowNodes}
              edges={flowEdges}
              onNodesChange={handleNodesChange}
              onEdgesChange={handleEdgesChange}
              onConnect={onConnect}
              isValidConnection={isValidConnection}
              onConnectStart={onConnectStart}
              onConnectEnd={onConnectEnd}
              onNodeMouseEnter={onNodeMouseEnter}
              onNodeMouseLeave={onNodeMouseLeave}
              connectionRadius={80}
              onPaneClick={onPaneClick}
              onPaneContextMenu={onPaneContextMenu}
              onNodeDragStop={onNodeDragStop}
              nodeTypes={workflowNodeTypes}
              edgeTypes={workflowEdgeTypes}
              elementsSelectable
              nodesDraggable
              selectionMode={SelectionMode.Partial}
              selectionOnDrag
              multiSelectionKeyCode="Shift"
              deleteKeyCode={['Backspace', 'Delete']}
              panOnDrag={[2]}
              panActivationKeyCode="Space"
              panOnScroll
              zoomOnScroll={false}
              zoomOnPinch
              zoomOnDoubleClick={false}
              minZoom={0.1}
              maxZoom={2}
              elevateEdgesOnSelect
              proOptions={{ hideAttribution: true }}
            >
              <Background gap={16} size={1} color="#3a3a42" />
              <Controls showInteractive={false} position="bottom-right" />
              <CanvasEmptyStateHost nodes={nodes} loaded={loaded} onQuickAdd={onQuickAdd} />
            </ReactFlow>
          </div>
          {addNodeMenu ? (
            <CanvasAddNodeMenu
              x={addNodeMenu.screenX}
              y={addNodeMenu.screenY}
              allowedTypes={addNodeMenuAllowedTypes}
              onSelect={handleAddNodeMenuSelect}
              onClose={() => setAddNodeMenu(null)}
            />
          ) : null}
          {connectMenu ? (
            <ConnectionDropMenu
              x={connectMenu.screenX}
              y={connectMenu.screenY}
              allowedTypes={connectMenuAllowedTypes}
              onSelect={handleConnectMenuSelect}
              onClose={() => setConnectMenu(null)}
            />
          ) : null}
        </div>
      </CanvasEdgeHoverContext.Provider>
    </CanvasActionsContext.Provider>
  );
}
