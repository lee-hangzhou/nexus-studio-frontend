import { useEffect, useMemo, useRef } from 'react';
import { getTasksStatus } from '../../../api/generate';
import { isTaskInProgress } from '../../../domains/task/types';
import type { CanvasFlowNode } from '../schema/canvasSchema';
import { activePollTaskIds, terminalPollTaskIds } from './canvasTaskPolling';

const POLL_MS = 5000;

/**
 * 按节点 generate_task_id 轮询任务终态；终态后对齐画布快照一次。
 * chained setTimeout + 页面不可见暂停。
 */
export function useCanvasGenerationWatch(
  nodes: CanvasFlowNode[],
  onTasksTerminal: () => void | Promise<void>,
  onNonTerminalTasks?: (taskIds: number[]) => void,
) {
  const onTasksTerminalRef = useRef(onTasksTerminal);
  onTasksTerminalRef.current = onTasksTerminal;
  const onNonTerminalTasksRef = useRef(onNonTerminalTasks);
  onNonTerminalTasksRef.current = onNonTerminalTasks;

  const alignedTaskIdsRef = useRef<Set<number>>(new Set());

  const pollTaskKey = useMemo(
    () => activePollTaskIds(nodes, alignedTaskIdsRef.current).join(','),
    [nodes],
  );

  useEffect(() => {
    if (!pollTaskKey) return;

    const taskIds = pollTaskKey.split(',').map(Number);
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let inFlight = false;

    const pendingIds = () => taskIds.filter((id) => !alignedTaskIdsRef.current.has(id));

    const pollOnce = async () => {
      if (!active || inFlight) return;
      const ids = pendingIds();
      if (ids.length === 0) return;
      inFlight = true;
      try {
        const response = await getTasksStatus(ids);
        if (!active) return;
        const runningIds = response.items
          .filter((view) => isTaskInProgress(view.status))
          .map((view) => view.task_id);
        if (runningIds.length > 0) {
          onNonTerminalTasksRef.current?.(runningIds);
        }
        const terminalIds = terminalPollTaskIds(response.items, response.missing_task_ids);
        if (terminalIds.length === 0) return;
        await onTasksTerminalRef.current();
        if (!active) return;
        for (const id of terminalIds) {
          alignedTaskIdsRef.current.add(id);
        }
      } catch {
        /* 轮询或对齐失败保持等待, 下次 tick 重试 */
      } finally {
        inFlight = false;
      }
    };

    const schedule = () => {
      if (!active) return;
      timer = window.setTimeout(() => {
        void (async () => {
          if (document.visibilityState === 'visible') {
            await pollOnce();
          }
          if (active && pendingIds().length > 0) {
            schedule();
          }
        })();
      }, POLL_MS);
    };

    const handleVisible = () => {
      if (active && document.visibilityState === 'visible') {
        void pollOnce();
      }
    };

    void pollOnce();
    schedule();
    document.addEventListener('visibilitychange', handleVisible);
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', handleVisible);
    };
  }, [pollTaskKey]);
}
