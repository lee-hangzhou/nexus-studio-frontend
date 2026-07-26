import { apiUrl, fetchWithAuth, request, type ApiResponse } from './base';
import type { AssetBase, AssetKind, AssetSource } from '../domains/asset/types';

interface AssetListItem {
  id: number;
  filename: string;
  mime_type: string;
  asset_type: string;
  source_type: string;
  metadata: Record<string, unknown>;
  status: string;
  favorite: boolean;
  preview_url: string;
  created_at: string;
}

interface AssetListResponse {
  items: AssetListItem[];
  page: number;
  page_size: number;
  total: number;
}

export interface ListAssetsParams {
  page?: number;
  page_size?: number;
  query?: string;
  asset_type?: string;
  source_type?: string;
  favorites_only?: boolean;
  created_from?: string | null;
  created_to?: string | null;
}

const SOURCE_MAP: Record<string, AssetSource> = {
  generate_result: 'generate',
  canvas_node_output: 'canvas',
  chat_upload: 'chat',
  manual_upload: 'import',
};

function toAssetKind(assetType: string): AssetKind {
  return assetType === 'video' || assetType === 'text' ? assetType : 'image';
}

function titleOf(item: AssetListItem) {
  if (item.filename?.trim()) {
    return item.filename.trim();
  }
  const prompt = item.metadata.prompt;
  if (typeof prompt === 'string' && prompt.trim()) {
    return prompt.trim();
  }
  return item.filename || `资产 ${item.id}`;
}

function toAsset(item: AssetListItem): AssetBase {
  return {
    id: String(item.id),
    kind: toAssetKind(item.asset_type),
    title: titleOf(item),
    filename: item.filename,
    mimeType: item.mime_type,
    metadata: item.metadata,
    status: item.status,
    createdAt: item.created_at,
    source: SOURCE_MAP[item.source_type] ?? 'import',
    previewUrl: item.preview_url,
    favorite: item.favorite,
  };
}

export async function listAssets(
  params: ListAssetsParams = {},
  init?: RequestInit,
): Promise<{
  items: AssetBase[];
  total: number;
}> {
  const res = await request<AssetListResponse>('/assets/list', {
    method: 'POST',
    body: JSON.stringify({
      page: params.page ?? 1,
      page_size: params.page_size ?? 40,
      query: params.query ?? '',
      asset_type: params.asset_type ?? 'all',
      source_type: params.source_type ?? 'all',
      favorites_only: params.favorites_only ?? false,
      created_from: params.created_from ?? null,
      created_to: params.created_to ?? null,
    }),
    ...init,
  });

  return {
    total: res.total,
    items: res.items.map(toAsset),
  };
}

export async function getAsset(assetId: string): Promise<AssetBase> {
  const item = await request<AssetListItem>('/assets/get', {
    method: 'POST',
    body: JSON.stringify({ asset_id: Number(assetId) }),
  });
  return toAsset(item);
}

export async function uploadAsset(file: File): Promise<AssetBase> {
  const body = new FormData();
  body.append('file', file);
  const response = await fetchWithAuth(apiUrl('/assets/upload'), {
    method: 'POST',
    body,
  });
  const payload = (await response.json().catch(() => null)) as ApiResponse<AssetListItem> | null;
  if (!response.ok || payload === null || payload.code !== 0 || !payload.data) {
    throw new Error(payload?.msg ?? `上传失败: ${response.status}`);
  }
  return toAsset(payload.data);
}

export async function updateAssetFavorite(assetId: string, favorite: boolean): Promise<AssetBase> {
  const item = await request<AssetListItem>('/assets/update', {
    method: 'POST',
    body: JSON.stringify({ asset_id: Number(assetId), favorite }),
  });
  return toAsset(item);
}

export async function renameAsset(assetId: string, filename: string): Promise<AssetBase> {
  const item = await request<AssetListItem>('/assets/update', {
    method: 'POST',
    body: JSON.stringify({ asset_id: Number(assetId), filename }),
  });
  return toAsset(item);
}

export async function deleteAssets(assetIds: string[]): Promise<{ deleted: number }> {
  return request<{ deleted: number }>('/assets/delete', {
    method: 'POST',
    body: JSON.stringify({ asset_ids: assetIds.map(Number) }),
  });
}
