import { CloseOutlined, LeftOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { Alert, Avatar, Button, Skeleton, Tabs, Tag, Tooltip, Typography, message } from 'antd';
import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import {
  addWorkshopPreset,
  authorizeWorkshopOperation,
  beginWorkshopShopAuth,
  getWorkshopDataSources,
  grantWorkshopExternalAuth,
  inviteWorkshopExpert,
  listWorkshopArtifacts,
  listWorkshopConnectors,
  listWorkshopRoomMembers,
  listWorkshopRoster,
  listWorkshopTaskAssignments,
  listWorkshopTasks,
  listWorkshopWorkflowRuns,
  listWorkshopWorkflows,
  manualRunWorkshopWorkflow,
  removeWorkshopExpert,
  wakeWorkshopProject,
  type WorkshopArtifactView,
  type WorkshopConnectorEntry,
  type WorkshopDataSourcesView,
  type WorkshopProjectView,
  type WorkshopRoomMemberView,
  type WorkshopRosterExpertView,
  type WorkshopTaskView,
  type WorkshopWakeDashboardView,
  type WorkshopWorkflowRunView,
  type WorkshopWorkflowView,
} from '../../../api/workshop';
import { ArtifactCards } from './ArtifactCards';
import { WorkshopArtifactList } from './WorkshopArtifactList';
import { DataSourcesPanel } from './DataSourcesPanel';
import { DiffConfirmSurface, PublishReceiptList } from './DiffConfirmSurface';
import { WorkshopMembersList } from './WorkshopMembersList';
import type { EcommerceArtifactEnvelope } from '../types';
import {
  publishOperationLabel,
  taskStatusLabel,
  workflowRunStatusLabel,
} from '../utils/displayLabels';
import { expertDisplayProfile } from '../utils/expertCatalog';
import { type ExpertDirectoryEntry } from '../utils/expertDirectory';
import { buildInviteCandidates } from '../utils/turnRouting';
import { findPublishDiffs, findPublishReceipts, parseWorkshopArtifacts } from '../utils/parseArtifacts';
import styles from './WorkshopSidePanel.module.css';

const TAB_ALIASES: Record<string, string> = {
  situation: 'overview',
  resources: 'resources',
  members: 'members',
  connect: 'connect',
  overview: 'overview',
};

function normalizeTab(tab: string | undefined, fallback: string): string {
  if (!tab) return fallback;
  return TAB_ALIASES[tab] ?? fallback;
}

function projectStatusLabel(activeTask: WorkshopTaskView | null): string {
  if (activeTask) return taskStatusLabel(activeTask.status);
  return '协作中';
}

function formatRunTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export function WorkshopSidePanel(props: {
  project: WorkshopProjectView;
  expertDirectory?: ExpertDirectoryEntry[];
  /** 会话附件/生成内容，由统一侧栏注入，避免 workshop→chat 依赖 */
  sessionResources?: ReactNode;
  onProjectUpdated?: () => void;
  onClose?: () => void;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  pendingShopAuth?: boolean;
  onPendingShopAuthHandled?: () => void;
}) {
  const {
    project,
    expertDirectory = [],
    sessionResources,
    onClose,
    activeTab,
    onTabChange,
    pendingShopAuth,
    onPendingShopAuthHandled,
  } = props;
  const projectId = project.id;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roster, setRoster] = useState<WorkshopRosterExpertView[]>([]);
  const [roomMembers, setRoomMembers] = useState<WorkshopRoomMemberView[]>([]);
  const [tasks, setTasks] = useState<WorkshopTaskView[]>([]);
  const [workflows, setWorkflows] = useState<WorkshopWorkflowView[]>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [selectedWorkflowRuns, setSelectedWorkflowRuns] = useState<WorkshopWorkflowRunView[]>([]);
  const [selectedRunsLoading, setSelectedRunsLoading] = useState(false);
  const [runBusyId, setRunBusyId] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<Record<string, string[]>>({});
  const [artifacts, setArtifacts] = useState<WorkshopArtifactView[]>([]);
  const [parsedArtifacts, setParsedArtifacts] = useState<
    ReturnType<typeof parseWorkshopArtifacts>
  >([]);
  const [envelopes, setEnvelopes] = useState<EcommerceArtifactEnvelope[]>([]);
  const [publishDiffs, setPublishDiffs] = useState<ReturnType<typeof findPublishDiffs>>([]);
  const [receipts, setReceipts] = useState<ReturnType<typeof findPublishReceipts>>([]);
  const [dataSources, setDataSources] = useState<WorkshopDataSourcesView | null>(null);
  const [connectors, setConnectors] = useState<WorkshopConnectorEntry[]>([]);
  const [shopAuthBusy, setShopAuthBusy] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [internalTab, setInternalTab] = useState('overview');
  const resolvedTab = normalizeTab(activeTab, internalTab);
  const setResolvedTab = (tab: string) => {
    const next = normalizeTab(tab, 'overview');
    if (onTabChange) onTabChange(next);
    else setInternalTab(next);
  };
  const [pendingMembersFocus, setPendingMembersFocus] = useState(false);
  const membersSectionRef = useRef<HTMLElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [
        wakeRes,
        rosterRes,
        roomRes,
        tasksRes,
        artifactsRes,
        assignRes,
        dataSourcesRes,
        connectorsRes,
        workflowsRes,
      ] = await Promise.all([
        wakeWorkshopProject(projectId).catch(() => null as WorkshopWakeDashboardView | null),
        listWorkshopRoster(projectId),
        listWorkshopRoomMembers(projectId),
        listWorkshopTasks(projectId),
        listWorkshopArtifacts(projectId),
        listWorkshopTaskAssignments(projectId),
        getWorkshopDataSources(projectId).catch(() => null),
        listWorkshopConnectors({ project_id: projectId }).catch(() => ({ items: [] })),
        listWorkshopWorkflows(projectId).catch(() => ({ items: [] })),
      ]);
      setRoster(rosterRes.items ?? []);
      setRoomMembers(roomRes.items ?? []);
      const taskItems = tasksRes.items ?? [];
      setTasks(taskItems);
      setWorkflows(workflowsRes.items ?? []);
      const map: Record<string, string[]> = {};
      for (const row of assignRes.items ?? []) map[row.task_id] = row.expert_ids ?? [];
      setAssignments(map);
      const artifactItems = artifactsRes.items ?? [];
      setArtifacts(artifactItems);
      const parsed = parseWorkshopArtifacts(artifactItems);
      setParsedArtifacts(parsed);
      setEnvelopes(
        parsed
          .map((item) => item.envelope)
          .filter((item): item is EcommerceArtifactEnvelope => item != null),
      );
      setPublishDiffs(findPublishDiffs(parsed));
      setReceipts(findPublishReceipts(parsed));
      setDataSources(dataSourcesRes);
      setConnectors(connectorsRes.items ?? []);
      const preferred =
        (wakeRes?.pinned_task_ids ?? []).find((id) => taskItems.some((task) => task.id === id)) ??
        taskItems[0]?.id ??
        null;
      setActiveTaskId((current) =>
        current && taskItems.some((task) => task.id === current) ? current : preferred,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载项目状态失败');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!pendingMembersFocus || resolvedTab !== 'members' || loading) return;
    const node = membersSectionRef.current;
    if (!node) return;
    node.scrollIntoView({ behavior: 'smooth', block: 'start' });
    node.focus({ preventScroll: true });
    setPendingMembersFocus(false);
  }, [pendingMembersFocus, resolvedTab, loading]);

  const activeTask = useMemo(
    () => tasks.find((task) => task.id === activeTaskId) ?? null,
    [activeTaskId, tasks],
  );
  const activeDiff = publishDiffs[0] ?? null;
  const storeExpert = roster.find(
    (item) => item.preset_key === 'ecom_taobao_store_ops_executor',
  );
  const storeExpertName = storeExpert
    ? expertDisplayProfile(storeExpert).title
    : '淘天店铺运营';

  const presentAvatars = useMemo(() => {
    return [
      {
        id: 'host',
        name: '项目助手',
        avatar_url: '/avatars/experts/host.png',
      },
      ...roomMembers.map((member) => ({
        id: member.expert_id,
        name: member.name,
        avatar_url: member.avatar_url,
      })),
    ];
  }, [roomMembers]);
  const visibleAvatars = presentAvatars.slice(0, 4);
  const hiddenAvatars = presentAvatars.slice(4);

  const inviteCandidates = useMemo(
    () =>
      buildInviteCandidates({
        directory: expertDirectory.filter((item) => item.key !== 'host'),
        roomMembers,
        roster,
      }),
    [expertDirectory, roomMembers, roster],
  );

  const handleBeginShopAuth = useCallback(async () => {
    setShopAuthBusy(true);
    try {
      const result = await beginWorkshopShopAuth(projectId);
      if (!result.authorize_url) {
        message.error('当前环境未配置淘宝应用');
        return;
      }
      window.open(result.authorize_url, '_blank', 'noopener,noreferrer');
      await load();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '连接失败');
    } finally {
      setShopAuthBusy(false);
    }
  }, [load, projectId]);

  useEffect(() => {
    if (!pendingShopAuth) return;
    setResolvedTab('connect');
    void handleBeginShopAuth().finally(() => onPendingShopAuthHandled?.());
  }, [handleBeginShopAuth, onPendingShopAuthHandled, pendingShopAuth]);

  const focusMembersSection = useCallback(() => {
    setResolvedTab('members');
    setPendingMembersFocus(true);
  }, []);

  const handleInvite = (expertKey: string) => {
    void (async () => {
      try {
        let rosterExpert =
          roster.find((item) => item.preset_key === expertKey) ??
          roster.find((item) => item.id === expertKey);
        if (!rosterExpert) {
          rosterExpert = await addWorkshopPreset(projectId, expertKey);
        }
        const inRoom = roomMembers.some((member) => member.expert_id === rosterExpert!.id);
        if (!inRoom) {
          await inviteWorkshopExpert(projectId, rosterExpert.id);
        }
        await load();
        message.success('已邀请进房间');
      } catch (err) {
        message.error(err instanceof Error ? err.message : '邀请失败');
      }
    })();
  };

  const handleDiffConfirm = async (payloadHash: string) => {
    if (!activeTaskId || !activeDiff) throw new Error('缺少待确认操作');
    await grantWorkshopExternalAuth(projectId, activeTaskId, ['taobao_store_write']);
    await authorizeWorkshopOperation({
      project_id: projectId,
      task_id: activeTaskId,
      capability: 'taobao_store_write',
      operation_kind: activeDiff.operation,
      payload_hash: payloadHash,
    });
    await load();
  };

  const selectedWorkflow = useMemo(
    () => workflows.find((workflow) => workflow.id === selectedWorkflowId) ?? null,
    [selectedWorkflowId, workflows],
  );

  useEffect(() => {
    if (selectedWorkflowId && !workflows.some((workflow) => workflow.id === selectedWorkflowId)) {
      setSelectedWorkflowId(null);
      setSelectedWorkflowRuns([]);
    }
  }, [selectedWorkflowId, workflows]);

  const loadSelectedWorkflowRuns = useCallback(
    async (workflowId: string) => {
      setSelectedRunsLoading(true);
      try {
        const runsRes = await listWorkshopWorkflowRuns(projectId, {
          workflowId,
          limit: 50,
        });
        setSelectedWorkflowRuns(runsRes.items ?? []);
      } catch {
        setSelectedWorkflowRuns([]);
      } finally {
        setSelectedRunsLoading(false);
      }
    },
    [projectId],
  );

  const openWorkflow = useCallback(
    (workflowId: string) => {
      setSelectedWorkflowId(workflowId);
      void loadSelectedWorkflowRuns(workflowId);
    },
    [loadSelectedWorkflowRuns],
  );

  const handleManualRun = useCallback(
    (workflowId: string) => {
      void (async () => {
        setRunBusyId(workflowId);
        try {
          await manualRunWorkshopWorkflow(projectId, workflowId, []);
          message.success('已排队执行');
          await load();
          if (selectedWorkflowId === workflowId) {
            await loadSelectedWorkflowRuns(workflowId);
          }
        } catch (err) {
          message.error(err instanceof Error ? err.message : '启动失败');
        } finally {
          setRunBusyId(null);
        }
      })();
    },
    [load, loadSelectedWorkflowRuns, projectId, selectedWorkflowId],
  );

  const listedArtifacts = useMemo(() => {
    const richIds = new Set(
      parsedArtifacts.filter((item) => item.envelope != null).map((item) => item.id),
    );
    // 结构化卡片另渲染；列表展示其余产物（含 oss 文件）。不做业务类型白名单。
    return artifacts.filter((item) => !richIds.has(item.id));
  }, [artifacts, parsedArtifacts]);

  const projectArtifactCount = artifacts.length;
  const projectArtifactsNode =
    listedArtifacts.length > 0 || envelopes.length > 0 || receipts.length > 0 ? (
      <>
        {listedArtifacts.length > 0 ? (
          <WorkshopArtifactList artifacts={listedArtifacts} />
        ) : null}
        {envelopes.length > 0 ? <ArtifactCards artifacts={envelopes} /> : null}
        <PublishReceiptList receipts={receipts} />
      </>
    ) : null;

  const situationPanel = selectedWorkflow ? (
    <div className={styles.sections}>
      <section className={styles.section}>
        <div className={styles.workflowDetailHead}>
          <Button
            type="text"
            size="small"
            icon={<LeftOutlined />}
            aria-label="返回"
            className={styles.backButton}
            onClick={() => {
              setSelectedWorkflowId(null);
              setSelectedWorkflowRuns([]);
            }}
          />
          <Typography.Text strong className={styles.sectionTitle}>
            运行记录
          </Typography.Text>
        </div>
        {selectedRunsLoading ? (
          <Skeleton active title={false} paragraph={{ rows: 4 }} />
        ) : selectedWorkflowRuns.length === 0 ? (
          <Typography.Text type="secondary">暂无运行记录</Typography.Text>
        ) : (
          <ul className={styles.taskList}>
            {selectedWorkflowRuns.map((run) => (
              <li key={run.id}>
                <div className={styles.taskItem}>
                  <strong>{formatRunTime(run.started_at ?? run.created_at)}</strong>
                  <span>
                    {workflowRunStatusLabel(run.status)}
                    {run.error_message
                      ? ` · ${
                          run.error_message.length > 72
                            ? `${run.error_message.slice(0, 72)}…`
                            : run.error_message
                        }`
                      : ''}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  ) : (
    <div className={styles.sections}>
      <section className={styles.section}>
        <Typography.Text strong className={styles.sectionTitle}>
          工作流
        </Typography.Text>
        {workflows.length === 0 ? (
          <Typography.Text type="secondary">暂无已保存工作流</Typography.Text>
        ) : (
          <ul className={styles.taskList}>
            {workflows.map((workflow) => (
              <li key={workflow.id}>
                <div className={`${styles.taskItem} ${styles.workflowRow}`}>
                  <button
                    type="button"
                    className={styles.workflowOpen}
                    onClick={() => openWorkflow(workflow.id)}
                  >
                    <strong>{workflow.name}</strong>
                  </button>
                  <Tooltip title="立即运行">
                    <Button
                      type="text"
                      size="small"
                      icon={<PlayCircleOutlined />}
                      aria-label={`立即运行：${workflow.name}`}
                      loading={runBusyId === workflow.id}
                      onClick={(event) => {
                        event.stopPropagation();
                        handleManualRun(workflow.id);
                      }}
                    />
                  </Tooltip>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {activeDiff ? (
        <section className={styles.section}>
          <Typography.Text strong className={styles.sectionTitle}>
            待确认操作
          </Typography.Text>
          <DiffConfirmSurface
            diff={activeDiff}
            proposingExpertName={storeExpertName}
            hostReviewNote={`即将${publishOperationLabel(activeDiff.operation)}，确认后执行`}
            onConfirm={handleDiffConfirm}
          />
        </section>
      ) : null}
    </div>
  );

  const resourcesPanel = (
    <div className={styles.sections}>
      {sessionResources && isValidElement(sessionResources)
        ? cloneElement(
            sessionResources as ReactElement<{
              projectArtifacts?: ReactNode;
              projectArtifactCount?: number;
            }>,
            {
              projectArtifacts: projectArtifactsNode,
              projectArtifactCount,
            },
          )
        : sessionResources ?? (
            <section className={styles.section}>
              <Typography.Text strong className={styles.sectionTitle}>
                生成内容
              </Typography.Text>
              {projectArtifactsNode ?? (
                <Typography.Text type="secondary">暂无生成内容</Typography.Text>
              )}
            </section>
          )}
    </div>
  );

  const membersPanel = (
    <div className={styles.sections}>
      <section
        id="workshop-members"
        ref={membersSectionRef}
        className={styles.section}
        tabIndex={-1}
      >
        <Typography.Text strong className={styles.sectionTitle}>
          当前专家
        </Typography.Text>
        <WorkshopMembersList
          roomMembers={roomMembers}
          roster={roster}
          tasks={tasks}
          assignments={assignments}
          onRemove={(expertId) =>
            void removeWorkshopExpert(projectId, expertId)
              .then(() => load())
              .catch((err) => message.error(err instanceof Error ? err.message : '移除失败'))
          }
        />
      </section>

      <section className={styles.section}>
        <Typography.Text strong className={styles.sectionTitle}>
          更多专家
        </Typography.Text>
        {inviteCandidates.length === 0 ? (
          <Typography.Text type="secondary">没有更多可邀请的专家</Typography.Text>
        ) : (
          <ul className={styles.resourceList}>
            {inviteCandidates.map((candidate) => (
              <li key={candidate.key} className={styles.resourceRow}>
                <div className={styles.resourceMain}>
                  <Avatar size={28} src={candidate.avatar_url} alt={candidate.name}>
                    {candidate.name.slice(0, 1)}
                  </Avatar>
                  <span className={styles.resourceName}>{candidate.name}</span>
                </div>
                <Button size="small" type="link" onClick={() => handleInvite(candidate.key)}>
                  邀请
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );

  const connectPanel = (
    <DataSourcesPanel
      dataSources={dataSources}
      connectors={connectors}
      onBeginShopAuth={() => void handleBeginShopAuth()}
      onRefresh={() => void load()}
      authBusy={shopAuthBusy}
    />
  );

  return (
    <aside className={styles.root} aria-label="详情面板" id="studio-chat-side-panel">
      <header className={styles.head}>
        <div>
          <Typography.Text strong>{project.name}</Typography.Text>
          <div className={styles.meta}>
            <Tag>{projectStatusLabel(activeTask)}</Tag>
          </div>
          <div className={styles.projectRow}>
            <button
              type="button"
              className={styles.membersTrigger}
              onClick={focusMembersSection}
              aria-controls="workshop-members"
              aria-label="成员"
            >
              <Avatar.Group size="small">
                {visibleAvatars.map((member) => (
                  <Tooltip key={member.id} title={member.name}>
                    <Avatar src={member.avatar_url} alt={member.name}>
                      {member.name.slice(0, 1)}
                    </Avatar>
                  </Tooltip>
                ))}
              </Avatar.Group>
            </button>
            {hiddenAvatars.length > 0 ? (
              <Tooltip title={hiddenAvatars.map((member) => member.name).join('、')}>
                <button
                  type="button"
                  className={styles.avatarOverflow}
                  onClick={focusMembersSection}
                  aria-label={`展开其余 ${hiddenAvatars.length} 位成员`}
                >
                  +{hiddenAvatars.length}
                </button>
              </Tooltip>
            ) : null}
          </div>
        </div>
        {onClose ? (
          <Button
            type="text"
            size="small"
            icon={<CloseOutlined />}
            aria-label="关闭"
            onClick={onClose}
          />
        ) : null}
      </header>

      {error ? (
        <Alert
          type="error"
          showIcon
          message={error}
          action={
            <Button size="small" onClick={() => void load()}>
              重试
            </Button>
          }
        />
      ) : null}

      {loading ? (
        <Skeleton active title={{ width: '40%' }} paragraph={{ rows: 10 }} />
      ) : (
        <Tabs
          className={styles.tabs}
          activeKey={resolvedTab}
          onChange={setResolvedTab}
          items={[
            {
              key: 'overview',
              label: '概览',
              children: situationPanel,
            },
            {
              key: 'resources',
              label: '资源',
              children: resourcesPanel,
            },
            {
              key: 'members',
              label: '成员',
              children: membersPanel,
            },
            {
              key: 'connect',
              label: '连接',
              children: connectPanel,
            },
          ]}
        />
      )}
    </aside>
  );
}
