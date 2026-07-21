import { Tag } from 'antd';
import { TASK_STATUS } from '../../domains/task/types';
import type { TaskStatus } from '../../domains/task/types';

const map: Record<TaskStatus, { color: string; label: string }> = {
  [TASK_STATUS.CREATED]: { color: 'default', label: '已创建' },
  [TASK_STATUS.QUEUED]: { color: 'default', label: '排队中' },
  [TASK_STATUS.WAITING]: { color: 'default', label: '等待中' },
  [TASK_STATUS.RUNNING]: { color: 'processing', label: '生成中' },
  [TASK_STATUS.SUCCEEDED]: { color: 'success', label: '已完成' },
  [TASK_STATUS.FAILED]: { color: 'error', label: '失败' },
  [TASK_STATUS.CANCELLED]: { color: 'default', label: '已取消' },
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const item = map[status];
  return <Tag color={item.color}>{item.label}</Tag>;
}
