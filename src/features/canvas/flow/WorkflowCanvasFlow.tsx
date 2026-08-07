import {
  Background,
  Controls,
  ReactFlow,
  SelectionMode,
  type Node,
  type OnEdgesChange,
  type OnNodeDrag,
  type OnNodesChange,
  type ReactFlowInstance,
} from '@xyflow/react';
import { useCallback, useMemo, useRef, type MouseEvent } from 'react';
import type { CanvasNodeKind, CanvasPatchOpInput, CanvasPatchResult } from '../api/canvasTypes';
import { CanvasAgentCanvasPickBanner } from '../components/CanvasAgentCanvasPickBanner';
import { CanvasOperationBar } from '../components/CanvasOperationBar';
import { useCanvasAgentPick } from '../context/CanvasAgentPickContext';
import { CanvasAddNodeMenu } from '../storyflow/menus/CanvasAddNodeMenu';
import { ConnectionDropMenu } from '../storyflow/menus/ConnectionDropMenu';
import {
  CanvasHeader,
  type CanvasHeaderEpisode,
} from '../storyflow/components/CanvasHeader';
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
import type { NodeChangeInput } from '../storyflow/types';
import type { CanvasFlowEdge, CanvasFlowNode } from '../schema/canvasSchema';

type Props = {
  projectId: number;
  episodeId: number;
  projectName?: string;
  episodeName?: string;
  episodes: CanvasHeaderEpisode[];
  busy: boolean;
  nodes: CanvasFlowNode[];
  edges: CanvasFlowEdge[];
  loaded: boolean;
  onNodesChange: OnNodesChange<CanvasFlowNode>;
  onEdgesChange: OnEdgesChange<CanvasFlowEdge>;
  onNodeDragStop: OnNodeDrag<CanvasFlowNode>;
  commitOps: (ops: CanvasPatchOpInput[]) => Promise<CanvasPatchResult | null>;
  onNodeChange: (input: NodeChangeInput) => void;
  onQuickAdd: (kind: CanvasNodeKind, position: { x: number; y: number }) => void;
};

export function WorkflowCanvasFlow({
  projectId,
  episodeId,
  projectName,
  episodeName,
  episodes,
  busy,
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

  const { isPickMode, addPickedNode, exitPickMode } = useCanvasAgentPick();
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

  const onNodeClick = useCallback(
    (_event: MouseEvent, node: Node) => {
      if (isPickMode) {
        addPickedNode(node.id);
      }
    },
    [addPickedNode, isPickMode],
  );

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
    onNodesChange: onNodesChange as OnNodesChange,
    onEdgesChange: onEdgesChange as OnEdgesChange,
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

  const getViewportCenterFlowPosition = useCallback(() => {
    const instance = reactFlowRef.current;
    const stage = containerRef.current?.querySelector<HTMLElement>('.workflow-canvas-flow__stage');
    const rect = stage?.getBoundingClientRect();
    const screenCenter = {
      x: rect ? rect.left + rect.width / 2 : window.innerWidth / 2,
      y: rect ? rect.top + rect.height / 2 : window.innerHeight / 2,
    };
    return instance?.screenToFlowPosition(screenCenter) ?? { x: 0, y: 0 };
  }, []);

  const handleOperationBarAddNode = useCallback(
    (kind: CanvasNodeKind) => {
      onQuickAdd(kind, getViewportCenterFlowPosition());
    },
    [getViewportCenterFlowPosition, onQuickAdd],
  );

  return (
    <CanvasActionsContext.Provider value={actionsValue}>
      <CanvasEdgeHoverContext.Provider value={edgeHoverValue}>
        <div
          ref={containerRef}
          className={`workflow-canvas-flow${isPickMode ? ' workflow-canvas-flow--agent-pick' : ''}`}
          tabIndex={0}
        >
          <CanvasHeader
            projectId={projectId}
            episodeId={episodeId}
            projectName={projectName}
            episodeName={episodeName}
            episodes={episodes}
            busy={busy}
          />
          <div className="workflow-canvas-flow__stage">
            {isPickMode ? <CanvasAgentCanvasPickBanner onExit={exitPickMode} /> : null}
            <CanvasOperationBar
              disabled={isPickMode}
              onAddNode={handleOperationBarAddNode}
            />
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
              onNodeClick={onNodeClick}
              onNodeMouseEnter={onNodeMouseEnter}
              onNodeMouseLeave={onNodeMouseLeave}
              connectionRadius={80}
              onPaneClick={onPaneClick}
              onPaneContextMenu={onPaneContextMenu}
              onNodeDragStop={isPickMode ? undefined : (onNodeDragStop as OnNodeDrag)}
              nodeTypes={workflowNodeTypes}
              edgeTypes={workflowEdgeTypes}
              elementsSelectable
              nodesDraggable={!isPickMode}
              nodesConnectable={!isPickMode}
              selectionMode={SelectionMode.Partial}
              selectionOnDrag={!isPickMode}
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
              <Controls showInteractive={false} position="bottom-left" />
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
