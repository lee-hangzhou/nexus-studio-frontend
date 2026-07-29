import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { Empty, Input, Modal, Spin, message } from 'antd';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  createEpisode,
  deleteEpisode,
  listEpisodes,
  updateEpisode,
  type EpisodeView,
} from '../../../api/episodes';
import { getProject, updateProject, type ProjectView } from '../../../api/projects';
import { useStudioApp } from '../../../shared/ui/useStudioApp';
import { CoverPicker } from '../components/CoverPicker';
import { CoverThumb } from '../components/CoverThumb';
import styles from './ProjectDetailPage.module.css';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

const EPISODE_PAGE_SIZE = 12;

type CoverTarget =
  | { type: 'project' }
  | { type: 'episode'; episodeId: number };

export function ProjectDetailPage() {
  const navigate = useNavigate();
  const { modal } = useStudioApp();
  const { projectId: rawProjectId } = useParams();
  const projectId = Number(rawProjectId);
  const [project, setProject] = useState<ProjectView | null>(null);
  const [episodes, setEpisodes] = useState<EpisodeView[]>([]);
  const [episodePage, setEpisodePage] = useState(1);
  const [episodeTotal, setEpisodeTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [creating, setCreating] = useState(false);
  const creatingRef = useRef(false);
  const [coverTarget, setCoverTarget] = useState<CoverTarget | null>(null);

  const loadProject = useCallback(async (signal?: AbortSignal) => {
    if (!Number.isFinite(projectId) || projectId <= 0) return;
    setLoading(true);
    setLoadError(null);
    try {
      const detail = await getProject(projectId, { signal });
      if (signal?.aborted) return;
      setProject(detail.project);
    } catch (err) {
      if (signal?.aborted || (err instanceof DOMException && err.name === 'AbortError')) return;
      setProject(null);
      setLoadError(err instanceof Error ? err.message : '项目加载失败');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [projectId]);

  const loadEpisodes = useCallback(async (page: number, signal?: AbortSignal) => {
    if (!Number.isFinite(projectId) || projectId <= 0) return;
    setEpisodesLoading(true);
    try {
      const res = await listEpisodes(
        { project_id: projectId, page, page_size: EPISODE_PAGE_SIZE },
        { signal },
      );
      if (signal?.aborted) return;
      const total = res.total ?? 0;
      const totalPages = Math.max(1, Math.ceil(total / EPISODE_PAGE_SIZE));
      const safePage = Math.min(page, totalPages);
      if (safePage !== page && total > 0) {
        setEpisodePage(safePage);
        return;
      }
      setEpisodes(res.items ?? []);
      setEpisodeTotal(total);
    } catch (err) {
      if (signal?.aborted || (err instanceof DOMException && err.name === 'AbortError')) return;
      message.error(err instanceof Error ? err.message : '集列表加载失败');
      setEpisodes([]);
      setEpisodeTotal(0);
    } finally {
      if (!signal?.aborted) setEpisodesLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    const controller = new AbortController();
    setEpisodePage(1);
    void loadProject(controller.signal);
    return () => controller.abort();
  }, [loadProject]);

  useEffect(() => {
    if (!project) return;
    const controller = new AbortController();
    void loadEpisodes(episodePage, controller.signal);
    return () => controller.abort();
  }, [project, episodePage, loadEpisodes]);

  const refreshAfterMutation = useCallback(async () => {
    const detail = await getProject(projectId);
    setProject(detail.project);
    await loadEpisodes(episodePage);
  }, [episodePage, loadEpisodes, projectId]);

  const handleCreateEpisode = useCallback(async () => {
    if (creatingRef.current) return;
    const name = createName.trim();
    creatingRef.current = true;
    setCreating(true);
    try {
      const episode = await createEpisode(projectId, name || undefined);
      setCreateOpen(false);
      setCreateName('');
      navigate(`/projects/${projectId}/episodes/${episode.id}`);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '创建集失败');
    } finally {
      creatingRef.current = false;
      setCreating(false);
    }
  }, [createName, navigate, projectId]);

  const updateCover = useCallback(
    async (assetId: number | null) => {
      if (!coverTarget) return;
      if (coverTarget.type === 'project') {
        const next = await updateProject(projectId, { cover_asset_id: assetId });
        setProject(next);
        return;
      }
      const next = await updateEpisode(coverTarget.episodeId, { cover_asset_id: assetId });
      setEpisodes((prev) => prev.map((item) => (item.id === next.id ? next : item)));
    },
    [coverTarget, projectId],
  );

  const confirmDeleteEpisode = useCallback(
    (episode: EpisodeView) => {
      modal.confirm({
        title: '删除集',
        content: `确定删除「${episode.name}」吗？删除后该集画布数据会被清理`,
        okText: '删除',
        okButtonProps: { danger: true },
        cancelText: '取消',
        onOk: async () => {
          try {
            await deleteEpisode(episode.id);
            await refreshAfterMutation();
          } catch (err) {
            message.error(err instanceof Error ? err.message : '删除集失败');
            throw err;
          }
        },
      });
    },
    [modal, refreshAfterMutation],
  );

  if (!Number.isFinite(projectId) || projectId <= 0) {
    return (
      <div className={styles.page}>
        <p>无效项目，请从项目列表进入。</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`${styles.page} ${styles.loading}`}>
        <Spin />
      </div>
    );
  }

  if (loadError || !project) {
    return (
      <div className={`${styles.page} ${styles.error}`} role="alert">
        <p>{loadError || '项目不存在或无权访问'}</p>
        <div>
          <button type="button" onClick={() => void loadProject()}>
            重试
          </button>{' '}
          <button type="button" onClick={() => navigate('/projects')}>
            返回列表
          </button>
        </div>
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(episodeTotal / EPISODE_PAGE_SIZE));
  const currentPage = Math.min(episodePage, totalPages);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button type="button" className={styles.back} onClick={() => navigate('/projects')}>
          ← 全部项目
        </button>
        <div className={styles.hero}>
          <CoverThumb id={project.id} cover={project.cover} className={styles.cover} />
          <div className={styles.titleBlock}>
            <h1>{project.name}</h1>
            <p>
              {project.episode_count} 集 · 最近活动 {dayjs(project.activity_at).fromNow()}
            </p>
            <button type="button" className={styles.ghostBtn} onClick={() => setCoverTarget({ type: 'project' })}>
              <EditOutlined />
              编辑项目封面
            </button>
          </div>
        </div>
        <button type="button" className={styles.primaryBtn} onClick={() => setCreateOpen(true)}>
          <PlusOutlined />
          新建集
        </button>
      </header>

      <section className={styles.episodes} aria-label="集列表">
        {episodesLoading && episodes.length === 0 ? (
          <div className={styles.episodesLoading}>
            <Spin />
          </div>
        ) : episodeTotal === 0 ? (
          <Empty description="暂无集">
            <button type="button" className={styles.primaryBtn} onClick={() => setCreateOpen(true)}>
              新建集
            </button>
          </Empty>
        ) : (
          <>
            <div className={`${styles.episodeGrid}${episodesLoading ? ` ${styles.episodeGridLoading}` : ''}`}>
              {episodes.map((episode) => (
                <article key={episode.id} className={styles.episodeCard}>
                  <button
                    type="button"
                    className={styles.episodeOpen}
                    onClick={() => navigate(`/projects/${project.id}/episodes/${episode.id}`)}
                  >
                    <CoverThumb
                      id={episode.id}
                      cover={episode.cover}
                      className={styles.episodeCover}
                    />
                    <span className={styles.episodeMeta}>
                      <strong>{episode.name}</strong>
                      <span>第 {episode.episode_no} 集 · {dayjs(episode.updated_at).fromNow()}编辑</span>
                    </span>
                  </button>
                  <div className={styles.episodeActions}>
                    <button type="button" onClick={() => setCoverTarget({ type: 'episode', episodeId: episode.id })}>
                      <EditOutlined />
                      封面
                    </button>
                    <button type="button" onClick={() => confirmDeleteEpisode(episode)}>
                      <DeleteOutlined />
                      删除
                    </button>
                  </div>
                </article>
              ))}
            </div>
            {totalPages > 1 ? (
              <div className={styles.pagination}>
                <button
                  type="button"
                  className={styles.pageBtn}
                  disabled={currentPage <= 1 || episodesLoading}
                  onClick={() => setEpisodePage((value) => Math.max(1, value - 1))}
                >
                  上一页
                </button>
                <span className={styles.pageStatus}>
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  className={styles.pageBtn}
                  disabled={currentPage >= totalPages || episodesLoading}
                  onClick={() => setEpisodePage((value) => Math.min(totalPages, value + 1))}
                >
                  下一页
                </button>
              </div>
            ) : null}
          </>
        )}
      </section>

      <Modal
        title="新建集"
        open={createOpen}
        okText="创建并打开"
        cancelText="取消"
        confirmLoading={creating}
        onOk={handleCreateEpisode}
        onCancel={() => {
          if (!creating) {
            setCreateOpen(false);
            setCreateName('');
          }
        }}
        destroyOnClose
      >
        <Input
          placeholder="留空则自动命名，例如：第 2 集"
          value={createName}
          maxLength={255}
          onChange={(event) => setCreateName(event.target.value)}
          onPressEnter={() => {
            void handleCreateEpisode();
          }}
          autoFocus
        />
      </Modal>

      <CoverPicker
        open={coverTarget !== null}
        title={coverTarget?.type === 'project' ? '编辑项目封面' : '编辑集封面'}
        onCancel={() => setCoverTarget(null)}
        onSelect={(assetId) => updateCover(assetId)}
        onClear={() => updateCover(null)}
      />
    </div>
  );
}
