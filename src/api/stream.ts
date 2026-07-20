import { apiUrl, fetchWithAuth } from './base';
import type { StreamFrame } from './chat';

export type StreamHandlers = {
  onFrame: (frame: StreamFrame & Record<string, unknown>) => void;
  onHttpError?: (status: number) => void;
};

export async function consumeSSE(
  path: string,
  body: unknown,
  handlers: StreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetchWithAuth(apiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() ?? '';
    for (const event of events) {
      for (const line of event.split('\n')) {
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (!data) continue;
        try {
          handlers.onFrame(JSON.parse(data) as StreamFrame & Record<string, unknown>);
        } catch {
          /* skip malformed */
        }
      }
    }
  }
}
