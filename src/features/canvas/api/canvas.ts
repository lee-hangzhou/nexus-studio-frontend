import { apiUrl, fetchWithAuth, request } from '../../../api/base';
import { consumeSSE } from '../../../api/stream';
import { CanvasApiError } from './canvasErrors';
import type {
  CanvasMessageRecord,
  CanvasNodeGenerateResponse,
  CanvasPatchRequest,
  CanvasPatchResult,
  CanvasResumeBody,
  CanvasSnapshot,
  CanvasStreamFrame,
  CanvasTurnBody,
  NodeGenerateBody,
} from './canvasTypes';

export async function getCanvasSnapshot(projectId: number): Promise<CanvasSnapshot> {
  return request<CanvasSnapshot>(`/canvas/${projectId}`, { method: 'GET' });
}

export async function patchCanvas(projectId: number, body: CanvasPatchRequest): Promise<CanvasPatchResult> {
  return request<CanvasPatchResult>(`/canvas/${projectId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function listCanvasMessages(
  projectId: number,
  body: { limit?: number; before_id?: number } = {},
): Promise<CanvasMessageRecord[]> {
  return request<CanvasMessageRecord[]>(`/canvas/${projectId}/messages/list`, {
    method: 'POST',
    body: JSON.stringify({ limit: body.limit ?? 50, before_id: body.before_id }),
  });
}

export async function cancelCanvasTurn(projectId: number): Promise<{ cancelled: boolean; active_turn_id?: string }> {
  return request(`/canvas/${projectId}/turn/cancel`, { method: 'POST', body: JSON.stringify({}) });
}

export async function streamCanvasTurn(
  projectId: number,
  body: CanvasTurnBody,
  onFrame: (frame: CanvasStreamFrame) => void,
  signal?: AbortSignal,
): Promise<void> {
  await consumeSSE(
    `/canvas/${projectId}/turn`,
    {
      request_id: body.request_id,
      content: body.content,
      model_key: body.model_key,
      client_turn_id: body.client_turn_id,
      mode: body.mode ?? 'auto',
      enable_tools: body.enable_tools ?? true,
    },
    {
      onFrame: (f) => onFrame(f as CanvasStreamFrame),
      onHttpError: (status) => {
        if (status === 409) throw new Error('canvas_project_busy');
      },
    },
    signal,
  );
}

export async function resumeCanvasTurn(
  projectId: number,
  body: CanvasResumeBody,
  onFrame: (frame: CanvasStreamFrame) => void,
  signal?: AbortSignal,
): Promise<void> {
  await consumeSSE(
    `/canvas/${projectId}/turn/resume`,
    {
      request_id: body.request_id,
      tool_call_id: body.tool_call_id,
      action: body.action,
      client_turn_id: body.client_turn_id,
      model_key: body.model_key,
    },
    {
      onFrame: (f) => onFrame(f as CanvasStreamFrame),
    },
    signal,
  );
}

export async function submitCanvasNodeGenerate(
  projectId: number,
  nodeId: string,
  body: NodeGenerateBody,
  signal?: AbortSignal,
): Promise<CanvasNodeGenerateResponse> {
  const response = await fetchWithAuth(
    apiUrl(`/canvas/${projectId}/nodes/${nodeId}/generate`),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    },
  );
  const payload = (await response.json().catch(() => null)) as {
    code: number;
    data: CanvasNodeGenerateResponse | Record<string, unknown> | null;
    msg: string;
  } | null;

  if (!response.ok || payload === null || payload.code !== 0) {
    throw new CanvasApiError(
      payload?.msg ?? `请求失败: ${response.status}`,
      payload?.code ?? response.status,
      payload?.data && typeof payload.data === 'object' ? (payload.data as Record<string, unknown>) : null,
    );
  }
  return payload.data as CanvasNodeGenerateResponse;
}
