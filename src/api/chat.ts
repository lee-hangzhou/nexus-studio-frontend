import { apiOriginUrl, apiUrl, fetchWithAuth, getAccessToken, request } from './base';
import type { Stream as GeneratedStreamFrame } from './generated/stream';
import { consumeSSE } from './stream';
import type { TurnContentBlock, TurnMaterialBlock, TurnUserInput } from './turnContent';
import { toolPendingFromFrame, type ToolPendingState } from './toolPending';
import { filterSelectableModels } from '../shared/utils/hiddenSelectableModels';

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
  kind: 'chat' | 'prompt_assistant';
  is_generating?: boolean;
  awaiting_user_gate?: boolean;
  awaiting_upgrade_invite?: boolean;
  generating_started_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMessageView {
  id: number;
  role: string;
  content: string;
  input?: TurnUserInput | Record<string, unknown> | null;
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
  asset_id: number;
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

export async function listChatModels() {
  const items = await request<ChatModelItem[]>('/chat/model/list', {
    method: 'POST',
    body: JSON.stringify({}),
  });
  return filterSelectableModels(items, (item) => [item.key, item.display_name]);
}

export function createConversation(body: { title?: string; model: string }) {
  return request<ConversationView>('/chat/conversation/create', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function getOrCreatePromptAssistantSession(body: { model: string }) {
  return request<ConversationView>('/chat/prompt-assistant/session/get-or-create', {
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

export type ComposerPromptAppliedContent = NonNullable<
  Extract<StreamFrame, { type: 'composer_prompt_applied' }>['content']
>;

export type GenerateComposerContextPayload = {
  kind: 'image' | 'video' | 'audio';
  prompt?: string;
  content?: ComposerPromptAppliedContent;
  model_id?: string;
  ratio?: string | null;
  resolution?: string | null;
  count?: number | null;
  duration?: number | null;
  reference_mode?: number | null;
  ref_asset_ids?: number[];
};

type StreamHandlers = {
  onToken: (channel: 'answer' | 'think', text: string) => void;
  onSpeakerAttribution?: (payload: {
    speaker_role?: string | null;
    expert_id?: string | null;
    expert_name?: string | null;
    avatar?: string | null;
    task_id?: string | null;
  }) => void;
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
  onUpgradeInviteProposed?: (payload: {
    turn_id: string;
    proposal_id: number;
    conversation_id: number;
    expert_keys: string[];
    primary_expert_key: string;
    rationale: string;
    experts: Array<{ key: string; name: string }>;
  }) => void;
  onBrowserBlocked?: (payload: {
    turn_id: string;
    message: string;
    conversation_id: number;
  }) => void;
  onComposerPromptApplied?: (payload: {
    turn_id: string;
    prompt: string;
    content: ComposerPromptAppliedContent;
    ref_asset_ids: number[];
  }) => void;
  onToolPending?: (payload: ToolPendingState) => void;
  onActivity?: () => void;
};

export type UserGateRequiredPayload = NonNullable<StreamHandlers['onUserGateRequired']> extends (
  payload: infer P,
) => void
  ? P
  : never;

function isChatTerminalFrame(frame: StreamFrame): boolean {
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

function dispatchChatFrame(frame: StreamFrame, handlers: StreamHandlers): void {
  handlers.onActivity?.();
  switch (frame.type) {
    case 'token':
      if (
        'speaker_role' in frame
        || 'expert_id' in frame
        || 'expert_name' in frame
        || 'avatar' in frame
        || 'task_id' in frame
      ) {
        handlers.onSpeakerAttribution?.({
          speaker_role: (frame as { speaker_role?: string | null }).speaker_role,
          expert_id: (frame as { expert_id?: string | null }).expert_id,
          expert_name: (frame as { expert_name?: string | null }).expert_name,
          avatar: (frame as { avatar?: string | null }).avatar,
          task_id: (frame as { task_id?: string | null }).task_id,
        });
      }
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
    case 'upgrade_invite_proposed': {
      const proposed = frame as Extract<StreamFrame, { type: 'upgrade_invite_proposed' }>;
      if (
        typeof proposed.proposal_id !== 'number'
        || typeof proposed.conversation_id !== 'number'
        || !Array.isArray(proposed.expert_keys)
        || typeof proposed.primary_expert_key !== 'string'
        || typeof proposed.rationale !== 'string'
        || !proposed.rationale
        || !Array.isArray(proposed.experts)
        || proposed.experts.some(
          (item) =>
            typeof (item as { key?: unknown }).key !== 'string'
            || !(item as { key: string }).key
            || typeof (item as { name?: unknown }).name !== 'string'
            || !(item as { name: string }).name,
        )
        || (
          proposed.expert_keys.length > 0
          && (
            !proposed.primary_expert_key
            || !proposed.expert_keys.includes(proposed.primary_expert_key)
          )
        )
      ) {
        handlers.onError('internal', 'upgrade_invite_proposed frame malformed');
        break;
      }
      handlers.onUpgradeInviteProposed?.({
        turn_id: proposed.turn_id,
        proposal_id: proposed.proposal_id,
        conversation_id: proposed.conversation_id,
        expert_keys: proposed.expert_keys,
        primary_expert_key: proposed.primary_expert_key,
        rationale: proposed.rationale,
        experts: proposed.experts.map((item) => ({
          key: (item as { key: string }).key,
          name: (item as { name: string }).name,
        })),
      });
      break;
    }
    case 'browser_blocked':
      handlers.onBrowserBlocked?.({
        turn_id: (frame as { turn_id?: string }).turn_id ?? '',
        message: (frame as { message?: string }).message ?? '这个页面需要一个我在这里没法完成的验证。',
        conversation_id: (frame as { conversation_id?: number }).conversation_id ?? 0,
      });
      break;
    case 'tool_pending': {
      const pending = toolPendingFromFrame(frame as Parameters<typeof toolPendingFromFrame>[0]);
      if (pending) {
        handlers.onToolPending?.(pending);
      }
      break;
    }
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
    case 'composer_prompt_applied':
      if (!Array.isArray(frame.content)) {
        handlers.onError('internal', 'composer_prompt_applied missing content');
        break;
      }
      handlers.onComposerPromptApplied?.({
        turn_id: frame.turn_id,
        prompt: frame.prompt,
        content: frame.content,
        ref_asset_ids: Array.isArray(frame.ref_asset_ids) ? frame.ref_asset_ids : [],
      });
      break;
    default:
      break;
  }
}

/** 非终态断流后按 Last-Event-ID 走 /chat/turn/reconnect 续传 */
async function consumeChatTurnWithReplay(
  openPath: string,
  openBody: Record<string, unknown>,
  reconnectBody: { request_id: string; conversation_id: number },
  handlers: StreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  let lastEventId: string | null = null;
  let terminal = false;
  let opened = false;

  const trackFrame = (frame: StreamFrame) => {
    if (isChatTerminalFrame(frame)) terminal = true;
    dispatchChatFrame(frame, handlers);
  };

  while (true) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    const isReconnect = opened;
    let madeProgress = false;
    const onFrameTracked = (frame: StreamFrame) => {
      madeProgress = true;
      trackFrame(frame);
    };
    const onIdTracked = (eventId: string) => {
      madeProgress = true;
      lastEventId = eventId;
    };
    try {
      if (!opened) {
        await consumeSSE(
          openPath,
          openBody,
          {
            onFrame: (raw) => onFrameTracked(raw as StreamFrame),
            onEventId: onIdTracked,
            onHttpError: (status) => {
              if (status === 409) throw new Error('conversation_busy');
            },
          },
          signal,
          { lastEventId },
        );
        opened = true;
      } else {
        await consumeSSE(
          '/chat/turn/reconnect',
          reconnectBody,
          {
            onFrame: (raw) => onFrameTracked(raw as StreamFrame),
            onEventId: onIdTracked,
            onHttpError: (status) => {
              if (status === 409) throw new Error('conversation_busy');
            },
          },
          signal,
          { lastEventId },
        );
      }
      if (terminal || signal?.aborted) return;
      if (isReconnect && !madeProgress) return;
      await sleep(600, signal);
    } catch (err) {
      if (signal?.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
        throw err;
      }
      if (err instanceof Error && err.message === 'conversation_busy') {
        throw err;
      }
      if (lastEventId != null) opened = true;
      if (!opened) throw err;
      if (terminal) return;
      await sleep(800, signal);
    }
  }
}

export async function streamMessage(
  body: {
    request_id: string;
    conversation_id: number;
    content: TurnContentBlock[];
    materials: TurnMaterialBlock[];
    model: string;
    enable_tools?: boolean;
    client_turn_id?: string;
    project_id?: number;
    turn_target?: {
      expert_id?: string | null;
      task_id?: string | null;
      speaker_role?: string | null;
      persist_user_message?: boolean;
    };
    composer_context?: GenerateComposerContextPayload;
  },
  handlers: StreamHandlers,
  signal?: AbortSignal,
) {
  await consumeChatTurnWithReplay(
    '/chat/message/stream',
    body as unknown as Record<string, unknown>,
    { request_id: body.request_id, conversation_id: body.conversation_id },
    handlers,
    signal,
  );
}

export async function streamResume(
  body: {
    request_id: string;
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
  await consumeChatTurnWithReplay(
    '/chat/turn/resume',
    body as unknown as Record<string, unknown>,
    { request_id: body.request_id, conversation_id: body.conversation_id },
    handlers,
    signal,
  );
}

export async function uploadAttachment(conversationId: number, file: File): Promise<UploadedAttachment> {
  const form = new FormData();
  form.append('conversation_id', String(conversationId));
  form.append('file', file);
  const response = await fetchWithAuth(apiUrl('/chat/attachment/upload'), {
    method: 'POST',
    body: form,
  });
  let payload: { code?: unknown; msg?: unknown; data?: unknown } | null = null;
  try {
    payload = (await response.json()) as { code?: unknown; msg?: unknown; data?: unknown };
  } catch {
    throw new Error(`上传响应不是 JSON: ${response.status}`);
  }
  if (!response.ok || payload.code !== 0) {
    throw new Error(typeof payload.msg === 'string' ? payload.msg : 'upload failed');
  }
  const data = payload.data;
  if (!isRecord(data)) {
    throw new Error('上传响应缺少 data');
  }
  const attachmentId = data.attachment_id;
  const assetId = data.asset_id;
  const filename = data.filename;
  const mimeType = data.mime_type;
  if (typeof attachmentId !== 'number' || !Number.isFinite(attachmentId) || attachmentId < 1) {
    throw new Error('上传成功但缺少有效 attachment_id');
  }
  if (typeof assetId !== 'number' || !Number.isFinite(assetId) || assetId < 1) {
    throw new Error('上传成功但缺少有效 asset_id');
  }
  if (typeof filename !== 'string' || filename.length === 0) {
    throw new Error('上传响应缺少 filename');
  }
  if (typeof mimeType !== 'string' || mimeType.length === 0) {
    throw new Error('上传响应缺少 mime_type');
  }
  const uploaded: UploadedAttachment = {
    attachment_id: attachmentId,
    asset_id: assetId,
    filename,
    mime_type: mimeType,
  };
  if (typeof data.preview_url === 'string') {
    uploaded.preview_url = data.preview_url;
  }
  if (typeof data.source === 'string') {
    uploaded.source = data.source;
  }
  return uploaded;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
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
