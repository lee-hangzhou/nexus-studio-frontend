import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { Empty, Input, Modal, Spin, message } from 'antd';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createProject, listProjects, type ProjectView } from '../../../api/projects';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

const PAGE_SIZE = 11;

const PROJECT_PALETTES = [
  { base: '#26302c', accent: '#485d4f' },
  { base: '#30282d', accent: '#5d4650' },
  { base: '#2b2c35', accent: '#4e5268' },
  { base: '#332d25', accent: '#62513d' },
] as const;

function projectAccent(project: ProjectView) {
  const palette = PROJECT_PALETTES[project.id % PROJECT_PALETTES.length];
  return {
    backgroundColor: palette.base,
    backgroundImage:
      `linear-gradient(135deg, transparent 0 46%, ${palette.accent} 46% 58%, transparent 58%), ` +
      'repeating-linear-gradient(90deg, transparent 0 28px, rgba(255,255,255,0.035) 28px 29px)',
  };
}

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
      message.error(err instanceof Error ? err.message : '项目列表加载失败');
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
      message.warning('请输入项目名称');
      return;
    }
    setCreating(true);
    try {
      const project = await createProject(name);
      setCreateOpen(false);
      setCreateName('');
      navigate(`/projects/${project.id}/canvas`);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '创建项目失败');
    } finally {
      setCreating(false);
    }
  }, [createName, navigate]);

  return (
    <div className="studio-projects-gallery">
      <div className="studio-projects-gallery__header">
        <div className="studio-projects-gallery__heading">
          <h1>全部工作</h1>
          <p>打开已有画布项目，或新建一个工作空间。</p>
        </div>
        <div className="studio-projects-gallery__actions">
          <Input
            className="studio-projects-gallery__search"
            prefix={<SearchOutlined />}
            placeholder="搜索项目"
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
            <span>新建项目</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="studio-projects-gallery__loading">
          <Spin />
        </div>
      ) : total === 0 ? (
        <Empty description="还没有项目，先创建一个开始画布创作">
          <button
            type="button"
            className="studio-projects-gallery__empty-action"
            onClick={() => setCreateOpen(true)}
          >
            新建项目
          </button>
        </Empty>
      ) : (
        <div className="studio-projects-gallery__grid">
          {items.map((project) => (
            <button
              key={project.id}
              type="button"
              className="studio-projects-gallery__card"
              onClick={() => navigate(`/projects/${project.id}/canvas`)}
            >
              <span className="studio-projects-gallery__thumb" style={projectAccent(project)} />
              <span className="studio-projects-gallery__title">{project.name}</span>
              <span className="studio-projects-gallery__meta">
                编辑于 {dayjs(project.updated_at).fromNow()}
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
        title="新建画布项目"
        open={createOpen}
        okText="创建并进入画布"
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
          placeholder="项目名称，例如：都市逆袭 · 第一集"
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
