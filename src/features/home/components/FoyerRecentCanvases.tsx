import { PlusOutlined } from '@ant-design/icons';
import { Empty, Spin } from 'antd';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';
import { Link, useNavigate } from 'react-router-dom';
import type { ProjectView } from '../../../api/projects';
import { CoverThumb } from '../../projects/components/CoverThumb';
import styles from '../pages/FoyerPage.module.css';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

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
      ) : projects.length === 0 ? (
        <Empty description="还没有画布">
          <button type="button" className={styles.primaryAction} onClick={onCreateCanvas}>
            <PlusOutlined />
            新建画布
          </button>
        </Empty>
      ) : (
        <div className={styles.canvasGrid}>
          {projects.map((project) => (
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
        </div>
      )}
    </section>
  );
}
