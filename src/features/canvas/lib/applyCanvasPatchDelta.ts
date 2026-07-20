import type { CanvasPatchEvent } from '../api/canvasTypes';
import {
  recordToFlowEdge,
  recordToFlowNode,
  type CanvasFlowEdge,
  type CanvasFlowNode,
} from '../schema/canvasSchema';

export function applyCanvasPatchDelta(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  event: CanvasPatchEvent,
): { nodes: CanvasFlowNode[]; edges: CanvasFlowEdge[] } {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const edgeMap = new Map(edges.map((e) => [e.id, e]));

  for (const r of event.nodes ?? []) {
    const prev = nodeMap.get(r.id);
    const next = recordToFlowNode(r);
    nodeMap.set(r.id, {
      ...next,
      width: prev?.width ?? next.width,
      height: prev?.height ?? next.height,
      selected: prev?.selected ?? false,
    });
  }
  for (const r of event.edges ?? []) {
    edgeMap.set(r.id, recordToFlowEdge(r));
  }
  for (const id of event.deleted_node_ids ?? []) {
    nodeMap.delete(id);
  }
  for (const id of event.deleted_edge_ids ?? []) {
    edgeMap.delete(id);
  }

  return { nodes: [...nodeMap.values()], edges: [...edgeMap.values()] };
}
