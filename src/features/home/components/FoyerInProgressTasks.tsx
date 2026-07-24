import { Link } from 'react-router-dom';
import type { GenerateTaskListItem } from '../../../api/generate';
import { TaskStatusBadge } from '../../../shared/ui/TaskStatusBadge';
import styles from '../pages/FoyerPage.module.css';

function formatEta(seconds: number | null | undefined): string | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return null;
  if (seconds < 60) return `约 ${Math.round(seconds)} 秒`;
  return `约 ${Math.max(1, Math.round(seconds / 60))} 分钟`;
}

function kindLabel(kind: GenerateTaskListItem['kind']): string {
  return kind === 'video' ? '视频生成' : '图片生成';
}

type Props = {
  tasks: GenerateTaskListItem[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
};

/** 首页「生成中」：仅创作在途任务。无任务时由调用方整块隐藏。 */
export function FoyerInProgressTasks({ tasks, loading, error, onRetry }: Props) {
  if (!loading && !error && tasks.length === 0) {
    return null;
  }

  return (
    <section className={styles.section} aria-labelledby="foyer-in-progress">
      <div className={styles.sectionHead}>
        <h2 id="foyer-in-progress" className={styles.sectionTitle}>
          生成中
        </h2>
        <Link to="/generate" className={styles.sectionMore}>
          查看全部
        </Link>
      </div>
      <p className={styles.sectionNote}>创作页在途生成；无任务时隐藏整块。</p>

      {loading ? (
        <div className={styles.sectionLoading} aria-busy>
          加载中…
        </div>
      ) : error ? (
        <div className={styles.sectionError} role="alert">
          <p>{error}</p>
          <button type="button" className={styles.textAction} onClick={onRetry}>
            重试
          </button>
        </div>
      ) : (
        <ul className={styles.taskList}>
          {tasks.map((task) => {
            const eta = formatEta(task.estimated_wait_seconds);
            const prompt = task.prompt?.trim() || '未命名任务';
            return (
              <li key={task.task_id} className={styles.taskRow}>
                <Link to="/generate" className={styles.taskLink}>
                  {task.preview_url ? (
                    <img
                      className={styles.taskThumb}
                      src={task.preview_url}
                      alt=""
                    />
                  ) : (
                    <span className={styles.taskThumbFallback} aria-hidden />
                  )}
                  <span className={styles.taskBody}>
                    <strong className={styles.taskTitle}>{prompt}</strong>
                    <span className={styles.taskTags}>
                      <span className={`${styles.tag} ${styles.tagCreate}`}>创作</span>
                      <span className={styles.tag}>{kindLabel(task.kind)}</span>
                      <TaskStatusBadge status={task.status} />
                    </span>
                  </span>
                  {eta ? <span className={styles.taskEta}>{eta}</span> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
