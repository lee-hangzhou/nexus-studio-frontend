import { apiOriginUrl, apiUrl, fetchWithAuth, getAccessToken, request } from './base';
import type { Stream as GeneratedStreamFrame } from './generated/stream';

export type StreamFrame = GeneratedStreamFrame;
export type StreamFrameType = StreamFrame['type'];
export type ToolEndFrameData = Extract<StreamFrame, { type: 'tool_end' }>['data'];

export interface ChatModelItem {
  key: string;
  display_name: string;
  family: string;
  supports_vision: boolean;
}

export interface ConversationView {
  id: number;
  title: string;
  default_model: string;
  status: number;
  is_generating?: boolean;
  awaiting_user_gate?: boolean;
  generating_started_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMessageView {
  id: number;
  role: string;
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface MessageListResponse {
  items: ChatMessageView[];
  has_more: boolean;
  next_before_id: number | null;
}

export interface ListMessagesOptions {
  turnLimit?: number;
  beforeId?: number;
}

export interface ToolStepView {
  call_id: string;
  name: string;
  args: Record<string, unknown>;
  result_preview: string;
}

export interface UploadedAttachment {
  attachment_id: number;
  filename: string;
  mime_type: string;
  preview_url?: string;
  source?: string;
}

export interface MessageAttachment {
  attachment_id: number;
  filename: string;
  mime_type: string;
  preview_url?: string;
}

export function listChatModels() {
  return request<ChatModelItem[]>('/chat/model/list', { method: 'POST', body: JSON.stringify({}) });
}

export function createConversation(body: { title?: string; model?: string }) {
  return request<ConversationView>('/chat/conversation/create', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function listConversations(body: { offset?: number; limit?: number } = {}) {
  return request<{ items: ConversationView[]; total: number }>('/chat/conversation/list', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function getConversation(conversationId: number) {
  return request<ConversationView>('/chat/conversation/get', {
    method: 'POST',
    body: JSON.stringify({ conversation_id: conversationId }),
  });
}

export function updateConversation(body: {
  conversation_id: number;
  title?: string;
  model?: string;
}) {
  return request<ConversationView>('/chat/conversation/update', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function deleteConversation(conversationId: number) {
  return request<{ ok: boolean }>('/chat/conversation/delete', {
    method: 'POST',
    body: JSON.stringify({ conversation_id: conversationId }),
  });
}

export function listMessages(conversationId: number, options: ListMessagesOptions = {}) {
  const turnLimit = options.turnLimit ?? 50;
  return request<MessageListResponse>('/chat/message/list', {
    method: 'POST',
    body: JSON.stringify({
      conversation_id: conversationId,
      limit: turnLimit,
      ...(options.beforeId != null ? { before_id: options.beforeId } : {}),
    }),
  });
}

export function cancelTurn(conversationId: number) {
  return request<{ ok: boolean; cancelled_turn_id?: string }>('/chat/turn/cancel', {
    method: 'POST',
    body: JSON.stringify({ conversation_id: conversationId }),
  });
}

export type GateFieldDef = {
  name?: string;
  key?: string;
  label?: string;
  secret?: boolean;
};

export type UserGateRequiredFrame = Extract<StreamFrame, { type: 'user_gate_required' }>;

function appendChatAssetAuth(url: string, conversationId?: number): string {
  let resolved = url;
  const params = new URLSearchParams();
  if (conversationId != null && !resolved.includes('conversation_id=')) {
    params.set('conversation_id', String(conversationId));
  }
  const token = getAccessToken();
  if (token) {
    params.set('token', token);
  }
  const query = params.toString();
  if (query) {
    resolved = `${resolved}${resolved.includes('?') ? '&' : '?'}${query}`;
  }
  return resolved;
}

export function resolveChatAssetUrl(url: string, conversationId?: number): string {
  if (/^https?:\/\//i.test(url) || url.startsWith('//')) return url;
  return appendChatAssetAuth(apiOriginUrl(url), conversationId);
}

export function getGateAssetUrl(conversationId: number, gateId: string) {
  return appendChatAssetAuth(
    apiUrl(`/chat/gate/asset?conversation_id=${conversationId}&gate_id=${encodeURIComponent(gateId)}`),
    conversationId,
  );
}

export function getGateState(conversationId: number) {
  return request<{ pending: GatePendingView | null }>('/chat/gate/state', {
    method: 'POST',
    body: JSON.stringify({ conversation_id: conversationId }),
  });
}

export interface GatePendingView {
  turn_id: string;
  gate_id: string;
  gate_type: string;
  prompt: string;
  status?: string;
  fields?: Array<{ name: string; label?: string; secret?: boolean }>;
  choices?: Array<{ id: string; label: string }>;
  phase?: string;
  assets?: Record<string, unknown>;
  domain?: string;
}

export function refreshGateAsset(conversationId: number, gateId: string) {
  return request<{ ok: boolean }>('/chat/gate/asset/refresh', {
    method: 'POST',
    body: JSON.stringify({ conversation_id: conversationId, gate_id: gateId }),
  });
}

export function createBridgeToken(conversationId: number, gateId: string) {
  return request<{
    bridge_token: string;
    bridge_status: string;
    domain: string;
    expires_at: string;
  }>('/chat/gate/bridge/create', {
    method: 'POST',
    body: JSON.stringify({ conversation_id: conversationId, gate_id: gateId }),
  });
}

export function getBridgeStatus(conversationId: number, gateId: string) {
  return request<{ status: { status?: string; domain?: string } }>('/chat/gate/bridge/status', {
    method: 'POST',
    body: JSON.stringify({ conversation_id: conversationId, gate_id: gateId }),
  });
}

export function cancelGate(conversationId: number, turnId: string, gateId: string) {
  return request<{ ok: boolean }>('/chat/gate/cancel', {
    method: 'POST',
    body: JSON.stringify({ conversation_id: conversationId, turn_id: turnId, gate_id: gateId }),
  });
}

type StreamHandlers = {
  onToken: (channel: 'answer' | 'think', text: string) => void;
  onToolStart: (callId: string, name: string, args: Record<string, unknown>) => void;
  onToolEnd: (
    callId: string,
    name: string,
    ok: boolean,
    preview: string,
    data?: ToolEndFrameData,
  ) => void;
  onError: (code: string, message: string) => void;
  onCancelled: (reason: string) => void;
  onDone: (payload: { turn_id: string; message_ids: number[] }) => void;
  onConversationTitle?: (payload: {
    conversation_id: number;
    title: string;
    updated_at?: string;
  }) => void;
  onUserGateRequired?: (payload: {
    turn_id: string;
    gate_id: string;
    gate_type: string;
    prompt: string;
    fields: GateFieldDef[];
    choices?: Array<{ id: string; label: string }>;
    phase?: string;
    assets?: Record<string, unknown>;
    domain?: string;
  }) => void;
  onBrowserBlocked?: (payload: {
    turn_id: string;
    message: string;
    conversation_id: number;
  }) => void;
  onActivity?: () => void;
};

export type UserGateRequiredPayload = NonNullable<StreamHandlers['onUserGateRequired']> extends (
  payload: infer P,
) => void
  ? P
  : never;

async function consumeChatSSE(
  path: string,
  body: Record<string, unknown>,
  handlers: StreamHandlers,
  signal?: AbortSignal,
) {
  const response = await fetchWithAuth(apiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (response.status === 409) {
    throw new Error('conversation_busy');
  }
  if (!response.ok || !response.body) {
    throw new Error(`stream request failed: ${response.status}`);
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
      const lines = event.split('\n');
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (!data) continue;
        try {
          const frame = JSON.parse(data) as StreamFrame;
          handlers.onActivity?.();
          switch (frame.type) {
            case 'token':
              if (frame.text) {
                handlers.onToken(frame.channel === 'think' ? 'think' : 'answer', frame.text);
              }
              break;
            case 'tool_start':
              handlers.onToolStart(frame.call_id ?? '', frame.name ?? '', frame.args ?? {});
              break;
            case 'tool_end':
              handlers.onToolEnd(
                frame.call_id ?? '',
                frame.name ?? '',
                frame.ok ?? false,
                frame.preview ?? '',
                frame.data,
              );
              break;
            case 'user_gate_required':
              handlers.onUserGateRequired?.({
                turn_id: frame.turn_id ?? '',
                gate_id: frame.gate_id ?? '',
                gate_type: frame.gate_type ?? 'credentials',
                prompt: frame.prompt ?? '',
                fields: (frame.fields ?? []) as GateFieldDef[],
                choices: ((frame as { choices?: Array<{ id: string; label: string }> }).choices ?? []),
                phase: (frame as { phase?: string }).phase,
                assets: (frame.assets ?? {}) as Record<string, unknown>,
                domain: (frame as { domain?: string }).domain,
              });
              break;
            case 'browser_blocked':
              handlers.onBrowserBlocked?.({
                turn_id: (frame as { turn_id?: string }).turn_id ?? '',
                message: (frame as { message?: string }).message ?? '这个页面需要一个我在这里没法完成的验证。',
                conversation_id: (frame as { conversation_id?: number }).conversation_id ?? 0,
              });
              break;
            case 'error':
              handlers.onError(frame.code ?? 'error', frame.message ?? 'unknown error');
              break;
            case 'cancelled':
              handlers.onCancelled(frame.reason ?? 'cancelled');
              break;
            case 'done':
              handlers.onDone({
                turn_id: frame.turn_id ?? '',
                message_ids: frame.message_ids ?? [],
              });
              break;
            case 'conversation_title':
              if (frame.conversation_id != null && frame.title) {
                handlers.onConversationTitle?.({
                  conversation_id: frame.conversation_id,
                  title: frame.title,
                  updated_at: frame.updated_at,
                });
              }
              break;
            default:
              break;
          }
        } catch {
          // ignore malformed frame
        }
      }
    }
  }
}

export async function streamMessage(
  body: {
    conversation_id: number;
    content: string;
    model: string;
    attachment_ids?: number[];
    enable_tools?: boolean;
    client_turn_id?: string;
  },
  handlers: StreamHandlers,
  signal?: AbortSignal,
) {
  await consumeChatSSE('/chat/message/stream', body, handlers, signal);
}

export async function streamResume(
  body: {
    conversation_id: number;
    turn_id: string;
    gate_id: string;
    model: string;
    action: 'submit' | 'cancel';
    fields?: Record<string, string>;
  },
  handlers: StreamHandlers,
  signal?: AbortSignal,
) {
  await consumeChatSSE('/chat/turn/resume', body, handlers, signal);
}

export async function uploadAttachment(conversationId: number, file: File) {
  const form = new FormData();
  form.append('conversation_id', String(conversationId));
  form.append('file', file);
  const response = await fetchWithAuth(apiUrl('/chat/attachment/upload'), {
    method: 'POST',
    body: form,
  });
  const payload = await response.json();
  if (!response.ok || payload.code !== 0) {
    throw new Error(payload.msg ?? 'upload failed');
  }
  return payload.data as UploadedAttachment;
}

export function getAttachmentPreviewUrl(attachmentId: number) {
  return request<{ attachment_id: number; filename: string; mime_type: string; url: string }>(
    '/chat/attachment/preview-url',
    {
      method: 'POST',
      body: JSON.stringify({ attachment_id: attachmentId }),
    },
  );
}
