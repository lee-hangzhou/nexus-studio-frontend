import type { CanvasEdgeRecord, CanvasNodeRecord, CanvasPatchEvent } from '../api/canvasTypes';
import {
  recordToFlowEdge,
  recordToFlowNode,
  type CanvasFlowEdge,
  type CanvasFlowNode,
} from '../schema/canvasSchema';

function requireEntityRevision(entity: { id: string; revision?: number }, kind: 'node' | 'edge'): number {
  const revision = entity.revision;
  if (typeof revision !== 'number' || !Number.isInteger(revision) || revision < 1) {
    throw new Error(`invalid ${kind} revision for ${entity.id}`);
  }
  return revision;
}

export function assertPatchEntitiesHaveRevision(
  nodes: CanvasNodeRecord[] | undefined,
  edges: CanvasEdgeRecord[] | undefined,
): void {
  for (const node of nodes ?? []) {
    requireEntityRevision(node, 'node');
  }
  for (const edge of edges ?? []) {
    requireEntityRevision(edge, 'edge');
  }
}

export function applyCanvasPatchDelta(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  event: CanvasPatchEvent,
): { nodes: CanvasFlowNode[]; edges: CanvasFlowEdge[] } {
  assertPatchEntitiesHaveRevision(event.nodes, event.edges);

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
