import { request } from './base';
import type { EpisodeView } from './generated/projects';

export type { EpisodeView };

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
