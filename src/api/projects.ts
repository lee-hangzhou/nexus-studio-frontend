import { request } from './base';
import type {
  CoverView,
  EpisodeView,
  ProjectCreateResponse,
  ProjectDetailResponse,
  ProjectListResponse,
  ProjectView,
} from './generated/projects';

export type {
  CoverView,
  EpisodeView,
  ProjectCreateResponse,
  ProjectDetailResponse,
  ProjectListResponse,
  ProjectView,
};

export function listProjects(params: { page?: number; page_size?: number; query?: string } = {}) {
  return request<ProjectListResponse>('/projects/list', {
    method: 'POST',
    body: JSON.stringify({
      page: params.page ?? 1,
      page_size: params.page_size ?? 11,
      query: params.query ?? '',
    }),
  });
}

export function createProject(name: string) {
  return request<ProjectCreateResponse>('/projects/create', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export function getProject(projectId: number, init?: RequestInit) {
  return request<ProjectDetailResponse>('/projects/get', {
    method: 'POST',
    body: JSON.stringify({ project_id: projectId }),
    ...init,
  });
}

export function updateProject(
  projectId: number,
  patch: { name?: string; cover_asset_id?: number | null },
) {
  return request<ProjectView>('/projects/update', {
    method: 'POST',
    body: JSON.stringify({ project_id: projectId, ...patch }),
  });
}
