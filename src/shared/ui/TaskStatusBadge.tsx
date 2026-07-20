import { Tag } from 'antd';
import type { TaskStatus } from '../../domains/task/types';

const map: Record<TaskStatus, { color: string; label: string }> = {
  pending: { color: 'default', label: '等待中' },
  running: { color: 'processing', label: '进行中' },
  success: { color: 'success', label: '已完成' },
  failed: { color: 'error', label: '失败' },
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const item = map[status];
  return <Tag color={item.color}>{item.label}</Tag>;
}

