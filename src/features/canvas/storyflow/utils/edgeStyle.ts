import type { Edge } from '@xyflow/react';

const EDGE_COLOR_DEFAULT = '#ffffff60';
const EDGE_COLOR_HOVER = '#7a7a7a';
const EDGE_COLOR_SELECTED = '#fff';

/** 根据 hover / 选中 / 关联选中节点 计算连线描边（在 Edge 组件内计算，避免改 flowEdges 引用） */
export function getEdgeStrokeStyle(
  edge: Pick<Edge, 'id' | 'selected'>,
  hoveredEdgeId: string | null,
  connectedToSelectedNode = false,
): { stroke: string; strokeWidth: number; strokeOpacity?: number } {
  if (edge.selected) {
    return { stroke: EDGE_COLOR_SELECTED, strokeWidth: 2 };
  }
  if (hoveredEdgeId === edge.id || connectedToSelectedNode) {
    return { stroke: EDGE_COLOR_HOVER, strokeWidth: 2, strokeOpacity: 0.9 };
  }
  return { stroke: EDGE_COLOR_DEFAULT, strokeWidth: 2, strokeOpacity: 0.5 };
}

/** 在 SVG path 上采样，取距 (x,y) 最近的点（flow 坐标系） */
export function getClosestPointOnPath(
  pathD: string,
  x: number,
  y: number
): { x: number; y: number } {
  if (typeof document === 'undefined') {
    return { x, y };
  }

  const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  pathEl.setAttribute('d', pathD);
  const total = pathEl.getTotalLength();
  if (total <= 0) {
    return { x, y };
  }

  const samples = 64;
  let bestX = x;
  let bestY = y;
  let bestDist = Infinity;

  for (let i = 0; i <= samples; i++) {
    const pt = pathEl.getPointAtLength((total * i) / samples);
    const dx = pt.x - x;
    const dy = pt.y - y;
    const dist = dx * dx + dy * dy;
    if (dist < bestDist) {
      bestDist = dist;
      bestX = pt.x;
      bestY = pt.y;
    }
  }

  return { x: bestX, y: bestY };
}
