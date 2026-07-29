import { request } from './base';
import type {
  EpisodeListResponse,
  EpisodeView,
} from './generated/projects';

export type { EpisodeListResponse, EpisodeView };

export function listEpisodes(
  params: {
    project_id: number;
    page?: number;
    page_size?: number;
    query?: string;
  },
  init?: RequestInit,
) {
  return request<EpisodeListResponse>('/episodes/list', {
    method: 'POST',
    body: JSON.stringify({
      project_id: params.project_id,
      page: params.page ?? 1,
      page_size: params.page_size ?? 12,
      query: params.query ?? '',
    }),
    ...init,
  });
}

export function createEpisode(projectId: number, name?: string) {
  return request<EpisodeView>('/episodes/create', {
    method: 'POST',
    body: JSON.stringify({ project_id: projectId, ...(name ? { name } : {}) }),
  });
}

export function updateEpisode(
  episodeId: number,
  patch: { name?: string; cover_asset_id?: number | null },
) {
  return request<EpisodeView>('/episodes/update', {
    method: 'POST',
    body: JSON.stringify({ episode_id: episodeId, ...patch }),
  });
}

export function deleteEpisode(episodeId: number) {
  return request<Record<string, never>>('/episodes/delete', {
    method: 'POST',
    body: JSON.stringify({ episode_id: episodeId }),
  });
}
