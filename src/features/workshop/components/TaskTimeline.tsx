import { Empty, Tag, Timeline, Typography } from 'antd';
import {
  buildTaskTimelineEntries,
  formatSseAttributionLine,
} from '../utils/sseAttribution';
import type { TaskTimelineEntry } from '../types';
import styles from './TaskTimeline.module.css';

export function TaskTimeline(props: {
  entries: TaskTimelineEntry[];
  loading?: boolean;
}) {
  const { entries, loading } = props;

  if (!loading && entries.length === 0) {
    return <Empty description="暂无任务时间线" />;
  }

  return (
    <div className={styles.root}>
      <Typography.Text type="secondary" className={styles.hint}>
        SSE 归因占位（speaker_role / expert_id / task_id）
      </Typography.Text>
      <Timeline
        pending={loading ? '加载中…' : false}
        items={entries.map((entry) => ({
          key: entry.task_id,
          children: (
            <div className={styles.item}>
              <div className={styles.titleRow}>
                <Typography.Text strong>{entry.title}</Typography.Text>
                <Tag>{entry.status}</Tag>
              </div>
              <Typography.Paragraph code copyable className={styles.attribution}>
                {formatSseAttributionLine(entry)}
              </Typography.Paragraph>
            </div>
          ),
        }))}
      />
    </div>
  );
}

export { buildTaskTimelineEntries };
