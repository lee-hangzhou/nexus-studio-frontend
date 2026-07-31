import type {
  ExpertDirectoryEntry,
  WorkshopRoomMemberView,
} from './expertDirectory';

export type RosterExpertRef = {
  id: string;
  name: string;
  preset_key?: string | null;
  avatar_url?: string | null;
};

/** @ /「发给」可选专家：仅当前房间成员（不含项目助手） */
export function buildRoomRecipientExperts(input: {
  roomMembers: WorkshopRoomMemberView[];
  roster?: RosterExpertRef[];
}): ExpertDirectoryEntry[] {
  const rosterById = new Map((input.roster ?? []).map((item) => [item.id, item]));
  return input.roomMembers.map((member) => {
    const roster = rosterById.get(member.expert_id);
    const key = member.preset_key ?? roster?.preset_key ?? member.expert_id;
    return {
      key,
      name: member.name,
      role_phrase: '',
      avatar_url: member.avatar_url || roster?.avatar_url || '/avatars/experts/host.png',
      tags: [],
      applicable_tasks: [],
      scope: 'platform' as const,
      kind: 'expert' as const,
      preset_key: member.preset_key ?? roster?.preset_key ?? undefined,
    };
  });
}

/** 可邀请专家 = 目录 − 已在房间（按 preset_key / key 去重） */
export function buildInviteCandidates(input: {
  directory: ExpertDirectoryEntry[];
  roomMembers: WorkshopRoomMemberView[];
  roster?: RosterExpertRef[];
}): ExpertDirectoryEntry[] {
  const roomKeys = new Set<string>();
  const rosterById = new Map((input.roster ?? []).map((item) => [item.id, item]));
  for (const member of input.roomMembers) {
    roomKeys.add(member.expert_id);
    const preset = member.preset_key ?? rosterById.get(member.expert_id)?.preset_key;
    if (preset) roomKeys.add(preset);
  }
  return input.directory.filter((entry) => {
    if (entry.key === 'host') return false;
    if (roomKeys.has(entry.key)) return false;
    if (entry.preset_key && roomKeys.has(entry.preset_key)) return false;
    return true;
  });
}

/** 仅当选中专家已在房间时解析 turn_target.expert_id；否则 null（走 Host） */
export function resolveRoomTurnTargetExpertId(input: {
  selectedKey: string | null | undefined;
  roomMembers: WorkshopRoomMemberView[];
  roster: RosterExpertRef[];
}): string | null {
  const key = input.selectedKey?.trim();
  if (!key || key === 'host') return null;
  const rosterExpert =
    input.roster.find((item) => item.preset_key === key) ??
    input.roster.find((item) => item.id === key);
  if (!rosterExpert) return null;
  const inRoom = input.roomMembers.some((member) => member.expert_id === rosterExpert.id);
  return inRoom ? rosterExpert.id : null;
}
