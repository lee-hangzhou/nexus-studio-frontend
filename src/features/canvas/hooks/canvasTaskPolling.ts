import { isTaskInProgress, isTaskTerminal, type TaskStatus } from '../../../domains/task/types';
import type { GenerateTaskView } from '../../../api/generate';
import type { CanvasFlowNode } from '../schema/canvasSchema';

/** 节点上可能仍非终态的任务：有 task_id 且节点展示态未落终态、且未做过对齐 */
export function activePollTaskIds(
  nodes: CanvasFlowNode[],
  alignedTaskIds: ReadonlySet<number>,
): number[] {
  const pending: number[] = [];
  const seen = new Set<number>();
  for (const node of nodes) {
    const taskId = node.data.task_id;
    if (taskId == null || alignedTaskIds.has(taskId) || seen.has(taskId)) continue;
    const status = node.data.status;
    if (status === 'success' || status === 'failed') continue;
    seen.add(taskId);
    pending.push(taskId);
  }
  return pending.sort((a, b) => a - b);
}

/** 一次轮询响应里已终态或缺失的任务, 触发一次画布对齐 */
export function terminalPollTaskIds(
  items: GenerateTaskView[],
  missingTaskIds: number[],
): number[] {
  const terminal = items
    .filter((view) => !isTaskInProgress(view.status))
    .map((view) => view.task_id);
  return Array.from(new Set([...terminal, ...missingTaskIds]));
}

/** 任务状态 → 节点展示 status */
export function displayStatusFromTask(taskStatus: TaskStatus): 'running' | 'success' | 'failed' {
  if (isTaskInProgress(taskStatus)) return 'running';
  if (isTaskTerminal(taskStatus) && taskStatus === 5) return 'success';
  return 'failed';
}
