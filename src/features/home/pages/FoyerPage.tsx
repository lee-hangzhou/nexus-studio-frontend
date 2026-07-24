import { PlusOutlined } from '@ant-design/icons';
import { Modal, message } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listChatModels, type ChatModelItem } from '../../../api/chat';
import { listGenerateTasks, type GenerateTaskListItem } from '../../../api/generate';
import { createProject, listProjects, type ProjectView } from '../../../api/projects';
import { useUser } from '../../../contexts/UserContext';
import { StudioSegment } from '../../../shared/ui/StudioSegment';
import { ChatComposerBox } from '../../chat/components/ChatComposerBox';
import {
  CreateComposer,
  type CreateComposerParams,
  type CreateComposerSubmitPayload,
} from '../../generate/components/CreateComposer';
import { DEFAULT_CREATE_COMPOSER_PARAMS } from '../../generate/composerDefaults';
import type { GenerateKind } from '../../generate/types';
import { DEFAULT_HISTORY_FILTERS } from '../../generate/types';
import { buildGenerateTaskListRequest } from '../../generate/utils/taskListRequest';
import { FoyerInProgressTasks } from '../components/FoyerInProgressTasks';
import { FoyerRecentCanvases } from '../components/FoyerRecentCanvases';
import { buildFoyerGreeting } from '../foyerGreeting';
import {
  FOYER_HANDOFF_STATE_KEY,
  type FoyerAgentHandoff,
  type FoyerCreateHandoff,
} from '../foyerHandoff';
import {
  createPendingLocalFile,
  revokePendingLocalFile,
  revokePendingLocalFiles,
  type PendingLocalFile,
} from '../pendingLocalFiles';
import styles from './FoyerPage.module.css';

type FoyerMode = 'create' | 'agent';

const MODE_OPTIONS: { value: FoyerMode; label: string }[] = [
  { value: 'create', label: '创作' },
  { value: 'agent', label: 'Agent' },
];

const RECENT_CANVAS_LIMIT = 6;
const IN_PROGRESS_LIMIT = 8;

export function FoyerPage() {
  const navigate = useNavigate();
  const { user } = useUser();

  const [mode, setMode] = useState<FoyerMode>('create');
  const [kind, setKind] = useState<GenerateKind>('image');
  const [params, setParams] = useState<CreateComposerParams>(DEFAULT_CREATE_COMPOSER_PARAMS);

  const [agentInput, setAgentInput] = useState('');
  const [agentModels, setAgentModels] = useState<ChatModelItem[]>([]);
  const [agentModelsLoading, setAgentModelsLoading] = useState(false);
  const [agentModel, setAgentModel] = useState('');
  const [agentFiles, setAgentFiles] = useState<PendingLocalFile[]>([]);
  const [agentModelsError, setAgentModelsError] = useState<string | null>(null);

  const [projects, setProjects] = useState<ProjectView[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);

  const [inProgressTasks, setInProgressTasks] = useState<GenerateTaskListItem[]>([]);
  const [inProgressLoading, setInProgressLoading] = useState(true);
  const [inProgressError, setInProgressError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [creating, setCreating] = useState(false);

  const loadProjects = useCallback(async () => {
    setProjectsLoading(true);
    setProjectsError(null);
    try {
      const res = await listProjects({ page: 1, page_size: RECENT_CANVAS_LIMIT });
      setProjects(res.items ?? []);
    } catch (err) {
      setProjects([]);
      setProjectsError(err instanceof Error ? err.message : '画布列表加载失败');
    } finally {
      setProjectsLoading(false);
    }
  }, []);

  const loadInProgress = useCallback(async () => {
    setInProgressLoading(true);
    setInProgressError(null);
    try {
      const res = await listGenerateTasks(
        buildGenerateTaskListRequest(
          { ...DEFAULT_HISTORY_FILTERS, status: 'in_progress' },
          null,
          IN_PROGRESS_LIMIT,
        ),
      );
      setInProgressTasks(res.items ?? []);
    } catch (err) {
      setInProgressTasks([]);
      setInProgressError(err instanceof Error ? err.message : '在途任务加载失败');
    } finally {
      setInProgressLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProjects();
    void loadInProgress();
  }, [loadInProgress, loadProjects]);

  const loadAgentModels = useCallback(async () => {
    setAgentModelsLoading(true);
    setAgentModelsError(null);
    try {
      const items = await listChatModels();
      setAgentModels(items);
      setAgentModel((current) => current || items[0]?.key || '');
    } catch (err) {
      setAgentModels([]);
      setAgentModelsError(err instanceof Error ? err.message : '模型列表加载失败');
    } finally {
      setAgentModelsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAgentModels();
  }, [loadAgentModels]);

  useEffect(() => {
    return () => {
      revokePendingLocalFiles(agentFiles);
    };
    // 仅卸载时回收；文件增删在各自 handler 里 revoke
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateSubmit = useCallback(
    (payload: CreateComposerSubmitPayload) => {
      const handoff: FoyerCreateHandoff = {
        version: 1,
        target: 'create',
        autoSubmit: true,
        payload,
      };
      navigate('/generate', { state: { [FOYER_HANDOFF_STATE_KEY]: handoff } });
    },
    [navigate],
  );

  const handleAgentSend = useCallback(() => {
    const messageText = agentInput.trim();
    if (!messageText) {
      message.warning('请先输入内容');
      return;
    }
    if (!agentModel) {
      message.error(agentModelsError ?? '暂无可用模型，请稍后重试');
      return;
    }
    const handoff: FoyerAgentHandoff = {
      version: 1,
      target: 'agent',
      autoSubmit: true,
      model: agentModel,
      message: messageText,
      files: agentFiles.map((item) => item.file),
    };
    navigate('/chat', { state: { [FOYER_HANDOFF_STATE_KEY]: handoff } });
  }, [agentFiles, agentInput, agentModel, agentModelsError, navigate]);

  const handleCreateCanvas = useCallback(async () => {
    const name = createName.trim();
    if (!name) {
      message.warning('请输入画布名称');
      return;
    }
    setCreating(true);
    try {
      const project = await createProject(name);
      setCreateOpen(false);
      setCreateName('');
      navigate(`/projects/${project.id}/canvas`);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '创建画布失败');
    } finally {
      setCreating(false);
    }
  }, [createName, navigate]);

  const greeting = buildFoyerGreeting(user?.username);

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>{greeting}</h1>
        <p className={styles.lead}>从一句话开始，或继续你的画布。</p>
      </header>

      <div className={styles.body}>
        <section className={styles.composerBlock} aria-label="首页创作入口">
          <StudioSegment
            className={styles.modeSwitch}
            aria-label="首页模式"
            options={MODE_OPTIONS}
            value={mode}
            onChange={setMode}
          />

          {agentModelsError && mode === 'agent' ? (
            <div className={styles.composerBanner} role="alert">
              <p>{agentModelsError}</p>
              <button
                type="button"
                className={styles.textAction}
                onClick={() => void loadAgentModels()}
              >
                重试
              </button>
            </div>
          ) : null}

          <div className={styles.composerMount}>
            <div
              className={`${styles.composerSlot}${mode === 'create' ? ` ${styles.composerSlotActive}` : ''}`}
              aria-hidden={mode !== 'create'}
              ref={(node) => {
                if (node) node.inert = mode !== 'create';
              }}
            >
              <CreateComposer
                kind={kind}
                params={params}
                onKindChange={setKind}
                onParamsChange={(patch) => setParams((prev) => ({ ...prev, ...patch }))}
                onSubmit={handleCreateSubmit}
              />
            </div>
            <div
              className={`${styles.composerSlot}${mode === 'agent' ? ` ${styles.composerSlotActive}` : ''}`}
              aria-hidden={mode !== 'agent'}
              ref={(node) => {
                if (node) node.inert = mode !== 'agent';
              }}
            >
              <ChatComposerBox
                input={agentInput}
                onInputChange={setAgentInput}
                models={agentModels}
                selectedModel={agentModel}
                onModelChange={setAgentModel}
                attachments={agentFiles.map((item) => ({
                  id: item.localId,
                  filename: item.file.name,
                  mime_type: item.file.type || 'application/octet-stream',
                  preview_url: item.previewUrl,
                }))}
                onRemoveAttachment={(localId) => {
                  setAgentFiles((prev) => {
                    const target = prev.find((item) => item.localId === localId);
                    if (target) revokePendingLocalFile(target);
                    return prev.filter((item) => item.localId !== localId);
                  });
                }}
                onUploadFile={(file) => {
                  setAgentFiles((prev) => [...prev, createPendingLocalFile(file)]);
                }}
                busy={false}
                modelsLoading={agentModelsLoading}
                canSend={Boolean(agentModel) && Boolean(agentInput.trim())}
                onSend={handleAgentSend}
                showDisclaimer={false}
                fixedTextareaHeight
              />
            </div>
          </div>
        </section>

        <button
          type="button"
          className={styles.createCanvasBtn}
          onClick={() => setCreateOpen(true)}
        >
          <PlusOutlined aria-hidden />
          新建画布
        </button>

        <FoyerRecentCanvases
          projects={projects}
          loading={projectsLoading}
          error={projectsError}
          onRetry={() => void loadProjects()}
          onCreateCanvas={() => setCreateOpen(true)}
        />

        <FoyerInProgressTasks
          tasks={inProgressTasks}
          loading={inProgressLoading}
          error={inProgressError}
          onRetry={() => void loadInProgress()}
        />
      </div>

      <Modal
        title="新建画布"
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
        destroyOnClose
      >
        <input
          className={styles.createInput}
          value={createName}
          onChange={(event) => setCreateName(event.target.value)}
          placeholder="画布名称"
          aria-label="画布名称"
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
