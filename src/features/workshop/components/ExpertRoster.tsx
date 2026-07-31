import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  StopOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { Collapse, Tag, Typography } from 'antd';
import {
  expertDisplayProfile,
  expertStatusLabel,
} from '../utils/expertCatalog';
import type { WorkshopRosterExpertView, WorkshopTaskView } from '../types';
import styles from './ExpertRoster.module.css';

export function ExpertRoster(props: {
  experts: WorkshopRosterExpertView[];
  tasks: WorkshopTaskView[];
  assignments: Record<string, string[]>;
  loading?: boolean;
  selectedExpertId?: string | null;
  onSelectExpert?: (expertId: string) => void;
  onAssignExpert?: (expertId: string) => void;
  canAssign?: boolean;
}) {
  const {
    experts,
    tasks,
    assignments,
    loading,
    selectedExpertId,
    onSelectExpert,
    onAssignExpert,
    canAssign,
  } = props;

  if (!loading && experts.length === 0) {
    return <Typography.Text type="secondary">暂无成员</Typography.Text>;
  }

  const taskByExpert = new Map<string, WorkshopTaskView>();
  for (const [taskId, expertIds] of Object.entries(assignments)) {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) continue;
    for (const expertId of expertIds) {
      taskByExpert.set(expertId, task);
    }
  }

  return (
    <div className={styles.root} aria-busy={loading || undefined}>
      <div className={styles.list} role="list">
        {experts.map((expert) => {
          const profile = expertDisplayProfile(expert);
          const task = taskByExpert.get(expert.id);
          const assigned = Boolean(task);
          const status = expertStatusLabel({
            assigned,
            taskTitle: task?.title,
            taskStatus: task?.status,
          });
          const selected = selectedExpertId === expert.id;
          const statusIcon =
            status === '进行中' ? (
              <ThunderboltOutlined aria-hidden />
            ) : status === '需要处理' ? (
              <ExclamationCircleOutlined aria-hidden />
            ) : status === '已交付' ? (
              <CheckCircleOutlined aria-hidden />
            ) : status === '待命' ? (
              <ClockCircleOutlined aria-hidden />
            ) : (
              <StopOutlined aria-hidden />
            );

          return (
            <button
              key={expert.id}
              type="button"
              role="listitem"
              className={`${styles.row} ${selected ? styles.rowSelected : ''}`}
              onClick={() => onSelectExpert?.(expert.id)}
            >
              <div className={styles.rowMain}>
                <div className={styles.rowTitle}>
                  <span>{profile.title}</span>
                  {expert.beta ? <Tag color="gold">Beta</Tag> : null}
                </div>
                <p className={styles.responsibility}>{profile.responsibility}</p>
                <div className={styles.statusLine}>
                  {statusIcon}
                  <span>{status}</span>
                  {task ? <span className={styles.taskHint}>任务：{task.title}</span> : null}
                </div>
              </div>
              <Collapse
                ghost
                size="small"
                className={styles.detail}
                items={[
                  {
                    key: 'detail',
                    label: '详情',
                    children: (
                      <dl className={styles.meta}>
                        <div>
                          <dt>可使用资料</dt>
                          <dd>{profile.readableData}</dd>
                        </div>
                        <div>
                          <dt>负责产出</dt>
                          <dd>{profile.outputs}</dd>
                        </div>
                        <div>
                          <dt>可代你操作</dt>
                          <dd>
                            {profile.canExternalExecute
                              ? '可以，每次操作前都会请你确认'
                              : '不进行外部写操作'}
                          </dd>
                        </div>
                        {canAssign && onAssignExpert ? (
                          <div>
                            <dt>操作</dt>
                            <dd>
                              <button
                                type="button"
                                className={styles.assignBtn}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  onAssignExpert(expert.id);
                                }}
                              >
                                加入当前工作
                              </button>
                            </dd>
                          </div>
                        ) : null}
                      </dl>
                    ),
                  },
                ]}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
