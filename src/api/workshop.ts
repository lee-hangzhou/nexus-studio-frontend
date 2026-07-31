import { request } from './base';
import type {
  WorkshopArtifactListResponse,
  WorkshopArtifactView,
  WorkshopAuthorizedOperationListResponse,
  WorkshopAuthorizedOperationView,
  WorkshopBeginShopAuthView,
  WorkshopCreateTaskProposalView,
  WorkshopDataSourcesView,
  WorkshopEventListResponse,
  WorkshopEventView,
  WorkshopImportErrorListResponse,
  WorkshopPendingProposalListResponse,
  WorkshopProjectListResponse,
  WorkshopProjectView,
  WorkshopRosterExpertView,
  WorkshopTaskAssignmentListResponse,
  WorkshopTaskListResponse,
  WorkshopTaskView,
  WorkshopToolCapability,
  WorkshopWakeDashboardView,
} from './generated/workshop';
import type {
  ExpertDirectoryEntry,
  WorkshopConnectorEntry,
  WorkshopRoomMemberView,
} from '../features/workshop/utils/expertDirectory';

export type {
  WorkshopArtifactView,
  WorkshopAuthorizedOperationView,
  WorkshopBeginShopAuthView,
  WorkshopCreateTaskProposalView,
  WorkshopDataSourcesView,
  WorkshopEventView,
  WorkshopProjectView,
  WorkshopRosterExpertView,
  WorkshopTaskView,
  WorkshopWakeDashboardView,
};

export interface WorkshopRosterListResponse {
  items: WorkshopRosterExpertView[];
}

export function listWorkshopProjects() {
  return request<WorkshopProjectListResponse>('/workshop/projects/list', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function getWorkshopProjectByChat(groupChatId: number) {
  return request<{ project: WorkshopProjectView | null }>('/workshop/projects/get-by-chat', {
    method: 'POST',
    body: JSON.stringify({ group_chat_id: groupChatId }),
  });
}

export function upgradeWorkshopProject(body: {
  group_chat_id: number;
  project_name: string;
  carried_message_count: number;
  initial_expert_keys?: string[];
  /** @deprecated 升级不再据此创建任务提议 */
  seed_goal?: string;
}) {
  return request<{
    project: WorkshopProjectView;
    group_chat_id: number;
    carried_message_count: number;
    pending_task_proposal?: WorkshopCreateTaskProposalView | null;
  }>('/workshop/projects/upgrade', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function createWorkshopProject(body: {
  name: string;
  group_chat_id: number;
  initial_expert_keys?: string[];
}) {
  return request<WorkshopProjectView>('/workshop/projects/create', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function getWorkshopProject(projectId: string) {
  return request<WorkshopProjectView>('/workshop/projects/get', {
    method: 'POST',
    body: JSON.stringify({ project_id: projectId }),
  });
}

export function wakeWorkshopProject(projectId: string) {
  return request<WorkshopWakeDashboardView>('/workshop/projects/wake', {
    method: 'POST',
    body: JSON.stringify({ project_id: projectId }),
  });
}

export function listWorkshopRoster(projectId: string) {
  return request<WorkshopRosterListResponse>('/workshop/roster/list', {
    method: 'POST',
    body: JSON.stringify({ project_id: projectId }),
  });
}

export function listWorkshopTasks(projectId: string) {
  return request<WorkshopTaskListResponse>('/workshop/tasks/list', {
    method: 'POST',
    body: JSON.stringify({ project_id: projectId }),
  });
}

export function getWorkshopTask(projectId: string, taskId: string) {
  return request<WorkshopTaskView>('/workshop/tasks/get', {
    method: 'POST',
    body: JSON.stringify({ project_id: projectId, task_id: taskId }),
  });
}

export function listWorkshopPendingProposals(projectId: string) {
  return request<WorkshopPendingProposalListResponse>('/workshop/tasks/pending-proposals', {
    method: 'POST',
    body: JSON.stringify({ project_id: projectId }),
  });
}

export function proposeWorkshopTask(body: {
  project_id: string;
  title: string;
  goals: string[];
  required_artifacts?: string[];
}) {
  return request<WorkshopCreateTaskProposalView>('/workshop/tasks/propose', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function confirmWorkshopTask(projectId: string, proposalId: string) {
  return request<WorkshopTaskView>('/workshop/tasks/confirm', {
    method: 'POST',
    body: JSON.stringify({ project_id: projectId, proposal_id: proposalId }),
  });
}

export function declineWorkshopTask(projectId: string, proposalId: string) {
  return request<{ ok: true }>('/workshop/tasks/decline', {
    method: 'POST',
    body: JSON.stringify({ project_id: projectId, proposal_id: proposalId }),
  });
}

export function proposeWorkshopTaskGo(projectId: string, taskId: string) {
  return request<WorkshopTaskView>('/workshop/tasks/propose-go', {
    method: 'POST',
    body: JSON.stringify({ project_id: projectId, task_id: taskId }),
  });
}

export function confirmWorkshopTaskGo(projectId: string, taskId: string) {
  return request<WorkshopTaskView>('/workshop/tasks/confirm-go', {
    method: 'POST',
    body: JSON.stringify({ project_id: projectId, task_id: taskId }),
  });
}

export function beginWorkshopTask(projectId: string, taskId: string) {
  return request<WorkshopTaskView>('/workshop/tasks/begin', {
    method: 'POST',
    body: JSON.stringify({ project_id: projectId, task_id: taskId }),
  });
}

export function blockWorkshopTask(projectId: string, taskId: string) {
  return request<WorkshopTaskView>('/workshop/tasks/block', {
    method: 'POST',
    body: JSON.stringify({ project_id: projectId, task_id: taskId }),
  });
}

export function realignWorkshopTask(projectId: string, taskId: string) {
  return request<WorkshopTaskView>('/workshop/tasks/realign', {
    method: 'POST',
    body: JSON.stringify({ project_id: projectId, task_id: taskId }),
  });
}

export function reviewWorkshopTask(projectId: string, taskId: string) {
  return request<WorkshopTaskView>('/workshop/tasks/review', {
    method: 'POST',
    body: JSON.stringify({ project_id: projectId, task_id: taskId }),
  });
}

export function cancelWorkshopTask(projectId: string, taskId: string) {
  return request<WorkshopTaskView>('/workshop/tasks/cancel', {
    method: 'POST',
    body: JSON.stringify({ project_id: projectId, task_id: taskId }),
  });
}

export function weakAcceptWorkshopTask(
  projectId: string,
  taskId: string,
  body: { covered_goals?: string[]; artifacts?: unknown[] } = {},
) {
  return request<{ passed: boolean; reasons?: string[] }>('/workshop/tasks/weak-accept', {
    method: 'POST',
    body: JSON.stringify({
      project_id: projectId,
      task_id: taskId,
      covered_goals: body.covered_goals ?? [],
      artifacts: body.artifacts ?? [],
    }),
  });
}

export function rejectDoneWorkshopTask(projectId: string, taskId: string) {
  return request<WorkshopTaskView>('/workshop/tasks/reject-done', {
    method: 'POST',
    body: JSON.stringify({ project_id: projectId, task_id: taskId }),
  });
}

export function listWorkshopArtifacts(projectId: string, taskId?: string) {
  return request<WorkshopArtifactListResponse>('/workshop/artifacts/list', {
    method: 'POST',
    body: JSON.stringify({
      project_id: projectId,
      ...(taskId ? { task_id: taskId } : {}),
    }),
  });
}

export function listWorkshopEvents(projectId: string) {
  return request<WorkshopEventListResponse>('/workshop/events/list', {
    method: 'POST',
    body: JSON.stringify({ project_id: projectId }),
  });
}

export function listWorkshopTaskAssignments(projectId: string) {
  return request<WorkshopTaskAssignmentListResponse>('/workshop/tasks/assignments', {
    method: 'POST',
    body: JSON.stringify({ project_id: projectId }),
  });
}

export function listWorkshopAuthorizedOperations(projectId: string) {
  return request<WorkshopAuthorizedOperationListResponse>('/workshop/tasks/authorized-operations', {
    method: 'POST',
    body: JSON.stringify({ project_id: projectId }),
  });
}

export function grantWorkshopExternalAuth(
  projectId: string,
  taskId: string,
  capabilities: WorkshopToolCapability[],
) {
  return request<WorkshopTaskView>('/workshop/tasks/grant-external-auth', {
    method: 'POST',
    body: JSON.stringify({
      project_id: projectId,
      task_id: taskId,
      capabilities,
    }),
  });
}

export function authorizeWorkshopOperation(body: {
  project_id: string;
  task_id: string;
  capability: WorkshopToolCapability;
  operation_kind: string;
  payload_hash: string;
}) {
  return request<WorkshopAuthorizedOperationView>('/workshop/tasks/authorize-operation', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function assignWorkshopTaskExpert(projectId: string, taskId: string, expertId: string) {
  return request<{ ok: true }>('/workshop/roster/assign-task', {
    method: 'POST',
    body: JSON.stringify({
      project_id: projectId,
      task_id: taskId,
      expert_id: expertId,
    }),
  });
}

export function getWorkshopDataSources(projectId: string) {
  return request<WorkshopDataSourcesView>('/workshop/ecommerce/data-sources', {
    method: 'POST',
    body: JSON.stringify({ project_id: projectId }),
  });
}

export function getWorkshopImportErrors(projectId: string) {
  return request<WorkshopImportErrorListResponse>('/workshop/ecommerce/import-errors', {
    method: 'POST',
    body: JSON.stringify({ project_id: projectId }),
  });
}

export function beginWorkshopShopAuth(projectId: string) {
  return request<WorkshopBeginShopAuthView>('/workshop/ecommerce/begin-shop-auth', {
    method: 'POST',
    body: JSON.stringify({ project_id: projectId }),
  });
}

export type {
  ExpertDirectoryEntry,
  WorkshopConnectorEntry,
  WorkshopRoomMemberView,
};

export interface ExpertDirectoryListResponse {
  items: ExpertDirectoryEntry[];
}

export interface WorkshopRoomMemberListResponse {
  items: WorkshopRoomMemberView[];
}

export interface WorkshopConnectorListResponse {
  items: WorkshopConnectorEntry[];
}

export interface ChatSelectedExpertView {
  conversation_id: number;
  expert_key: string | null;
  name?: string | null;
  avatar_id?: string | null;
}

export interface WorkshopUpgradeFromTeamResult {
  project: WorkshopProjectView;
}

function avatarUrl(avatarId: string | null | undefined, key?: string): string {
  const slug = avatarId || (key ? key.replace(/_/g, '-') : 'host');
  return `/avatars/experts/${slug}.${slug.startsWith('team-') ? 'svg' : 'png'}`;
}

function mapDirectoryItem(raw: {
  key: string;
  name: string;
  role_phrase: string;
  tags: string[];
  scenes: string[];
  avatar_id: string;
  kind: 'expert';
  applicable_tasks?: string[];
}): ExpertDirectoryEntry {
  return {
    key: raw.key,
    name: raw.name,
    role_phrase: raw.role_phrase,
    avatar_url: avatarUrl(raw.avatar_id, raw.key),
    tags: raw.tags,
    applicable_tasks: raw.applicable_tasks ?? [],
    scope: 'platform',
    kind: 'expert',
    preset_key: raw.key,
  };
}

export async function listExpertDirectory(_body: {
  scope?: 'platform' | 'mine' | 'all';
} = {}) {
  const res = await request<{ items: Parameters<typeof mapDirectoryItem>[0][] }>(
    '/workshop/expert/directory',
    { method: 'POST', body: JSON.stringify({}) },
  );
  return { items: res.items.map(mapDirectoryItem) } satisfies ExpertDirectoryListResponse;
}

export async function listWorkshopConnectors(body: {
  project_id?: string;
} = {}) {
  const res = await request<{
    items: Array<{
      key: string;
      name: string;
      description: string;
      status: string;
      detail?: string | null;
    }>;
  }>('/workshop/connectors/list', {
    method: 'POST',
    body: JSON.stringify({ project_id: body.project_id ?? null }),
  });
  return {
    items: res.items.map((item) => ({
      key: item.key,
      name: item.name,
      description: item.description,
      scope: 'platform' as const,
      status: item.status as WorkshopConnectorEntry['status'],
    })),
  } satisfies WorkshopConnectorListResponse;
}

export async function listWorkshopRoomMembers(projectId: string) {
  const [res, rosterRes] = await Promise.all([
    request<{ expert_ids: string[] }>('/workshop/roster/room-members', {
      method: 'POST',
      body: JSON.stringify({ project_id: projectId }),
    }),
    listWorkshopRoster(projectId),
  ]);
  const byId = new Map((rosterRes.items ?? []).map((item) => [item.id, item] as const));
  return {
    items: (res.expert_ids ?? []).map((expertId) => {
      const expert = byId.get(expertId);
      const avatarId =
        (expert as { avatar_id?: string | null } | undefined)?.avatar_id ??
        expert?.preset_key ??
        null;
      return {
        expert_id: expertId,
        name:
          (expert as { display_name?: string | null } | undefined)?.display_name ??
          expert?.name ??
          expertId,
        avatar_url: avatarUrl(avatarId ?? undefined, expert?.preset_key ?? undefined),
        status: 'idle' as const,
      };
    }),
  } satisfies WorkshopRoomMemberListResponse;
}

export function inviteWorkshopExpert(projectId: string, expertId: string) {
  return request<{ ok: true }>('/workshop/roster/invite', {
    method: 'POST',
    body: JSON.stringify({ project_id: projectId, expert_id: expertId }),
  });
}

export function removeWorkshopExpert(projectId: string, expertId: string) {
  return request<{ ok: true }>('/workshop/roster/remove', {
    method: 'POST',
    body: JSON.stringify({ project_id: projectId, expert_id: expertId }),
  });
}

export function unassignWorkshopTaskExpert(
  projectId: string,
  taskId: string,
  expertId: string,
) {
  return request<{ ok: true }>('/workshop/roster/unassign-task', {
    method: 'POST',
    body: JSON.stringify({
      project_id: projectId,
      task_id: taskId,
      expert_id: expertId,
    }),
  });
}

export function getChatSelectedExpert(conversationId: number) {
  return request<ChatSelectedExpertView>('/chat/conversation/selected-expert/get', {
    method: 'POST',
    body: JSON.stringify({ conversation_id: conversationId }),
  });
}

export function setChatSelectedExpert(conversationId: number, expertKey: string) {
  return request<ChatSelectedExpertView>('/chat/conversation/selected-expert/set', {
    method: 'POST',
    body: JSON.stringify({ conversation_id: conversationId, expert_key: expertKey }),
  });
}

export function clearChatSelectedExpert(conversationId: number) {
  return request<ChatSelectedExpertView>('/chat/conversation/selected-expert/clear', {
    method: 'POST',
    body: JSON.stringify({ conversation_id: conversationId }),
  });
}

export function upgradeWorkshopFromExpert(body: {
  conversation_id: number;
  expert_key: string;
  project_name: string;
  carried_message_count: number;
  /** @deprecated 升级不再据此创建任务提议 */
  seed_goal?: string;
}) {
  return request<WorkshopUpgradeFromTeamResult>('/workshop/upgrade/from-expert', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function copyWorkshopPreset(projectId: string, presetKey: string, name: string) {
  return request<WorkshopRosterExpertView>('/workshop/roster/copy-preset', {
    method: 'POST',
    body: JSON.stringify({
      project_id: projectId,
      preset_key: presetKey,
      name,
    }),
  });
}

export function addWorkshopPreset(projectId: string, presetKey: string) {
  return request<WorkshopRosterExpertView>('/workshop/roster/add-preset', {
    method: 'POST',
    body: JSON.stringify({
      project_id: projectId,
      preset_key: presetKey,
    }),
  });
}
