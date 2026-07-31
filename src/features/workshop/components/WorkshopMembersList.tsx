import { Avatar, Button } from 'antd';

import type { WorkshopRoomMemberView } from '../../../api/workshop';
import type { WorkshopRosterExpertView, WorkshopTaskView } from '../types';
import styles from './WorkshopMembersList.module.css';

export function WorkshopMembersList(props: {
  roomMembers: WorkshopRoomMemberView[];
  roster: WorkshopRosterExpertView[];
  tasks: WorkshopTaskView[];
  assignments: Record<string, string[]>;
  onRemove?: (expertId: string) => void;
  onSelect?: (expertId: string) => void;
}) {
  const { roomMembers, tasks, assignments, onRemove, onSelect } = props;

  const taskByExpert = new Map<string, WorkshopTaskView>();
  for (const [taskId, expertIds] of Object.entries(assignments)) {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) continue;
    for (const expertId of expertIds) taskByExpert.set(expertId, task);
  }

  const rows = [
    {
      id: 'host',
      name: '项目助手',
      avatar_url: '/avatars/experts/host.png',
      task: undefined as WorkshopTaskView | undefined,
      removable: false,
    },
    ...roomMembers.map((member) => ({
      id: member.expert_id,
      name: member.name,
      avatar_url: member.avatar_url,
      task: member.current_task_title
        ? tasks.find((item) => item.id === member.current_task_id) ??
          ({ title: member.current_task_title, status: 'executing' } as WorkshopTaskView)
        : taskByExpert.get(member.expert_id),
      removable: true,
    })),
  ];

  return (
    <div className={styles.root}>
      <ul className={styles.list}>
        {rows.map((row) => {
          return (
            <li key={row.id} className={styles.row}>
              <button type="button" className={styles.main} onClick={() => onSelect?.(row.id)}>
                <Avatar size={28} src={row.avatar_url} alt="">
                  {row.name.slice(0, 1)}
                </Avatar>
                <div className={styles.meta}>
                  <span className={styles.name}>{row.name}</span>
                  <span className={styles.task}>{row.task ? row.task.title : '暂无任务'}</span>
                </div>
              </button>
              <div className={styles.actions}>
                {row.removable && onRemove ? (
                  <Button size="small" type="link" onClick={() => onRemove(row.id)}>
                    移出
                  </Button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
