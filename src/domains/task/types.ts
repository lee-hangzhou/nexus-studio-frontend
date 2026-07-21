import type { GenerationTaskStatus } from '../../api/generated/generation';

export type TaskStatus = GenerationTaskStatus;

export const TASK_STATUS = {
  CREATED: 1,
  QUEUED: 2,
  WAITING: 3,
  RUNNING: 4,
  SUCCEEDED: 5,
  FAILED: 6,
  CANCELLED: 7,
} as const;

export function isTaskInProgress(status: TaskStatus): boolean {
  return status === TASK_STATUS.CREATED
    || status === TASK_STATUS.QUEUED
    || status === TASK_STATUS.WAITING
    || status === TASK_STATUS.RUNNING;
}

export function isTaskTerminal(status: TaskStatus): boolean {
  return status === TASK_STATUS.SUCCEEDED
    || status === TASK_STATUS.FAILED
    || status === TASK_STATUS.CANCELLED;
}

export function isTaskQueued(status: TaskStatus): boolean {
  return status === TASK_STATUS.CREATED
    || status === TASK_STATUS.QUEUED
    || status === TASK_STATUS.WAITING;
}

export interface TaskBase {
  id: string;
  type: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  errorMessage?: string;
}
