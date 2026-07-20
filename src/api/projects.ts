import { request } from './base';

export interface ProjectView {
  id: number;
  name: string;
  status: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectListResponse {
  items: ProjectView[];
  page: number;
  page_size: number;
  total: number;
}

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
  return request<ProjectView>('/projects/create', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export function getProject(projectId: number) {
  return request<ProjectView>('/projects/get', {
    method: 'POST',
    body: JSON.stringify({ project_id: projectId }),
  });
}
