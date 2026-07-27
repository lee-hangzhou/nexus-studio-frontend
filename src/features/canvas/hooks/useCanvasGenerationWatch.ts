import { useEffect, useRef } from 'react';
import { getTasksStatus } from '../../../api/generate';
import type { CanvasFlowNode } from '../schema/canvasSchema';
import { isTaskInProgress } from '../../../domains/task/types';

const POLL_MS = 5000;

/** 节点 running 且已有 task_id 时轮询; 发现终态后走 onTasksTerminal 对齐整图, 不旁路改 revision */
export function useCanvasGenerationWatch(
  nodes: CanvasFlowNode[],
  onTasksTerminal: () => void | Promise<void>,
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
        const missingIds = new Set(response.missing_task_ids);
        const hasTerminal =
          response.items.some((view) => !isTaskInProgress(view.status)) || missingIds.size > 0;
        if (!hasTerminal) return;
        await onTasksTerminalRef.current();
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
  }, [pollingTaskKey]);
}
