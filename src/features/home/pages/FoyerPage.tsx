import {
  AppstoreOutlined,
  CommentOutlined,
  PictureOutlined,
} from '@ant-design/icons';
import { Empty, Modal, Spin, message } from 'antd';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { listConversations, type ConversationView } from '../../../api/chat';
import { listGenerateTasks } from '../../../api/generate';
import { createProject, listProjects, type ProjectView } from '../../../api/projects';
import { toFeedItemFromTaskList } from '../../generate/utils/feedItemMappers';
import type { GenerateFeedItem } from '../../generate/types';
import { StudioButton } from '../../../shared/ui/StudioButton';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

type ContinueKind = 'canvas' | 'generate' | 'chat';

type ContinueItem =
  | { kind: 'canvas'; project: ProjectView }
  | { kind: 'generate'; item: GenerateFeedItem }
  | { kind: 'chat'; conversation: ConversationView };

function kindLabel(kind: ContinueKind): string {
  switch (kind) {
    case 'canvas':
      return '画布';
    case 'generate':
      return '创作';
    case 'chat':
      return '对话';
  }
}

export function FoyerPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [continues, setContinues] = useState<ContinueItem[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [creating, setCreating] = useState(false);

  const loadRecent = useCallback(async () => {
    setLoading(true);
    try {
      const [projectsRes, tasksRes, chatsRes] = await Promise.allSettled([
        listProjects({ page: 1, page_size: 6, query: '' }),
        listGenerateTasks({ page_size: 6 }),
        listConversations({ offset: 0, limit: 6 }),
      ]);

      const projectItems: ContinueItem[] =
        projectsRes.status === 'fulfilled'
          ? (projectsRes.value.items ?? []).map((project) => ({
              kind: 'canvas' as const,
              project,
            }))
          : [];
      const generateItems: ContinueItem[] =
        tasksRes.status === 'fulfilled'
          ? (tasksRes.value.items ?? [])
              .map((row) => toFeedItemFromTaskList(row))
              .filter((item): item is GenerateFeedItem => item != null)
              .map((item) => ({ kind: 'generate' as const, item }))
          : [];
      const chatItems: ContinueItem[] =
        chatsRes.status === 'fulfilled'
          ? (chatsRes.value.items ?? []).map((conversation) => ({
              kind: 'chat' as const,
              conversation,
            }))
          : [];

      if (
        projectsRes.status === 'rejected' &&
        tasksRes.status === 'rejected' &&
        chatsRes.status === 'rejected'
      ) {
        const first = projectsRes.reason;
        message.error(first instanceof Error ? first.message : '最近工作加载失败');
      }

      const merged = [...projectItems, ...generateItems, ...chatItems].sort((a, b) => {
        const ta =
          a.kind === 'canvas'
            ? a.project.updated_at
            : a.kind === 'generate'
              ? a.item.createdAt
              : a.conversation.updated_at;
        const tb =
          b.kind === 'canvas'
            ? b.project.updated_at
            : b.kind === 'generate'
              ? b.item.createdAt
              : b.conversation.updated_at;
        return dayjs(tb).valueOf() - dayjs(ta).valueOf();
      });

      setContinues(merged.slice(0, 6));
    } catch (err) {
      message.error(err instanceof Error ? err.message : '最近工作加载失败');
      setContinues([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRecent();
  }, [loadRecent]);

  const handleCreateCanvas = useCallback(async () => {
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

  const openContinue = (entry: ContinueItem) => {
    if (entry.kind === 'canvas') {
      navigate(`/projects/${entry.project.id}/canvas`);
      return;
    }
    if (entry.kind === 'generate') {
      navigate('/generate');
      return;
    }
    navigate(`/chat?conversation=${entry.conversation.id}`);
  };

  return (
    <div className="studio-foyer">
      <div className="studio-foyer__hero">
        <h1 className="studio-foyer__title">把想象变成画面</h1>
        <p className="studio-foyer__lead">写一句描述，开始生成。</p>
        <div className="studio-foyer__ctas">
          <StudioButton variant="primary" size="lg" onClick={() => navigate('/generate')}>
            开始创作
          </StudioButton>
          <StudioButton variant="ghost" size="lg" onClick={() => setCreateOpen(true)}>
            打开画布
          </StudioButton>
          <StudioButton variant="text" size="lg" onClick={() => navigate('/chat')}>
            打开对话
          </StudioButton>
        </div>
      </div>

      <section className="studio-foyer__recent" aria-label="最近工作">
        <div className="studio-foyer__recent-head">
          <h2>最近</h2>
          <Link to="/projects" className="studio-foyer__recent-more">
            全部工作
          </Link>
        </div>

        {loading ? (
          <div className="studio-foyer__loading">
            <Spin />
          </div>
        ) : continues.length === 0 ? (
          <Empty description="还没有最近工作，从上方开始一次创作或画布" />
        ) : (
          <ul className="studio-foyer__recent-list">
            {continues.map((entry) => {
              if (entry.kind === 'canvas') {
                return (
                  <li key={`canvas-${entry.project.id}`}>
                    <button type="button" className="studio-foyer__card" onClick={() => openContinue(entry)}>
                      <div className="studio-foyer__card-thumb studio-foyer__card-thumb--canvas" aria-hidden>
                        <AppstoreOutlined />
                      </div>
                      <div className="studio-foyer__card-meta">
                        <span className="studio-foyer__card-kind">{kindLabel('canvas')}</span>
                        <strong>{entry.project.name}</strong>
                        <span>{dayjs(entry.project.updated_at).fromNow()}</span>
                      </div>
                      <span className="studio-foyer__card-action">继续</span>
                    </button>
                  </li>
                );
              }
              if (entry.kind === 'generate') {
                const thumb = entry.item.resultImages?.[0]?.url;
                return (
                  <li key={`generate-${entry.item.id}`}>
                    <button type="button" className="studio-foyer__card" onClick={() => openContinue(entry)}>
                      <div className="studio-foyer__card-thumb" aria-hidden>
                        {thumb ? (
                          <img src={thumb} alt="" />
                        ) : (
                          <PictureOutlined />
                        )}
                      </div>
                      <div className="studio-foyer__card-meta">
                        <span className="studio-foyer__card-kind">{kindLabel('generate')}</span>
                        <strong>{entry.item.prompt || '未命名生成'}</strong>
                        <span>{dayjs(entry.item.createdAt).fromNow()}</span>
                      </div>
                      <span className="studio-foyer__card-action">打开</span>
                    </button>
                  </li>
                );
              }
              return (
                <li key={`chat-${entry.conversation.id}`}>
                  <button type="button" className="studio-foyer__card" onClick={() => openContinue(entry)}>
                    <div className="studio-foyer__card-thumb studio-foyer__card-thumb--chat" aria-hidden>
                      <CommentOutlined />
                    </div>
                    <div className="studio-foyer__card-meta">
                      <span className="studio-foyer__card-kind">{kindLabel('chat')}</span>
                      <strong>{entry.conversation.title || '新对话'}</strong>
                      <span>{dayjs(entry.conversation.updated_at).fromNow()}</span>
                    </div>
                    <span className="studio-foyer__card-action">打开</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Modal
        title="新建画布项目"
        open={createOpen}
        okText="创建并打开"
        cancelText="取消"
        confirmLoading={creating}
        onOk={() => void handleCreateCanvas()}
        onCancel={() => {
          if (!creating) {
            setCreateOpen(false);
            setCreateName('');
          }
        }}
      >
        <input
          className="studio-foyer__create-input"
          value={createName}
          placeholder="项目名称"
          aria-label="项目名称"
          onChange={(event) => setCreateName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              void handleCreateCanvas();
            }
          }}
        />
      </Modal>
    </div>
  );
}
