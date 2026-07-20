import type { CanvasPatchEvent, CanvasStreamFrame } from '../api/canvasTypes';
import type { CanvasNodeStatus } from '../api/canvasTypes';

export function canvasPatchFromFrame(frame: CanvasStreamFrame): CanvasPatchEvent | null {
  if (frame.type !== 'canvas_patch') return null;
  const d = frame.data as CanvasPatchEvent | undefined;
  if (!d || typeof d.revision !== 'number') return null;
  return d;
}

export function generationProgressFromFrame(
  frame: CanvasStreamFrame,
): { node_id: string; status?: CanvasNodeStatus; task_id?: number; revision?: number } | null {
  if (frame.type !== 'generation_progress') return null;
  const d = frame.data;
  return {
    node_id: d.node_id,
    status: d.status,
    task_id: d.task_id ?? undefined,
    revision: d.revision,
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
