import type { Edge, Node } from '@xyflow/react';
import type { CanvasEdgeRecord, CanvasNodeKind, CanvasNodeRecord, CanvasNodeStatus } from '../api/canvasTypes';
import type { CanvasNodeData as ApiCanvasNodeData } from '../../../api/generated/canvas';
import { DEFAULT_NODE_SIZE } from '../storyflow/constants';
import { flattenNodeData, type FlatNodeFields } from './nodeFields';

export type CanvasNodeData = FlatNodeFields & {
  kind: CanvasNodeKind;
  revision: number;
  /** 产品契约 data blob（写 patch 时 fold） */
  payload: ApiCanvasNodeData;
  output_asset_urls?: string[];
  generatePending?: boolean;
};

export type CanvasFlowNode = Node<CanvasNodeData, CanvasNodeKind>;
export type CanvasFlowEdgeData = {
  revision: number;
  source_port: CanvasEdgeRecord['source_port'];
  target_port: CanvasEdgeRecord['target_port'];
  edge_type: CanvasEdgeRecord['edge_type'];
  metadata: CanvasEdgeRecord['metadata'];
};
export type CanvasFlowEdge = Edge<CanvasFlowEdgeData>;

export function recordToNodeData(r: CanvasNodeRecord): CanvasNodeData {
  const payload = r.data ?? {};
  const flat = flattenNodeData(r.kind, payload);
  return {
    kind: r.kind,
    revision: r.revision,
    payload,
    output_asset_urls: r.output_asset_urls ?? undefined,
    ...flat,
  };
}

export function flowDimensionsForKind(kind: CanvasNodeKind): { width: number; height: number } {
  return DEFAULT_NODE_SIZE[kind] ?? DEFAULT_NODE_SIZE.text;
}

export function toFlowNodes(records: CanvasNodeRecord[]): CanvasFlowNode[] {
  return records.map((r) => {
    const size = flowDimensionsForKind(r.kind);
    return {
      id: r.id,
      type: r.kind,
      position: { x: r.position.x, y: r.position.y },
      width: r.width ?? size.width,
      height: r.height ?? size.height,
      data: recordToNodeData(r),
    };
  });
}

/** React Flow 节点锚点只有 left / right；语义端口存 data，不参与 Handle id。 */
export function flowHandlesForEdge(): { sourceHandle: 'right'; targetHandle: 'left' } {
  return { sourceHandle: 'right', targetHandle: 'left' };
}

export function toFlowEdges(records: CanvasEdgeRecord[]): CanvasFlowEdge[] {
  const handles = flowHandlesForEdge();
  return records.map((r) => ({
    id: r.id,
    source: r.source,
    target: r.target,
    sourceHandle: handles.sourceHandle,
    targetHandle: handles.targetHandle,
    type: 'workflowCanvas',
    className: 'workflow-canvas-edge',
    data: {
      revision: r.revision,
      source_port: r.source_port,
      target_port: r.target_port,
      edge_type: r.edge_type,
      metadata: r.metadata,
    },
  }));
}

export function recordToFlowNode(r: CanvasNodeRecord): CanvasFlowNode {
  return toFlowNodes([r])[0];
}

export function recordToFlowEdge(r: CanvasEdgeRecord): CanvasFlowEdge {
  return toFlowEdges([r])[0];
}

export type { CanvasNodeStatus };
