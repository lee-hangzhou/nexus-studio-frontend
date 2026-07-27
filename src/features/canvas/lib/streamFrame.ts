import type { CanvasPatchEvent, CanvasStreamFrame } from '../api/canvasTypes';
import type { CanvasNodeStatus } from '../api/canvasTypes';
import { assertPatchEntitiesHaveRevision } from './applyCanvasPatchDelta';

export function canvasPatchFromFrame(frame: CanvasStreamFrame): CanvasPatchEvent | null {
  if (frame.type !== 'canvas_patch') return null;
  const d = frame.data as CanvasPatchEvent | undefined;
  if (!d) return null;
  const hasDelta =
    (d.nodes?.length ?? 0) > 0 ||
    (d.edges?.length ?? 0) > 0 ||
    (d.deleted_node_ids?.length ?? 0) > 0 ||
    (d.deleted_edge_ids?.length ?? 0) > 0;
  if (!hasDelta) return null;
  assertPatchEntitiesHaveRevision(d.nodes, d.edges);
  return d;
}

export type GenerationProgressEvent = {
  node_id: string;
  status?: CanvasNodeStatus;
  task_id?: number;
  revision: number;
};

export function generationProgressFromFrame(frame: CanvasStreamFrame): GenerationProgressEvent | null {
  if (frame.type !== 'generation_progress') return null;
  const d = frame.data;
  const nodeId = d?.node_id;
  if (typeof nodeId !== 'string' || !nodeId) {
    throw new Error('generation_progress missing node_id');
  }
  const revision = d.revision;
  if (typeof revision !== 'number' || !Number.isInteger(revision) || revision < 1) {
    throw new Error(`invalid generation_progress revision for ${nodeId}`);
  }
  return {
    node_id: nodeId,
    status: d.status,
    task_id: d.task_id ?? undefined,
    revision,
  };
}

export function toolPendingFromFrame(
  frame: CanvasStreamFrame,
): { call_id: string; name: string; summary: string } | null {
  if (frame.type !== 'tool_pending') return null;
  if (!frame.call_id) return null;
  return {
    call_id: frame.call_id,
    name: frame.name ?? '',
    summary: frame.summary ?? '待确认的工具操作',
  };
}
