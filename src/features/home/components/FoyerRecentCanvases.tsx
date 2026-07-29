import { PlusOutlined } from '@ant-design/icons';
import { Spin } from 'antd';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';
import { Link, useNavigate } from 'react-router-dom';
import type { ProjectView } from '../../../api/projects';
import { CoverThumb } from '../../projects/components/CoverThumb';
import styles from '../pages/FoyerPage.module.css';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

const RECENT_VISIBLE = 3;

type Props = {
  projects: ProjectView[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onCreateCanvas: () => void;
};

export function FoyerRecentCanvases({
  projects,
  loading,
  error,
  onRetry,
  onCreateCanvas,
}: Props) {
  const navigate = useNavigate();
  const visible = projects.slice(0, RECENT_VISIBLE);

  return (
    <section className={styles.section} aria-labelledby="foyer-recent-canvases">
      <div className={styles.sectionHead}>
        <h2 id="foyer-recent-canvases" className={styles.sectionTitle}>
          最近画布
        </h2>
        <Link to="/projects" className={styles.sectionMore}>
          全部画布
        </Link>
      </div>

      {loading ? (
        <div className={styles.sectionLoading}>
          <Spin />
        </div>
      ) : error ? (
        <div className={styles.sectionError} role="alert">
          <p>{error}</p>
          <button type="button" className={styles.textAction} onClick={onRetry}>
            重试
          </button>
        </div>
      ) : (
        <div className={styles.canvasGrid}>
          {visible.map((project) => (
            <button
              key={project.id}
              type="button"
              className={styles.canvasCard}
              onClick={() => navigate(`/projects/${project.id}`)}
            >
              <CoverThumb id={project.id} cover={project.cover} className={styles.canvasThumb} />
              <span className={styles.canvasMeta}>
                <strong className={styles.canvasName}>{project.name}</strong>
                <span className={styles.canvasTime}>
                  {dayjs(project.activity_at).fromNow()}活动
                </span>
              </span>
            </button>
          ))}
          <button
            type="button"
            className={`${styles.canvasCard} ${styles.canvasCreateCard}`}
            onClick={onCreateCanvas}
            aria-label="新建画布"
          >
            <span className={styles.canvasCreateIcon} aria-hidden>
              <PlusOutlined />
            </span>
            <span className={styles.canvasMeta}>
              <strong className={styles.canvasName}>新建画布</strong>
              <span className={styles.canvasTime}>从空白开始</span>
            </span>
          </button>
        </div>
      )}
    </section>
  );
}
