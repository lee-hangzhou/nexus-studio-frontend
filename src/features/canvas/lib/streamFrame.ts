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
  task_id?: number | null;
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
  const event: GenerationProgressEvent = {
    node_id: nodeId,
    status: d.status,
    revision,
  };
  if (d && 'task_id' in d) {
    event.task_id = d.task_id ?? null;
  }
  return event;
}

export type CanvasSessionTitleEvent = {
  session_id: number;
  title: string;
  updated_at?: string;
};

export function canvasSessionTitleFromFrame(frame: CanvasStreamFrame): CanvasSessionTitleEvent | null {
  if (frame.type !== 'canvas_session_title') return null;
  if (frame.session_id == null || !frame.title) {
    throw new Error('canvas_session_title missing session_id/title');
  }
  return {
    session_id: frame.session_id,
    title: frame.title,
    updated_at: frame.updated_at,
  };
}

export { toolPendingFromFrame } from '../../skills/toolPending';
