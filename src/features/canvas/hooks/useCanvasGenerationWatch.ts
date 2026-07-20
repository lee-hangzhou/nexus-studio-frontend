import { useEffect, useRef } from 'react';
import { getTasksStatus } from '../../../api/generate';
import type { CanvasNodeStatus } from '../api/canvasTypes';
import type { CanvasFlowNode } from '../schema/canvasSchema';

const POLL_MS = 5000;

/** 节点 running 且已有 task_id 时轮询任务态，兜底 callback 未送达的完成回写 */
export function useCanvasGenerationWatch(
  nodes: CanvasFlowNode[],
  setNodes: React.Dispatch<React.SetStateAction<CanvasFlowNode[]>>,
  onTasksTerminal?: () => void | Promise<void>,
) {
  const onTasksTerminalRef = useRef(onTasksTerminal);
  onTasksTerminalRef.current = onTasksTerminal;

  const pollingTaskKey = Array.from(
    new Set(
      nodes
        .filter((node) => node.data.status === 'running' && node.data.task_id)
        .map((node) => node.data.task_id!),
    ),
  ).join(',');

  useEffect(() => {
    if (!pollingTaskKey) return;

    const taskIds = pollingTaskKey.split(',').map(Number);
    let cancelled = false;
    let inFlight = false;

    const tick = async () => {
      if (cancelled || inFlight) return;
      inFlight = true;
      try {
        const response = await getTasksStatus(taskIds);
        if (cancelled) return;
        const views = new Map(response.items.map((view) => [view.task_id, view]));
        const missingIds = new Set(response.missing_task_ids);
        const hasTerminal =
          response.items.some((view) => view.status !== 'pending' && view.status !== 'running') ||
          missingIds.size > 0;
        if (!hasTerminal) return;

        setNodes((currentNodes) =>
          currentNodes.map((node) => {
            const taskId = node.data.task_id;
            if (!taskId || node.data.status !== 'running') return node;
            if (missingIds.has(taskId)) {
              return {
                ...node,
                data: {
                  ...node.data,
                  status: 'failed' as CanvasNodeStatus,
                  error_message: '任务不存在或已删除',
                },
              };
            }

            const view = views.get(taskId);
            if (!view || view.status === 'pending' || view.status === 'running') return node;
            const status: CanvasNodeStatus =
              view.status === 'success' ? 'success' : view.status === 'failed' ? 'failed' : 'idle';
            const previewUrls = view.result_urls?.map((result) => result.url).filter(Boolean) ?? [];
            return {
              ...node,
              data: {
                ...node.data,
                status,
                task_id: view.task_id,
                output_asset_urls:
                  previewUrls.length > 0 ? previewUrls : node.data.output_asset_urls,
                output_asset_ids:
                  view.result_asset_ids.length > 0 ? view.result_asset_ids : node.data.output_asset_ids,
                error_message: view.error_message ?? node.data.error_message,
              },
            };
          }),
        );
        await onTasksTerminalRef.current?.();
      } catch {
        /* 轮询失败保持 running，等待下次 tick */
      } finally {
        inFlight = false;
      }
    };

    void tick();
    const timer = setInterval(() => void tick(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [pollingTaskKey, setNodes]);
}
