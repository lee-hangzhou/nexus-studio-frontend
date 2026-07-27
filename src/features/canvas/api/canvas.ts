import { apiUrl, fetchWithAuth, request } from '../../../api/base';
import { consumeSSE } from '../../../api/stream';
import { CanvasApiError } from './canvasErrors';
import type {
  CanvasMessageRecord,
  CanvasNodeGenerateResponse,
  CanvasPatchRequest,
  CanvasPatchResult,
  CanvasResumeBody,
  CanvasSessionView,
  CanvasSnapshot,
  CanvasStreamFrame,
  CanvasTurnBody,
  NodeGenerateBody,
} from './canvasTypes';

export async function getCanvasSnapshot(episodeId: number): Promise<CanvasSnapshot> {
  return request<CanvasSnapshot>(`/canvas/episodes/${episodeId}/get`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function patchCanvas(episodeId: number, body: CanvasPatchRequest): Promise<CanvasPatchResult> {
  const response = await fetchWithAuth(apiUrl(`/canvas/episodes/${episodeId}/patch`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => null)) as {
    code: number;
    data: CanvasPatchResult | Record<string, unknown> | null;
    msg: string;
  } | null;

  if (!response.ok || payload === null || payload.code !== 0) {
    throw new CanvasApiError(
      payload?.msg ?? `请求失败: ${response.status}`,
      payload?.code ?? response.status,
      payload?.data && typeof payload.data === 'object' ? (payload.data as Record<string, unknown>) : null,
    );
  }
  return payload.data as CanvasPatchResult;
}

export async function listCanvasSessions(episodeId: number): Promise<CanvasSessionView[]> {
  return request<CanvasSessionView[]>(`/canvas/episodes/${episodeId}/sessions/list`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function ensureCanvasDefaultSession(episodeId: number): Promise<CanvasSessionView> {
  return request<CanvasSessionView>(`/canvas/episodes/${episodeId}/sessions/ensure`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function createCanvasSession(
  episodeId: number,
  body: { title?: string } = {},
): Promise<CanvasSessionView> {
  return request<CanvasSessionView>(`/canvas/episodes/${episodeId}/sessions/create`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function updateCanvasSession(
  episodeId: number,
  body: { session_id: number; title: string },
): Promise<CanvasSessionView> {
  return request<CanvasSessionView>(`/canvas/episodes/${episodeId}/sessions/update`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function deleteCanvasSession(
  episodeId: number,
  sessionId: number,
): Promise<{ deleted: boolean }> {
  return request(`/canvas/episodes/${episodeId}/sessions/delete`, {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId }),
  });
}

export async function listCanvasMessages(
  episodeId: number,
  body: { session_id: number; limit?: number; before_id?: number },
  signal?: AbortSignal,
): Promise<CanvasMessageRecord[]> {
  return request<CanvasMessageRecord[]>(`/canvas/episodes/${episodeId}/messages/list`, {
    method: 'POST',
    body: JSON.stringify({
      session_id: body.session_id,
      limit: body.limit ?? 50,
      before_id: body.before_id,
    }),
    signal,
  });
}

export async function cancelCanvasTurn(
  episodeId: number,
  sessionId: number,
): Promise<{ cancelled: boolean; active_turn_id?: string }> {
  return request(`/canvas/episodes/${episodeId}/turn/cancel`, {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId }),
  });
}

export type CanvasTurnStreamHooks = {
  signal?: AbortSignal;
  lastEventId?: string | null;
  onEventId?: (eventId: string) => void;
};

function isTurnTerminalFrame(frame: CanvasStreamFrame): boolean {
  return frame.type === 'done' || frame.type === 'cancelled' || frame.type === 'error';
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = window.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      window.clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/** 非终态断流后按 Last-Event-ID 走 reconnect 续传 */
async function consumeTurnWithReplay(
  episodeId: number,
  sessionId: number,
  requestId: string,
  onFrame: (frame: CanvasStreamFrame) => void,
  firstOpen: (hooks: CanvasTurnStreamHooks & {
    onFrame: (frame: CanvasStreamFrame) => void;
  }) => Promise<void>,
  hooks: CanvasTurnStreamHooks = {},
): Promise<void> {
  let lastEventId = hooks.lastEventId ?? null;
  let terminal = false;
  let opened = false;

  const trackFrame = (frame: CanvasStreamFrame) => {
    if (isTurnTerminalFrame(frame)) terminal = true;
    onFrame(frame);
  };

  const trackId = (eventId: string) => {
    lastEventId = eventId;
    hooks.onEventId?.(eventId);
  };

  while (true) {
    if (hooks.signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    const isReconnect = opened;
    let madeProgress = false;
    const onFrameTracked = (frame: CanvasStreamFrame) => {
      madeProgress = true;
      trackFrame(frame);
    };
    const onIdTracked = (eventId: string) => {
      madeProgress = true;
      trackId(eventId);
    };
    try {
      if (!opened) {
        await firstOpen({
          signal: hooks.signal,
          lastEventId,
          onEventId: onIdTracked,
          onFrame: onFrameTracked,
        });
        opened = true;
      } else {
        await reconnectCanvasTurn(
          episodeId,
          { session_id: sessionId, request_id: requestId },
          onFrameTracked,
          {
            signal: hooks.signal,
            lastEventId,
            onEventId: onIdTracked,
          },
        );
      }
      if (terminal || hooks.signal?.aborted) return;
      // 续传无增量: 游标已到末尾或流已关闭, 停止空转
      if (isReconnect && !madeProgress) return;
      await sleep(600, hooks.signal);
    } catch (err) {
      if (hooks.signal?.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
        throw err;
      }
      if (err instanceof Error && err.message === 'canvas_session_busy') {
        throw err;
      }
      if (lastEventId != null) opened = true;
      if (!opened) throw err;
      if (terminal) return;
      await sleep(800, hooks.signal);
    }
  }
}

export async function streamCanvasEpisodeEvents(
  episodeId: number,
  onFrame: (frame: CanvasStreamFrame) => void,
  signal?: AbortSignal,
): Promise<void> {
  await consumeSSE(
    `/canvas/episodes/${episodeId}/events`,
    {},
    {
      onFrame: (f) => onFrame(f as CanvasStreamFrame),
    },
    signal,
  );
}

export async function reconnectCanvasTurn(
  episodeId: number,
  body: { session_id: number; request_id: string },
  onFrame: (frame: CanvasStreamFrame) => void,
  hooks: CanvasTurnStreamHooks = {},
): Promise<void> {
  await consumeSSE(
    `/canvas/episodes/${episodeId}/turn/reconnect`,
    {
      session_id: body.session_id,
      request_id: body.request_id,
    },
    {
      onFrame: (f) => onFrame(f as CanvasStreamFrame),
      onEventId: hooks.onEventId,
      onHttpError: (status) => {
        if (status === 409) throw new Error('canvas_session_busy');
      },
    },
    hooks.signal,
    { lastEventId: hooks.lastEventId },
  );
}

/** 切回会话或断线后: 仅 reconnect, 仍按 cursor 自动续传 */
export async function reconnectCanvasTurnWithReplay(
  episodeId: number,
  body: { session_id: number; request_id: string },
  onFrame: (frame: CanvasStreamFrame) => void,
  hooks: CanvasTurnStreamHooks = {},
): Promise<void> {
  await consumeTurnWithReplay(
    episodeId,
    body.session_id,
    body.request_id,
    onFrame,
    async (openHooks) => {
      await reconnectCanvasTurn(episodeId, body, openHooks.onFrame, openHooks);
    },
    hooks,
  );
}

export async function streamCanvasTurn(
  episodeId: number,
  body: CanvasTurnBody,
  onFrame: (frame: CanvasStreamFrame) => void,
  hooks: CanvasTurnStreamHooks = {},
): Promise<void> {
  await consumeTurnWithReplay(
    episodeId,
    body.session_id,
    body.request_id,
    onFrame,
    async (openHooks) => {
      await consumeSSE(
        `/canvas/episodes/${episodeId}/turn`,
        {
          session_id: body.session_id,
          request_id: body.request_id,
          content: body.content,
          model_key: body.model_key,
          client_turn_id: body.client_turn_id,
          mode: body.mode ?? 'auto',
          enable_tools: body.enable_tools ?? true,
        },
        {
          onFrame: (f) => openHooks.onFrame(f as CanvasStreamFrame),
          onEventId: openHooks.onEventId,
          onHttpError: (status) => {
            if (status === 409) throw new Error('canvas_session_busy');
          },
        },
        openHooks.signal,
        { lastEventId: openHooks.lastEventId },
      );
    },
    hooks,
  );
}

export async function resumeCanvasTurn(
  episodeId: number,
  body: CanvasResumeBody,
  onFrame: (frame: CanvasStreamFrame) => void,
  hooks: CanvasTurnStreamHooks = {},
): Promise<void> {
  await consumeTurnWithReplay(
    episodeId,
    body.session_id,
    body.request_id,
    onFrame,
    async (openHooks) => {
      await consumeSSE(
        `/canvas/episodes/${episodeId}/turn/resume`,
        {
          session_id: body.session_id,
          request_id: body.request_id,
          tool_call_id: body.tool_call_id,
          action: body.action,
          client_turn_id: body.client_turn_id,
          model_key: body.model_key,
        },
        {
          onFrame: (f) => openHooks.onFrame(f as CanvasStreamFrame),
          onEventId: openHooks.onEventId,
          onHttpError: (status) => {
            if (status === 409) throw new Error('canvas_session_busy');
          },
        },
        openHooks.signal,
        { lastEventId: openHooks.lastEventId },
      );
    },
    hooks,
  );
}

export async function submitCanvasNodeGenerate(
  episodeId: number,
  nodeId: string,
  body: NodeGenerateBody,
  signal?: AbortSignal,
): Promise<CanvasNodeGenerateResponse> {
  const response = await fetchWithAuth(
    apiUrl(`/canvas/episodes/${episodeId}/nodes/${nodeId}/generate`),
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
