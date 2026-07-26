import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { Empty, Input, Modal, Spin, message } from 'antd';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createProject, listProjects, type ProjectView } from '../../../api/projects';
import { CoverThumb } from '../components/CoverThumb';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

const PAGE_SIZE = 11;

export function ProjectsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<ProjectView[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [creating, setCreating] = useState(false);

  const loadPage = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listProjects({ page, page_size: PAGE_SIZE, query });
      setItems(res.items ?? []);
      setTotal(res.total ?? 0);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '画布列表加载失败');
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, query]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  const handleCreate = useCallback(async () => {
    const name = createName.trim();
    if (!name) {
      message.warning('请输入画布名称');
      return;
    }
    setCreating(true);
    try {
      const created = await createProject(name);
      setCreateOpen(false);
      setCreateName('');
      navigate(`/projects/${created.project.id}/episodes/${created.default_episode.id}`);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '创建画布失败');
    } finally {
      setCreating(false);
    }
  }, [createName, navigate]);

  return (
    <div className="studio-projects-gallery">
      <div className="studio-projects-gallery__header">
        <div className="studio-projects-gallery__heading">
          <h1>画布</h1>
          <p>打开已有画布，或新建一个继续创作。</p>
        </div>
        <div className="studio-projects-gallery__actions">
          <Input
            className="studio-projects-gallery__search"
            prefix={<SearchOutlined />}
            placeholder="搜索画布"
            value={query}
            allowClear
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
          />
          <button
            type="button"
            className="studio-projects-gallery__new-button"
            onClick={() => setCreateOpen(true)}
          >
            <PlusOutlined />
            <span>新建画布</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="studio-projects-gallery__loading">
          <Spin />
        </div>
      ) : total === 0 ? (
        <Empty description="还没有画布，先新建一个开始创作">
          <button
            type="button"
            className="studio-projects-gallery__empty-action"
            onClick={() => setCreateOpen(true)}
          >
            新建画布
          </button>
        </Empty>
      ) : (
        <div className="studio-projects-gallery__grid">
          {items.map((project) => (
            <button
              key={project.id}
              type="button"
              className="studio-projects-gallery__card"
              onClick={() => navigate(`/projects/${project.id}`)}
            >
              <CoverThumb
                id={project.id}
                cover={project.cover}
                className="studio-projects-gallery__thumb"
              />
              <span className="studio-projects-gallery__title">{project.name}</span>
              <span className="studio-projects-gallery__meta">
                {project.episode_count} 集 · {dayjs(project.activity_at).fromNow()}活动
              </span>
            </button>
          ))}

          {totalPages > 1 ? (
            <div className="studio-projects-gallery__pagination">
              <button
                type="button"
                className="studio-projects-gallery__page-btn"
                disabled={currentPage <= 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                上一页
              </button>
              <span className="studio-projects-gallery__page-status">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                className="studio-projects-gallery__page-btn"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              >
                下一页
              </button>
            </div>
          ) : null}
        </div>
      )}

      <Modal
        title="新建画布"
        open={createOpen}
        okText="创建并打开"
        cancelText="取消"
        confirmLoading={creating}
        onOk={() => void handleCreate()}
        onCancel={() => {
          if (!creating) {
            setCreateOpen(false);
            setCreateName('');
          }
        }}
        destroyOnClose
      >
        <Input
          placeholder="画布名称，例如：都市逆袭 · 第一集"
          value={createName}
          maxLength={255}
          onChange={(event) => setCreateName(event.target.value)}
          onPressEnter={() => void handleCreate()}
          autoFocus
        />
      </Modal>
    </div>
  );
}
