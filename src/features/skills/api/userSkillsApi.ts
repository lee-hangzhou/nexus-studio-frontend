import { apiUrl, fetchWithAuth } from '../../../api/base';
import type {
  DualTreeView,
  SkillFileDetail,
  SkillScope,
  SkillSurface,
} from '../types';

/** 与 app/exceptions/codes.py ErrorCode 对齐 */
export const USER_SKILLS_API_CODE = {
  REVISION_CONFLICT: 40912,
} as const;

export class UserSkillsApiError extends Error {
  readonly code: number;

  constructor(message: string, code: number) {
    super(message);
    this.name = 'UserSkillsApiError';
    this.code = code;
  }
}

export function isUserSkillsApiError(err: unknown): err is UserSkillsApiError {
  return err instanceof UserSkillsApiError;
}

type ApiPayload<T> = {
  code: number;
  data: T;
  msg: string;
};

async function postUserSkills<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetchWithAuth(apiUrl(`/user-skills/${path}`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => null)) as ApiPayload<T> | null;
  if (!response.ok || payload === null || payload.code !== 0) {
    throw new UserSkillsApiError(payload?.msg ?? `请求失败: ${response.status}`, payload?.code ?? response.status);
  }
  return payload.data;
}

type SurfaceBody = {
  surface: SkillSurface;
  project_id?: number;
};

export function listUserSkills(body: SurfaceBody & { scope?: SkillScope; enabled?: boolean }) {
  return postUserSkills<DualTreeView>('list', body);
}

export function getUserSkill(
  body: SurfaceBody & {
    scope: SkillScope;
    path: string;
  },
) {
  return postUserSkills<SkillFileDetail>('get', body);
}

export function mkdirUserSkill(
  body: SurfaceBody & {
    scope: SkillScope;
    path: string;
  },
) {
  return postUserSkills<DualTreeView>('mkdir', body);
}

export function writeUserSkill(
  body: SurfaceBody & {
    scope: SkillScope;
    path: string;
    name: string;
    description?: string | null;
    content?: string;
    revision?: number | null;
    id?: number | null;
  },
) {
  return postUserSkills<DualTreeView>('write', body);
}

export function removeUserSkill(
  body: SurfaceBody & {
    scope: SkillScope;
    path: string;
    revision: number;
  },
) {
  return postUserSkills<DualTreeView>('remove', body);
}

export function setUserSkillEnabled(
  body: SurfaceBody & {
    scope: SkillScope;
    path: string;
    enabled: boolean;
    revision: number;
  },
) {
  return postUserSkills<DualTreeView>('set-enabled', body);
}
