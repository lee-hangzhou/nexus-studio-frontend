import { ScissorOutlined } from '@ant-design/icons';
import {
  BaseEdge,
  getBezierPath,
  getConnectedEdges,
  useReactFlow,
  useStore,
  useViewport,
  type EdgeProps,
} from '@xyflow/react';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { CONNECT_PREVIEW_EDGE_ID } from '../../constants';
import { useCanvasActions } from '../../context/CanvasActionsContext';
import { useCanvasEdgeHoverContext } from '../../context/CanvasEdgeHoverContext';
import { getClosestPointOnPath, getEdgeStrokeStyle } from '../../utils/edgeStyle';
import './WorkflowCanvasEdge.less';

/** 鼠标移入连线后，延迟多久再显示删除按钮 */
const DELETE_BUTTON_SHOW_DELAY_MS = 1000;

/** 可交互画布连线：hover 高亮；hover 满 1s 后显示删除钮，并沿路径跟随鼠标 */
function WorkflowCanvasEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  markerEnd,
}: EdgeProps) {
  const { deleteEdge } = useCanvasActions();
  const { hoveredEdgeId, setHoveredEdgeId, scheduleClearHoveredEdge } =
    useCanvasEdgeHoverContext();
  const { flowToScreenPosition, screenToFlowPosition } = useReactFlow();
  // 订阅视口变化，平移/缩放时同步更新删除按钮屏幕坐标
  const viewport = useViewport();

  const [hoverPoint, setHoverPoint] = useState<{ x: number; y: number } | null>(null);
  const [showDeleteButton, setShowDeleteButton] = useState(false);

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const isHovered = hoveredEdgeId === id;

  const connectedToSelectedNode = useStore(s => {
    const selectedNodes = s.nodes.filter(n => n.selected);
    if (selectedNodes.length === 0) {
      return false;
    }
    return getConnectedEdges(selectedNodes, s.edges).some(e => e.id === id);
  });

  const strokeStyle = useMemo(
    () =>
      getEdgeStrokeStyle(
        { id, selected: !!selected },
        hoveredEdgeId,
        connectedToSelectedNode,
      ),
    [id, selected, hoveredEdgeId, connectedToSelectedNode],
  );

  useEffect(() => {
    if (!isHovered) {
      setHoverPoint(null);
      setShowDeleteButton(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setShowDeleteButton(true);
    }, DELETE_BUTTON_SHOW_DELAY_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [isHovered]);

  const updateHoverPointFromClient = useCallback(
    (clientX: number, clientY: number) => {
      const flowPos = screenToFlowPosition({ x: clientX, y: clientY });
      setHoverPoint(getClosestPointOnPath(edgePath, flowPos.x, flowPos.y));
    },
    [edgePath, screenToFlowPosition]
  );

  const handleHitPointerMove = useCallback(
    (event: React.PointerEvent<SVGPathElement>) => {
      updateHoverPointFromClient(event.clientX, event.clientY);
      setHoveredEdgeId(id);
    },
    [id, setHoveredEdgeId, updateHoverPointFromClient]
  );

  const handleHitPointerEnter = useCallback(
    (event: React.PointerEvent<SVGPathElement>) => {
      updateHoverPointFromClient(event.clientX, event.clientY);
      setHoveredEdgeId(id);
    },
    [id, setHoveredEdgeId, updateHoverPointFromClient]
  );

  const deleteFlowX = hoverPoint?.x ?? labelX;
  const deleteFlowY = hoverPoint?.y ?? labelY;

  const deleteScreenPos = useMemo(
    () => flowToScreenPosition({ x: deleteFlowX, y: deleteFlowY }),
    [flowToScreenPosition, deleteFlowX, deleteFlowY, viewport.x, viewport.y, viewport.zoom]
  );

  const handleDeletePointerDown = useCallback(
    (event: React.PointerEvent) => {
      event.stopPropagation();
      event.preventDefault();
      deleteEdge(id);
    },
    [deleteEdge, id]
  );

  // 连线落点预览边：仅渲染路径，不参与 hover/删除
  if (id === CONNECT_PREVIEW_EDGE_ID) {
    return <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={strokeStyle} />;
  }

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={strokeStyle}
        interactionWidth={24}
      />
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={24}
        className="workflow-canvas-edge__hit"
        onPointerEnter={handleHitPointerEnter}
        onPointerMove={handleHitPointerMove}
        onPointerLeave={scheduleClearHoveredEdge}
      />
      {isHovered && showDeleteButton
        ? createPortal(
            <div
              className="workflow-canvas-edge__delete-wrap nodrag nopan"
              style={{
                position: 'fixed',
                left: deleteScreenPos.x,
                top: deleteScreenPos.y,
                transform: 'translate(-50%, -50%)',
              }}
              onPointerDown={event => event.stopPropagation()}
              onMouseEnter={() => setHoveredEdgeId(id)}
              onMouseLeave={scheduleClearHoveredEdge}
            >
              <button
                type="button"
                className="workflow-canvas-edge__delete"
                aria-label="删除连线"
                onPointerDown={handleDeletePointerDown}
              >
                <ScissorOutlined />
              </button>
            </div>,
            document.body
          )
        : null}
    </>
  );
}

export const WorkflowCanvasEdge = memo(WorkflowCanvasEdgeComponent);
