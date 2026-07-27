import { apiUrl, fetchWithAuth } from './base';
import type { StreamFrame } from './chat';

export type StreamHandlers = {
  onFrame: (frame: StreamFrame & Record<string, unknown>) => void;
  onHttpError?: (status: number) => void;
  /** HTTP 流已建立 (200 + body), 在读帧之前回调 */
  onOpen?: () => void;
  /** SSE id: 行更新后回调, 供 Last-Event-ID 续传 */
  onEventId?: (eventId: string) => void;
};

export type ConsumeSSEOptions = {
  /** 断点续传游标, 写入 Last-Event-ID */
  lastEventId?: string | null;
};

export type ConsumeSSEResult = {
  lastEventId: string | null;
};

/** POST Fetch SSE: 解析 data:/id:, 支持 Last-Event-ID 续传 */
export async function consumeSSE(
  path: string,
  body: unknown,
  handlers: StreamHandlers,
  signal?: AbortSignal,
  options?: ConsumeSSEOptions,
): Promise<ConsumeSSEResult> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options?.lastEventId) {
    headers['Last-Event-ID'] = options.lastEventId;
  }

  const response = await fetchWithAuth(apiUrl(path), {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal,
  });
  if (response.status === 409) {
    handlers.onHttpError?.(409);
    throw new Error('http_409');
  }
  if (!response.ok || !response.body) {
    handlers.onHttpError?.(response.status);
    throw new Error(`stream failed: ${response.status}`);
  }

  handlers.onOpen?.();

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let lastEventId = options?.lastEventId ?? null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() ?? '';
    for (const event of events) {
      let eventId: string | null = null;
      let data: string | null = null;
      for (const line of event.split('\n')) {
        if (line.startsWith('id:')) {
          eventId = line.slice(3).trim();
        } else if (line.startsWith('data:')) {
          data = line.slice(5).trim();
        }
      }
      if (!data) continue;
      try {
        handlers.onFrame(JSON.parse(data) as StreamFrame & Record<string, unknown>);
        if (eventId) {
          lastEventId = eventId;
          handlers.onEventId?.(eventId);
        }
      } catch {
        /* skip malformed */
      }
    }
  }

  return { lastEventId };
}
