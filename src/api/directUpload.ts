import { request } from './base';
import type {
  AssetUploadUrlResponse,
  AssetViewResponse,
  SourceType2,
} from './generated/assets';

export type DirectUploadSourceType = SourceType2;

export interface DirectUploadParams {
  file: File;
  sourceType: DirectUploadSourceType;
  projectId?: number;
  episodeId?: number;
  signal?: AbortSignal;
}

async function requestUploadUrl(params: DirectUploadParams): Promise<AssetUploadUrlResponse> {
  return request<AssetUploadUrlResponse>('/assets/upload-url', {
    method: 'POST',
    body: JSON.stringify({
      filename: params.file.name,
      source_type: params.sourceType,
      project_id: params.projectId ?? null,
      episode_id: params.episodeId ?? null,
    }),
    signal: params.signal,
  });
}

async function putToTos(
  uploadUrl: string,
  file: File,
  contentType: string,
  signal?: AbortSignal,
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      signal,
      headers: { 'Content-Type': contentType },
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw err;
    }
    throw new Error(err instanceof Error ? err.message : '直传 TOS 网络失败');
  }
  if (!response.ok) {
    throw new Error(`直传 TOS 失败: ${response.status}`);
  }
}

async function registerUploaded(
  params: DirectUploadParams,
  storageKey: string,
  contentType: string,
): Promise<AssetViewResponse> {
  return request<AssetViewResponse>('/assets/register', {
    method: 'POST',
    body: JSON.stringify({
      storage_key: storageKey,
      filename: params.file.name,
      mime_type: contentType,
      source_type: params.sourceType,
      project_id: params.projectId ?? null,
      episode_id: params.episodeId ?? null,
      size_bytes: params.file.size,
    }),
    signal: params.signal,
  });
}

/** 拿签名 URL，PUT TOS，再登记资产 */
export async function directUploadAsset(params: DirectUploadParams): Promise<AssetViewResponse> {
  if (!params.file.size) {
    throw new Error('文件为空');
  }
  const contentType = params.file.type;
  if (!contentType) {
    throw new Error('文件缺少 Content-Type');
  }
  const minted = await requestUploadUrl(params);
  if (minted.method !== 'PUT' || !minted.upload_url || !minted.storage_key) {
    throw new Error('上传签名响应不完整');
  }
  await putToTos(minted.upload_url, params.file, contentType, params.signal);
  return registerUploaded(params, minted.storage_key, contentType);
}
