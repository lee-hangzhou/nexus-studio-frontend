export type TaskStatus = 'pending' | 'running' | 'success' | 'failed';

export interface TaskBase {
  id: string;
  type: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  errorMessage?: string;
}

