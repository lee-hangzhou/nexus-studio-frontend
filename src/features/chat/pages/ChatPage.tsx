import {
  ArrowUpOutlined,
  CopyOutlined,
  DeleteOutlined,
  PictureOutlined,
  PlusOutlined,
  SearchOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { Button, Select, Spin, Upload, message as antMessage } from 'antd';
import dayjs from 'dayjs';
import { useCallback, useEffect, useRef, useState, Fragment } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  createConversation,
  getConversation,
  getGateState,
  listChatModels,
  listConversations,
  streamMessage,
  streamResume,
  cancelGate,
  cancelTurn,
  uploadAttachment,
  type ChatMessageView,
  type ChatModelItem,
  type ConversationView,
  type GatePendingView,
  type UserGateRequiredPayload,
  type MessageAttachment,
  type UploadedAttachment,
} from '../../../api/chat';
import { PageScaffold } from '../../../shared/ui/PageScaffold';
import { ChatRightPanel } from '../components/ChatRightPanel';
import { UserGatePanel, type UserGateState } from '../components/UserGatePanel';
import { TurnWorkingStatus } from '../components/TurnWorkingStatus';
import { ComposerAttachmentList } from '../components/ComposerAttachmentList';
import { MessageAttachmentList, getMessageAttachments } from '../components/MessageAttachmentList';
import { SessionListItem } from '../components/SessionListItem';
import { ToolRunTimeline } from '../components/ToolRunTimeline';
import { sanitizeToolResultPreview } from '../toolResultPreview';
import {
  appendLiveToolStart,
  resolveTurnTimelineForUser,
  toolStepsFromTimeline,
  updateLiveToolEnd,
  userMessageMatchesLiveTurn,
  type TurnTimelineItem,
} from '../turnTimeline';
import { flushAssistantNarration } from '../turnTimelineOps';
import { DEFAULT_CONVERSATION_TITLE } from '../constants';
import {
  loadInitialConversationMessages,
  loadOlderConversationMessages,
  type ConversationMessagePagination,
} from '../messageList';
import { isImageMime } from '../hooks/useAttachmentUrl';

function userGateFromPending(conversationId: number, pending: GatePendingView): UserGateState {
  return {
    turnId: pending.turn_id,
    gateId: pending.gate_id,
    gateType: pending.gate_type,
    prompt: pending.prompt,
    fields: pending.fields ?? [],
    choices: pending.choices ?? [],
    phase: pending.phase,
    assets: pending.assets as UserGateState['assets'],
    conversationId,
    domain: pending.domain,
  };
}

function userGateFromPayload(conversationId: number, payload: UserGateRequiredPayload): UserGateState {
  return {
    turnId: payload.turn_id,
    gateId: payload.gate_id,
    gateType: payload.gate_type,
    prompt: payload.prompt,
    fields: payload.fields,
    choices: payload.choices ?? [],
    phase: payload.phase,
    assets: payload.assets as UserGateState['assets'],
    conversationId,
    domain: payload.domain,
  };
}

async function hydrateGatePending(conversationId: number, pending: GatePendingView): Promise<UserGateState> {
  return userGateFromPending(conversationId, pending);
}
import { splitThinkFromContent } from '../thinkContent';

// ── 工具函数 ────────────────────────────────────────────────────────────────

function buildTurnId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `turn-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

type ConversationUiState = {
  messages: ChatMessageView[];
  messagePagination: ConversationMessagePagination;
  liveTurnTimeline: TurnTimelineItem[];
  narrationCursor: number;
  liveTurnId: string | null;
  liveTurnStartedAt: number | null;
  attachments: UploadedAttachment[];
  gatePending: UserGateState | null;
};

const EMPTY_MESSAGE_PAGINATION: ConversationMessagePagination = {
  hasMore: false,
  nextBeforeId: null,
};

const EMPTY_CONVERSATION_UI: ConversationUiState = {
  messages: [],
  messagePagination: { ...EMPTY_MESSAGE_PAGINATION },
  liveTurnTimeline: [],
  narrationCursor: 0,
  liveTurnId: null,
  liveTurnStartedAt: null,
  attachments: [],
  gatePending: null,
};

function getMetaBoolean(metadata: Record<string, unknown>, key: string): boolean {
  return metadata[key] === true;
}

function getMetaString(metadata: Record<string, unknown>, key: string): string {
  const value = metadata[key];
  return typeof value === 'string' ? value : '';
}

function resolveAssistantParts(message: ChatMessageView): { think: string; content: string } {
  const metaThink = getMetaString(message.metadata, 'think');
  const parsed = splitThinkFromContent(message.content);
  return {
    think: metaThink || parsed.think,
    content: metaThink ? message.content : parsed.content,
  };
}

function isVisibleMessage(message: ChatMessageView): boolean {
  if (message.role === 'tool') return false;
  if (message.role === 'assistant') {
    const phase = getMetaString(message.metadata, 'phase');
    if (phase === 'tool_request') return false;
    if (phase === 'cancelled') return true;
    if (getMetaBoolean(message.metadata, 'streaming')) return true;
  }
  return true;
}

function visibleMessages(messages: ChatMessageView[]): ChatMessageView[] {
  return messages.filter(isVisibleMessage);
}

function shouldScrollMessagesToEnd(prev: ChatMessageView[], next: ChatMessageView[]): boolean {
  if (next.length === 0) return false;
  if (prev.length === 0) return true;
  const prevFirst = prev[0]?.id;
  const nextFirst = next[0]?.id;
  const prevLast = prev[prev.length - 1]?.id;
  const nextLast = next[next.length - 1]?.id;
  if (nextFirst !== prevFirst) return false;
  return nextLast !== prevLast || next.length > prev.length;
}

function findActiveAssistantMessageId(messages: ChatMessageView[]): number | string | null {
  const match = messages.find(
    (message) =>
      message.role === 'assistant'
      && (getMetaBoolean(message.metadata, 'streaming') || getMetaBoolean(message.metadata, 'awaiting_gate')),
  );
  return match?.id ?? null;
}

function parsePublishPreview(preview: string): MessageAttachment | null {
  const match = preview.match(/attachment_id=(\d+)\s+filename=(.+)/);
  if (!match) return null;
  const filename = match[2].trim();
  const lower = filename.toLowerCase();
  let mimeType = 'application/octet-stream';
  if (lower.endsWith('.docx')) {
    mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  } else if (lower.endsWith('.pdf')) {
    mimeType = 'application/pdf';
  } else if (lower.endsWith('.xlsx')) {
    mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  }
  return { attachment_id: Number(match[1]), filename, mime_type: mimeType };
}

function isBlobPreviewUrl(url: string | undefined): url is string {
  return typeof url === 'string' && url.startsWith('blob:');
}

function collectMessageBlobPreviewUrls(rows: ChatMessageView[]): Set<string> {
  const inUse = new Set<string>();
  rows.forEach((m) => {
    getMessageAttachments(m.metadata).forEach((att) => {
      if (isBlobPreviewUrl(att.preview_url)) inUse.add(att.preview_url);
    });
  });
  return inUse;
}

function hasDeliverableContent(messages: ChatMessageView[]): boolean {
  return messages.some(
    (m) =>
      m.role === 'assistant' &&
      isVisibleMessage(m) &&
      getMessageAttachments(m.metadata).length > 0,
  );
}

function hasVisibleAssistantContent(messages: ChatMessageView[]): boolean {
  return messages.some(
    (m) =>
      m.role === 'assistant' &&
      isVisibleMessage(m) &&
      (Boolean(resolveAssistantParts(m).content.trim()) ||
        getMessageAttachments(m.metadata).length > 0),
  );
}

// ── 会话时间分组 ─────────────────────────────────────────────────────────────

type TimeFilter = 'all' | 'today' | 'yesterday' | '7d';
type SessionGroup = { label: string; items: ConversationView[] };

function filterSessionsByTime(sessions: ConversationView[], filter: TimeFilter): ConversationView[] {
  if (filter === 'all') return sessions;
  const now = dayjs();
  return sessions.filter((s) => {
    const t = dayjs(s.updated_at);
    if (filter === 'today') return t.isSame(now, 'day');
    if (filter === 'yesterday') return t.isSame(now.subtract(1, 'day'), 'day');
    if (filter === '7d') return now.diff(t, 'day') <= 7;
    return true;
  });
}

function groupSessions(sessions: ConversationView[]): SessionGroup[] {
  const now = dayjs();
  const groups: SessionGroup[] = [
    { label: '今天', items: [] },
    { label: '昨天', items: [] },
    { label: '最近 7 天', items: [] },
    { label: '更早', items: [] },
  ];
  for (const s of sessions) {
    const t = dayjs(s.updated_at);
    if (t.isSame(now, 'day')) groups[0].items.push(s);
    else if (t.isSame(now.subtract(1, 'day'), 'day')) groups[1].items.push(s);
    else if (now.diff(t, 'day') <= 7) groups[2].items.push(s);
    else groups[3].items.push(s);
  }
  return groups.filter((g) => g.items.length > 0);
}

const TIME_FILTER_TABS: { key: TimeFilter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'today', label: '今天' },
  { key: 'yesterday', label: '昨天' },
  { key: '7d', label: '7天内' },
];

// ── 主组件 ───────────────────────────────────────────────────────────────────

export function ChatPage() {
  const [input, setInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sessionFilter, setSessionFilter] = useState<TimeFilter>('all');
  const [models, setModels] = useState<ChatModelItem[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [sessions, setSessions] = useState<ConversationView[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessageView[]>([]);
  const [liveTurnTimeline, setLiveTurnTimeline] = useState<TurnTimelineItem[]>([]);
  const [narrationCursor, setNarrationCursor] = useState(0);
  const [liveTurnId, setLiveTurnId] = useState<string | null>(null);
  const [liveTurnStartedAt, setLiveTurnStartedAt] = useState<number | null>(null);
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  const [gatePending, setGatePending] = useState<UserGateState | null>(null);
  const [gateCancelling, setGateCancelling] = useState(false);
  const [modelVisionHint, setModelVisionHint] = useState<string | null>(null);
  const [loadingConversationIds, setLoadingConversationIds] = useState<Set<number>>(() => new Set());
  const [booting, setBooting] = useState(true);
  const uiByConversationRef = useRef<Map<number, ConversationUiState>>(new Map());
  const streamsByConversationRef = useRef<
    Map<number, { turnId: string; controller: AbortController }>
  >(new Map());
  const gateResumeInFlightRef = useRef(false);
  const gateResumeControllerRef = useRef<AbortController | null>(null);
  const dismissedGateIdDuringResumeRef = useRef<string | null>(null);
  const loadingIdsRef = useRef<Set<number>>(new Set());
  const activeConversationIdRef = useRef<number | null>(null);
  const pendingPreviewRevokeRef = useRef<Set<string>>(new Set());
  const messagesRef = useRef<ChatMessageView[]>([]);
  const prevMessagesForScrollRef = useRef<ChatMessageView[]>([]);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const loadingOlderIdsRef = useRef<Set<number>>(new Set());
  const tempIdRef = useRef(-1);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const composerInputRef = useRef<HTMLTextAreaElement>(null);
  const turnStartedAtFallbackRef = useRef<number | null>(null);

  const focusComposerIfActive = useCallback((conversationId: number) => {
    if (activeConversationIdRef.current !== conversationId) return;
    requestAnimationFrame(() => {
      composerInputRef.current?.focus();
    });
  }, []);

  const activeSession = sessions.find((s) => s.id === activeConversationId);

  const activeConversationLoading =
    activeConversationId != null && loadingConversationIds.has(activeConversationId);
  const serverGenerating = Boolean(activeSession?.is_generating) && !activeConversationLoading;
  const awaitingUserGate = Boolean(activeSession?.awaiting_user_gate) || gatePending != null;
  const conversationBusy = activeConversationLoading || Boolean(activeSession?.is_generating);
  const effectiveAwaitingUserGate = awaitingUserGate;

  const streamingAssistantMessage = messages.find(
    (m) => m.role === 'assistant' && getMetaBoolean(m.metadata, 'streaming'),
  );
  const streamingAssistantParts = streamingAssistantMessage
    ? resolveAssistantParts(streamingAssistantMessage)
    : { think: '', content: '' };
  const streamingBodyContent = streamingAssistantMessage
    ? streamingAssistantMessage.content.slice(narrationCursor).trim()
    : streamingAssistantParts.content.trim();

  const activeTurnUserMessage = (() => {
    if (conversationBusy) {
      for (let index = messages.length - 1; index >= 0; index -= 1) {
        if (messages[index].role === 'user') return messages[index];
      }
    }
    if (liveTurnId) {
      const matched = messages.find(
        (message) => message.role === 'user' && userMessageMatchesLiveTurn(message, liveTurnId),
      );
      if (matched) return matched;
    }
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index].role === 'user') return messages[index];
    }
    return null;
  })();

  const lastUserMessageId = (() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index].role === 'user') return messages[index].id;
    }
    return null;
  })();

  const isActiveTurnMessage = (message: ChatMessageView): boolean =>
    conversationBusy && message.role === 'user' && message.id === lastUserMessageId;

  const activeTurnTimeline = activeTurnUserMessage
    ? resolveTurnTimelineForUser(
        activeTurnUserMessage,
        messages,
        liveTurnId,
        liveTurnTimeline,
        { mergeLive: conversationBusy },
      )
    : [];

  const effectiveToolSteps = toolStepsFromTimeline(activeTurnTimeline);
  const serverGeneratingStartedAt = activeSession?.generating_started_at
    ? Date.parse(activeSession.generating_started_at)
    : null;
  if (!conversationBusy) {
    turnStartedAtFallbackRef.current = null;
  } else if (
    liveTurnStartedAt == null
    && serverGeneratingStartedAt == null
    && turnStartedAtFallbackRef.current == null
  ) {
    turnStartedAtFallbackRef.current = Date.now();
  }
  const effectiveTurnStartedAt =
    liveTurnStartedAt
    ?? serverGeneratingStartedAt
    ?? turnStartedAtFallbackRef.current;
  const showServerGeneratingBubble =
    serverGenerating &&
    !effectiveAwaitingUserGate &&
    streamingAssistantMessage == null &&
    !hasVisibleAssistantContent(messages) &&
    activeTurnTimeline.length === 0;

  const setConversationLoading = useCallback((conversationId: number, loading: boolean) => {
    setLoadingConversationIds((prev) => {
      const next = new Set(prev);
      if (loading) next.add(conversationId);
      else next.delete(conversationId);
      loadingIdsRef.current = next;
      return next;
    });
  }, []);

  const applyUiFromCache = useCallback((conversationId: number) => {
    const cached = uiByConversationRef.current.get(conversationId) ?? EMPTY_CONVERSATION_UI;
    setMessages(cached.messages);
    setLiveTurnTimeline(cached.liveTurnTimeline);
    setNarrationCursor(cached.narrationCursor);
    setLiveTurnId(cached.liveTurnId);
    setLiveTurnStartedAt(cached.liveTurnStartedAt);
    setAttachments(cached.attachments);
    setGatePending(cached.gatePending);
  }, []);

  const saveUiToCache = useCallback(
    (conversationId: number) => {
      const prev = uiByConversationRef.current.get(conversationId) ?? { ...EMPTY_CONVERSATION_UI };
      uiByConversationRef.current.set(conversationId, {
        ...prev,
        messages,
        liveTurnTimeline,
        narrationCursor,
        liveTurnId,
        liveTurnStartedAt,
        attachments,
        gatePending,
      });
    },
    [attachments, gatePending, liveTurnId, liveTurnStartedAt, liveTurnTimeline, messages, narrationCursor],
  );

  const patchConversationUi = useCallback(
    (conversationId: number, updater: (prev: ConversationUiState) => ConversationUiState) => {
      const prev = uiByConversationRef.current.get(conversationId) ?? { ...EMPTY_CONVERSATION_UI };
      const next = updater(prev);
      uiByConversationRef.current.set(conversationId, next);
      if (activeConversationIdRef.current === conversationId) {
        setMessages(next.messages);
        setLiveTurnTimeline(next.liveTurnTimeline);
        setNarrationCursor(next.narrationCursor);
        setLiveTurnId(next.liveTurnId);
        setLiveTurnStartedAt(next.liveTurnStartedAt);
        setAttachments(next.attachments);
        setGatePending(next.gatePending);
      }
    },
    [],
  );

  const abortConversationStream = useCallback(
    (conversationId: number) => {
      gateResumeControllerRef.current?.abort();
      gateResumeControllerRef.current = null;
      const stream = streamsByConversationRef.current.get(conversationId);
      if (stream) {
        stream.controller.abort();
        streamsByConversationRef.current.delete(conversationId);
      }
      setConversationLoading(conversationId, false);
    },
    [setConversationLoading],
  );

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  const selectedModelSpec = models.find((item) => item.key === selectedModel);
  const supportsVision = selectedModelSpec?.supports_vision === true;

  // 搜索 + 时间筛选（搜索模式忽略时间筛选，直接显示全部匹配结果）
  const filteredSessions = (() => {
    const q = searchQuery.trim().toLowerCase();
    const base = q
      ? sessions.filter((s) => s.title.toLowerCase().includes(q))
      : filterSessionsByTime(sessions, sessionFilter);
    return base;
  })();

  const handleModelChange = (modelKey: string) => {
    setSelectedModel(modelKey);
    const next = models.find((item) => item.key === modelKey);
    const nextSupportsVision = next?.supports_vision === true;
    const hasImageAttachments = attachments.some((item) => isImageMime(item.mime_type));
    if (!nextSupportsVision && hasImageAttachments) {
      setModelVisionHint('当前模型不支持识图，已上传的图片将不会被发送');
    } else {
      setModelVisionHint(null);
    }
  };

  const attachmentIdsForSend = supportsVision
    ? attachments.map((item) => item.attachment_id)
    : attachments
        .filter((item) => !isImageMime(item.mime_type))
        .map((item) => item.attachment_id);

  const nextTempId = () => {
    const id = tempIdRef.current;
    tempIdRef.current -= 1;
    return id;
  };

  const flushQueuedPreviewUrlRevoke = useCallback((rows?: ChatMessageView[]) => {
    const queue = pendingPreviewRevokeRef.current;
    if (queue.size === 0) return;
    const inUse = collectMessageBlobPreviewUrls(rows ?? messagesRef.current);
    queue.forEach((url) => {
      if (inUse.has(url)) return;
      URL.revokeObjectURL(url);
      queue.delete(url);
    });
  }, []);

  const queuePreviewUrlForDelayedRevoke = useCallback((urls: Array<string | undefined>) => {
    const queue = pendingPreviewRevokeRef.current;
    urls.forEach((url) => {
      if (isBlobPreviewUrl(url)) queue.add(url);
    });
  }, []);

  const loadSessions = useCallback(async () => {
    const data = await listConversations({ limit: 50 });
    setSessions(data.items);
    return data.items;
  }, []);

  const loadMessages = useCallback(
    async (conversationId: number, options?: { force?: boolean }) => {
      if (!options?.force && loadingIdsRef.current.has(conversationId)) {
        return;
      }
      const loaded = await loadInitialConversationMessages(conversationId);
      flushQueuedPreviewUrlRevoke(loaded.messages);
      patchConversationUi(conversationId, (prev) => ({
        ...prev,
        messages: loaded.messages,
        messagePagination: loaded.pagination,
      }));
    },
    [flushQueuedPreviewUrlRevoke, patchConversationUi],
  );

  const loadOlderMessages = useCallback(
    async (conversationId: number) => {
      const cached = uiByConversationRef.current.get(conversationId) ?? EMPTY_CONVERSATION_UI;
      const cursor = cached.messagePagination.nextBeforeId;
      if (
        !cached.messagePagination.hasMore ||
        cursor == null ||
        loadingOlderIdsRef.current.has(conversationId)
      ) {
        return;
      }
      loadingOlderIdsRef.current.add(conversationId);
      const container = messagesContainerRef.current;
      const prevScrollHeight = container?.scrollHeight ?? 0;
      try {
        const loaded = await loadOlderConversationMessages(conversationId, cursor);
        if (loaded.messages.length === 0) {
          patchConversationUi(conversationId, (prev) => ({
            ...prev,
            messagePagination: loaded.pagination,
          }));
          return;
        }
        flushQueuedPreviewUrlRevoke(loaded.messages);
        patchConversationUi(conversationId, (prev) => ({
          ...prev,
          messages: [...loaded.messages, ...prev.messages],
          messagePagination: loaded.pagination,
        }));
        requestAnimationFrame(() => {
          if (container) {
            container.scrollTop = container.scrollHeight - prevScrollHeight;
          }
        });
      } finally {
        loadingOlderIdsRef.current.delete(conversationId);
      }
    },
    [flushQueuedPreviewUrlRevoke, patchConversationUi],
  );

  const handleMessagesScroll = useCallback(() => {
    const conversationId = activeConversationIdRef.current;
    const container = messagesContainerRef.current;
    if (conversationId == null || container == null) return;
    if (container.scrollTop > 120) return;
    void loadOlderMessages(conversationId);
  }, [loadOlderMessages]);

  const cancelInFlightTurn = useCallback(async () => {
    if (activeConversationId == null) return;
    const conversationId = activeConversationId;
    const pendingGate = uiByConversationRef.current.get(conversationId)?.gatePending;
    abortConversationStream(conversationId);
    if (pendingGate) {
      try {
        await cancelGate(conversationId, pendingGate.turnId, pendingGate.gateId);
      } catch {
        // ignore gate cancel errors during turn cancel
      }
    }
    try {
      await cancelTurn(conversationId);
    } catch (err) {
      antMessage.error(err instanceof Error ? err.message : '停止失败');
    }
    setSessions((prev) =>
      prev.map((s) =>
        s.id === conversationId
          ? { ...s, is_generating: false, awaiting_user_gate: false, generating_started_at: null }
          : s,
      ),
    );
    patchConversationUi(conversationId, (prev) => ({
      ...prev,
      gatePending: null,
      liveTurnId: null,
      liveTurnStartedAt: null,
      liveTurnTimeline: [],
      narrationCursor: 0,
      messages: prev.messages.map((message) =>
        getMetaBoolean(message.metadata, 'streaming') || getMetaBoolean(message.metadata, 'awaiting_gate')
          ? { ...message, metadata: { ...message.metadata, streaming: false, awaiting_gate: false } }
          : message,
      ),
    }));
    try {
      const items = await loadSessions();
      setSessions(items);
    } catch {
      // ignore sidebar refresh errors
    }
    void loadMessages(conversationId, { force: true });
    antMessage.info('已停止当前任务');
  }, [abortConversationStream, activeConversationId, loadMessages, loadSessions, patchConversationUi]);

  const ensureConversationId = useCallback(async (): Promise<number> => {
    if (activeConversationId != null) return activeConversationId;
    const conv = await createConversation({
      title: DEFAULT_CONVERSATION_TITLE,
      model: selectedModel || undefined,
    });
    const items = await loadSessions();
    setSessions(items);
    uiByConversationRef.current.set(conv.id, { ...EMPTY_CONVERSATION_UI });
    setActiveConversationId(conv.id);
    applyUiFromCache(conv.id);
    return conv.id;
  }, [activeConversationId, applyUiFromCache, loadSessions, selectedModel]);

  useEffect(() => {
    (async () => {
      try {
        const [modelList, items] = await Promise.all([listChatModels(), loadSessions()]);
        setModels(modelList);
        if (modelList.length > 0) setSelectedModel(modelList[0].key);
        if (items.length > 0) {
          const keep =
            activeConversationId != null && items.some((s) => s.id === activeConversationId)
              ? activeConversationId
              : items[0].id;
          setActiveConversationId(keep);
          await loadMessages(keep);
        } else {
          setActiveConversationId(null);
          setMessages([]);
          setLiveTurnTimeline([]);
        }
      } catch (err) {
        antMessage.error(err instanceof Error ? err.message : '加载失败');
      } finally {
        setBooting(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 刷新/切会话后：后端 turn 仍在跑或等待 gate，轮询会话状态并恢复 gate 面板
  useEffect(() => {
    if (activeConversationId == null || activeConversationLoading) {
      return;
    }
    const needsPoll =
      Boolean(activeSession?.is_generating) || Boolean(activeSession?.awaiting_user_gate);
    if (!needsPoll) {
      return;
    }
    const conversationId = activeConversationId;
    const timer = window.setInterval(() => {
      void (async () => {
        try {
          const conv = await getConversation(conversationId);
          setSessions((prev) => prev.map((s) => (s.id === conversationId ? { ...s, ...conv } : s)));
          if (conv.awaiting_user_gate && !gateResumeInFlightRef.current) {
            const gateState = await getGateState(conversationId);
            if (
              gateState.pending &&
              gateState.pending.status !== 'resuming' &&
              gateState.pending.status !== 'cancelled' &&
              (!gateState.pending.status || gateState.pending.status === 'pending') &&
              gateState.pending.gate_id !== dismissedGateIdDuringResumeRef.current
            ) {
              const hydrated = await hydrateGatePending(conversationId, gateState.pending!);
              patchConversationUi(conversationId, (prev) => ({
                ...prev,
                gatePending: hydrated,
              }));
            }
          }
          await loadMessages(conversationId);
        } catch {
          // ignore background refresh errors
        }
      })();
    }, 4000);
    return () => window.clearInterval(timer);
  }, [
    activeConversationId,
    activeConversationLoading,
    activeSession?.awaiting_user_gate,
    activeSession?.is_generating,
    loadMessages,
    patchConversationUi,
  ]);

  useEffect(() => {
    if (
      activeConversationId == null ||
      !activeSession?.awaiting_user_gate ||
      gatePending != null ||
      gateResumeInFlightRef.current
    ) {
      return;
    }
    const conversationId = activeConversationId;
    void (async () => {
      try {
        const gateState = await getGateState(conversationId);
        if (
          gateState.pending &&
          gateState.pending.status !== 'resuming' &&
          gateState.pending.status !== 'cancelled' &&
          (!gateState.pending.status || gateState.pending.status === 'pending') &&
          gateState.pending.gate_id !== dismissedGateIdDuringResumeRef.current
        ) {
          const hydrated = await hydrateGatePending(conversationId, gateState.pending!);
          patchConversationUi(conversationId, (prev) => ({
            ...prev,
            gatePending: hydrated,
          }));
        }
      } catch {
        // ignore gate hydrate errors
      }
    })();
  }, [activeConversationId, activeSession?.awaiting_user_gate, gatePending, patchConversationUi]);

  // 仅在尾部追加新消息时滚底；加载更早历史时不打断阅读位置。
  useEffect(() => {
    const prev = prevMessagesForScrollRef.current;
    prevMessagesForScrollRef.current = messages;
    messagesRef.current = messages;
    flushQueuedPreviewUrlRevoke(messages);
    if (shouldScrollMessagesToEnd(prev, messages)) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [flushQueuedPreviewUrlRevoke, messages]);

  const selectSession = async (id: number) => {
    if (activeConversationId != null && activeConversationId !== id) {
      saveUiToCache(activeConversationId);
    }
    setActiveConversationId(id);
    if (loadingIdsRef.current.has(id)) {
      applyUiFromCache(id);
      return;
    }
    try {
      await loadMessages(id);
    } catch (err) {
      antMessage.error(err instanceof Error ? err.message : '加载消息失败');
      applyUiFromCache(id);
    }
  };

  const handleSessionDeleted = async (deletedId: number) => {
    abortConversationStream(deletedId);
    uiByConversationRef.current.delete(deletedId);
    const items = await loadSessions();
    setSessions(items);
    if (deletedId === activeConversationId) {
      setActiveConversationId(null);
      setMessages([]);
      setLiveTurnTimeline([]);
      setNarrationCursor(0);
      setLiveTurnId(null);
      setAttachments([]);
    }
  };

  const newSession = async () => {
    try {
      if (activeConversationId != null) {
        saveUiToCache(activeConversationId);
      }
      const conv = await createConversation({
        title: DEFAULT_CONVERSATION_TITLE,
        model: selectedModel || undefined,
      });
      const items = await loadSessions();
      setSessions(items);
      uiByConversationRef.current.set(conv.id, { ...EMPTY_CONVERSATION_UI });
      setActiveConversationId(conv.id);
      applyUiFromCache(conv.id);
    } catch (err) {
      antMessage.error(err instanceof Error ? err.message : '创建会话失败');
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text) return;
    if (attachments.some((item) => isImageMime(item.mime_type)) && !supportsVision) {
      antMessage.error('当前模型不支持识图，无法发送图片');
      return;
    }

    let conversationId: number;
    try {
      conversationId = await ensureConversationId();
    } catch (err) {
      antMessage.error(err instanceof Error ? err.message : '创建会话失败');
      return;
    }

    if (loadingIdsRef.current.has(conversationId)) {
      antMessage.warning('当前会话正在生成中，请稍后再试');
      return;
    }

    const existingStream = streamsByConversationRef.current.get(conversationId);
    if (existingStream) {
      existingStream.controller.abort();
      streamsByConversationRef.current.delete(conversationId);
    }

    const turnId = buildTurnId();
    const userTempId = nextTempId();
    const assistantTempId = nextTempId();
    const controller = new AbortController();
    streamsByConversationRef.current.set(conversationId, { turnId, controller });
    const isCurrentTurn = () =>
      streamsByConversationRef.current.get(conversationId)?.turnId === turnId;
    const isActiveConversation = () => activeConversationIdRef.current === conversationId;

    const sentAttachmentIds = attachmentIdsForSend;
    const sentAttachments: MessageAttachment[] = attachments.map((item) => ({
      attachment_id: item.attachment_id,
      filename: item.filename,
      mime_type: item.mime_type,
      preview_url: item.preview_url,
    }));
    queuePreviewUrlForDelayedRevoke(sentAttachments.map((item) => item.preview_url));
    if (isActiveConversation()) {
      setInput('');
    }
    setConversationLoading(conversationId, true);
    setSessions((prev) =>
      prev.map((s) =>
        s.id === conversationId
          ? { ...s, is_generating: true, generating_started_at: new Date().toISOString() }
          : s,
      ),
    );
    patchConversationUi(conversationId, (prev) => ({
      ...prev,
      liveTurnId: turnId,
      liveTurnStartedAt: Date.now(),
      liveTurnTimeline: [],
      narrationCursor: 0,
      attachments: isActiveConversation() ? [] : prev.attachments,
      messages: [
        ...prev.messages,
        {
          id: userTempId,
          role: 'user',
          content: text,
          metadata: { client_turn_id: turnId, attachments: sentAttachments },
          created_at: new Date().toISOString(),
        },
        {
          id: assistantTempId,
          role: 'assistant',
          content: '',
          metadata: { streaming: true, think: '', client_turn_id: turnId },
          created_at: new Date().toISOString(),
        },
      ],
    }));

    let streamDone = false;
    let streamError: string | null = null;
    let streamErrorCode: string | null = null;
    let publishedDeliverable: MessageAttachment | null = null;
    let gateInterrupted = false;

    const streamHandlers = {
      onToken: (channel: 'answer' | 'think', delta: string) => {
        if (!isCurrentTurn()) return;
        if (channel === 'think') {
          patchConversationUi(conversationId, (prev) => ({
            ...prev,
            messages: prev.messages.map((m) => {
              if (m.id !== assistantTempId) return m;
              const think = getMetaString(m.metadata, 'think');
              return { ...m, metadata: { ...m.metadata, think: `${think}${delta}`, streaming: true } };
            }),
          }));
          return;
        }
        patchConversationUi(conversationId, (prev) => ({
          ...prev,
          messages: prev.messages.map((m) =>
            m.id !== assistantTempId
              ? m
              : { ...m, content: `${m.content}${delta}`, metadata: { ...m.metadata, streaming: true } },
          ),
        }));
      },
      onToolStart: (callId: string, name: string, args: Record<string, unknown>) => {
        if (!isCurrentTurn()) return;
        patchConversationUi(conversationId, (prev) => {
          const flushed = flushAssistantNarration(prev, assistantTempId);
          return {
            ...flushed,
            liveTurnTimeline: appendLiveToolStart(flushed.liveTurnTimeline, callId, name, args),
          };
        });
      },
      onToolEnd: (
        callId: string,
        name: string,
        ok: boolean,
        preview: string,
        data?: { recoverable?: boolean } | null,
      ) => {
        if (!isCurrentTurn()) return;
        const recoverable = data?.recoverable === true;
        const safePreview = ok ? sanitizeToolResultPreview(name, preview, true) : sanitizeToolResultPreview(name, preview, false);
        const result = recoverable ? '参数异常，正在自动修复…' : ok ? safePreview : `失败: ${safePreview}`;
        patchConversationUi(conversationId, (prev) => {
          const settled = !recoverable && ok
            ? prev.liveTurnTimeline.map((item) => {
                if (item.kind !== 'tool') return item;
                if (item.step.name === name && item.step.result_preview === '参数异常，正在自动修复…') {
                  return { ...item, step: { ...item.step, result_preview: '参数已自动修复' } };
                }
                return item;
              })
            : prev.liveTurnTimeline;
          const nextTimeline = updateLiveToolEnd(settled, callId, name, result);
          if (name === 'publish_file' && ok) publishedDeliverable = parsePublishPreview(preview);
          return { ...prev, liveTurnTimeline: nextTimeline };
        });
      },
      onUserGateRequired: (payload: UserGateRequiredPayload) => {
        if (!isCurrentTurn()) return;
        gateInterrupted = true;
        const pending = userGateFromPayload(conversationId, payload);
        patchConversationUi(conversationId, (prev) => {
          const flushed = flushAssistantNarration(prev, assistantTempId);
          return {
            ...flushed,
            gatePending: pending,
            liveTurnTimeline: flushed.liveTurnTimeline.map((item) =>
              item.kind === 'tool'
              && item.step.name === 'request_user_gate'
              && item.step.result_preview === '执行中…'
                ? { ...item, step: { ...item.step, result_preview: '等待用户操作' } }
                : item,
            ),
            messages: flushed.messages.map((m) =>
              m.id === assistantTempId
                ? { ...m, metadata: { ...m.metadata, streaming: false, awaiting_gate: true } }
                : m,
            ),
          };
        });
      },
      onBrowserBlocked: (payload: {
        turn_id: string;
        message: string;
        conversation_id: number;
      }) => {
        if (!isCurrentTurn()) return;
        patchConversationUi(conversationId, (prev) => ({
          ...prev,
          messages: prev.messages.map((m) =>
            m.id === assistantTempId
              ? {
                  ...m,
                  content: payload.message || m.content,
                  metadata: {
                    ...m.metadata,
                    streaming: false,
                  },
                }
              : m,
          ),
        }));
      },
      onError: (code: string, msg: string) => {
        if (!isCurrentTurn()) return;
        streamDone = true;
        if (publishedDeliverable) {
          patchConversationUi(conversationId, (prev) => ({
            ...prev,
            messages: prev.messages.map((m) =>
              m.id === assistantTempId
                ? {
                    ...m,
                    content: `已完成，生成文件：${publishedDeliverable!.filename}`,
                    metadata: { ...m.metadata, streaming: false, artifacts: [publishedDeliverable] },
                  }
                : m,
            ),
          }));
          return;
        }
        streamError = msg;
        streamErrorCode = code;
        if (isActiveConversation()) antMessage.error(msg);
        patchConversationUi(conversationId, (prev) => ({
          ...prev,
          liveTurnId: null,
          liveTurnStartedAt: null,
          gatePending: null,
          narrationCursor: 0,
          liveTurnTimeline: prev.liveTurnTimeline.map((item) => {
            if (item.kind !== 'tool') return item;
            if (
              item.step.result_preview === '执行中…'
              || item.step.result_preview === '参数异常，正在自动修复…'
            ) {
              return { ...item, step: { ...item.step, result_preview: `失败: ${msg}` } };
            }
            return item;
          }),
          messages: prev.messages.map((m) =>
            m.id === assistantTempId
              ? { ...m, content: msg, metadata: { ...m.metadata, streaming: false, error: code } }
              : m,
          ),
        }));
      },
      onCancelled: () => { /* no-op */ },
      onConversationTitle: ({
        conversation_id,
        title,
        updated_at,
      }: {
        conversation_id: number;
        title: string;
        updated_at?: string;
      }) => {
        if (!isCurrentTurn()) return;
        setSessions((prev) =>
          prev.map((s) =>
            s.id === conversation_id ? { ...s, title, ...(updated_at ? { updated_at } : {}) } : s,
          ),
        );
      },
      onDone: () => {
        if (!isCurrentTurn()) return;
        streamDone = true;
        setConversationLoading(conversationId, false);
        if (gateInterrupted) {
          patchConversationUi(conversationId, (prev) => ({
            ...prev,
            messages: prev.messages.map((m) =>
              m.id === assistantTempId
                ? { ...m, metadata: { ...m.metadata, streaming: false, awaiting_gate: true } }
                : m,
            ),
          }));
          setSessions((prev) =>
            prev.map((s) =>
              s.id === conversationId
                ? { ...s, is_generating: true, awaiting_user_gate: true }
                : s,
            ),
          );
          return;
        }
        setSessions((prev) =>
          prev.map((s) =>
            s.id === conversationId
              ? {
                  ...s,
                  is_generating: false,
                  awaiting_user_gate: false,
                  generating_started_at: null,
                }
              : s,
          ),
        );
        focusComposerIfActive(conversationId);
        patchConversationUi(conversationId, (prev) => ({
          ...prev,
          liveTurnId: null,
          liveTurnStartedAt: null,
          gatePending: null,
          liveTurnTimeline: [],
          narrationCursor: 0,
          messages: prev.messages.map((m) =>
            m.id === assistantTempId ? { ...m, metadata: { ...m.metadata, streaming: false } } : m,
          ),
        }));
      },
    };

    try {
      await streamMessage(
        {
          conversation_id: conversationId,
          content: text,
          model: selectedModel || undefined,
          attachment_ids: sentAttachmentIds,
          enable_tools: true,
          client_turn_id: turnId,
        },
        streamHandlers,
        controller.signal,
      );

      if (!isCurrentTurn()) return;
      if (!streamDone && gateInterrupted) {
        return;
      }
      if (!streamDone) {
        patchConversationUi(conversationId, (prev) => ({
          ...prev,
          messages: prev.messages.filter((m) => m.id !== assistantTempId),
        }));
        if (!streamError && isActiveConversation()) {
          antMessage.error('流式连接意外中断，请重试');
        }
        return;
      }

      void (async () => {
        try {
          const items = await loadSessions();
          setSessions(items);
          await loadMessages(conversationId);
          // 标题在后台 LLM 生成，稍后再刷一次侧栏
          window.setTimeout(async () => {
            try {
              const retryItems = await loadSessions();
              setSessions(retryItems);
            } catch {
              // ignore delayed sidebar refresh
            }
          }, 15000);
        } catch {
          // ignore post-turn refresh errors
        }
      })();
      if (streamError && !publishedDeliverable) {
        patchConversationUi(conversationId, (prev) => {
          if (hasVisibleAssistantContent(prev.messages) || hasDeliverableContent(prev.messages)) {
            return prev;
          }
          return {
            ...prev,
            messages: [
              ...prev.messages,
              {
                id: nextTempId(),
                role: 'assistant',
                content: streamError ?? '请求失败',
                metadata: { phase: 'final', error: streamErrorCode ?? 'turn_error' },
                created_at: new Date().toISOString(),
              },
            ],
          };
        });
      }
    } catch (err) {
      if (!isCurrentTurn()) return;
      const aborted = err instanceof DOMException && err.name === 'AbortError';
      if (aborted) return;
      const msg = err instanceof Error ? err.message : '流式发送失败';
      patchConversationUi(conversationId, (prev) => ({
        ...prev,
        messages: prev.messages.filter((m) => m.id !== assistantTempId),
      }));
      if (isActiveConversation()) {
        if (msg === 'conversation_busy') {
          antMessage.warning('会话正在生成中，请稍后再试');
        } else {
          antMessage.error(msg);
        }
      }
    } finally {
      if (isCurrentTurn()) {
        streamsByConversationRef.current.delete(conversationId);
        setConversationLoading(conversationId, false);
        if (!gateInterrupted) {
          focusComposerIfActive(conversationId);
        }
      }
    }
  };

  const submitUserGate = async (fields: Record<string, string>) => {
    if (!activeConversationId || !gatePending) return;
    if (gateResumeInFlightRef.current) {
      antMessage.warning('正在处理上一次 gate 提交，请稍候');
      return;
    }
    const conversationId = activeConversationId;
    const pending = gatePending;

    gateResumeInFlightRef.current = true;
    dismissedGateIdDuringResumeRef.current = pending.gateId;
    setSessions((prev) =>
      prev.map((s) =>
        s.id === conversationId ? { ...s, awaiting_user_gate: false } : s,
      ),
    );
    // Close gate modal immediately; resume may run browser login for a long time.
    patchConversationUi(conversationId, (prev) => ({ ...prev, gatePending: null }));
    setConversationLoading(conversationId, true);
    const controller = new AbortController();
    gateResumeControllerRef.current = controller;
    let resumeDone = false;
    try {
      await streamResume(
        {
          conversation_id: conversationId,
          turn_id: pending.turnId,
          gate_id: pending.gateId,
          model: selectedModel,
          action: 'submit',
          fields,
        },
        {
          onToken: (channel, delta) => {
            if (channel !== 'answer') return;
            patchConversationUi(conversationId, (prev) => ({
              ...prev,
              messages: prev.messages.map((m) =>
                getMetaBoolean(m.metadata, 'awaiting_gate') || getMetaBoolean(m.metadata, 'streaming')
                  ? { ...m, content: `${m.content}${delta}`, metadata: { ...m.metadata, streaming: true, awaiting_gate: false } }
                  : m,
              ),
            }));
          },
          onToolStart: (callId, name, args) => {
            patchConversationUi(conversationId, (prev) => {
              const assistantId = findActiveAssistantMessageId(prev.messages);
              const flushed = assistantId != null ? flushAssistantNarration(prev, assistantId) : prev;
              return {
                ...flushed,
                liveTurnTimeline: appendLiveToolStart(flushed.liveTurnTimeline, callId, name, args),
              };
            });
          },
          onToolEnd: (callId, name, ok, preview) => {
            const safePreview = ok ? sanitizeToolResultPreview(name, preview, true) : sanitizeToolResultPreview(name, preview, false);
            patchConversationUi(conversationId, (prev) => ({
              ...prev,
              liveTurnTimeline: updateLiveToolEnd(
                prev.liveTurnTimeline,
                callId,
                name,
                ok ? safePreview : `失败: ${safePreview}`,
              ),
            }));
          },
          onUserGateRequired: (payload) => {
            dismissedGateIdDuringResumeRef.current = null;
            patchConversationUi(conversationId, (prev) => ({
              ...prev,
              gatePending: userGateFromPayload(conversationId, payload),
            }));
          },
          onError: (_code, msg) => {
            resumeDone = true;
            antMessage.error(msg);
            patchConversationUi(conversationId, (prev) => ({ ...prev, gatePending: null }));
          },
          onCancelled: () => undefined,
          onDone: () => {
            resumeDone = true;
            setSessions((prev) =>
              prev.map((s) =>
                s.id === conversationId
                  ? { ...s, is_generating: false, generating_started_at: null }
                  : s,
              ),
            );
            patchConversationUi(conversationId, (prev) => ({
              ...prev,
              gatePending: prev.gatePending,
              messages: prev.messages.map((m) =>
                getMetaBoolean(m.metadata, 'streaming') || getMetaBoolean(m.metadata, 'awaiting_gate')
                  ? { ...m, metadata: { ...m.metadata, streaming: false, awaiting_gate: false } }
                  : m,
              ),
            }));
            void loadMessages(conversationId, { force: true });
          },
        },
        controller.signal,
      );
      if (!resumeDone) {
        antMessage.error('续跑连接意外中断');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '续跑失败';
      if (msg === 'conversation_busy') {
        antMessage.warning('会话正在处理中，请勿重复提交');
      } else {
        antMessage.error(msg);
      }
    } finally {
      gateResumeInFlightRef.current = false;
      dismissedGateIdDuringResumeRef.current = null;
      gateResumeControllerRef.current = null;
      setConversationLoading(conversationId, false);
      void loadMessages(conversationId, { force: true });
      focusComposerIfActive(conversationId);
    }
  };

  const cancelUserGate = async () => {
    if (!activeConversationId || !gatePending || gateCancelling) return;
    const conversationId = activeConversationId;
    const pending = gatePending;
    setGateCancelling(true);
    try {
      await cancelGate(conversationId, pending.turnId, pending.gateId);
      patchConversationUi(conversationId, (prev) => ({ ...prev, gatePending: null }));
      setGatePending(null);
      setSessions((prev) =>
        prev.map((s) =>
          s.id === conversationId
            ? { ...s, is_generating: false, awaiting_user_gate: false, generating_started_at: null }
            : s,
        ),
      );
      void loadMessages(conversationId, { force: true });
      antMessage.info('已取消验证');
    } catch (err) {
      antMessage.error(err instanceof Error ? err.message : '取消失败');
    } finally {
      setGateCancelling(false);
    }
  };

  useEffect(() => {
    return () => {
      streamsByConversationRef.current.forEach((stream) => stream.controller.abort());
      streamsByConversationRef.current.clear();
      pendingPreviewRevokeRef.current.forEach((url) => URL.revokeObjectURL(url));
      pendingPreviewRevokeRef.current.clear();
    };
  }, []);

  const onUpload = async (file: File, imageOnly = false) => {
    if (imageOnly && !isImageMime(file.type)) {
      antMessage.warning('请选择图片文件');
      return Upload.LIST_IGNORE;
    }
    if (!imageOnly && isImageMime(file.type) && !supportsVision) {
      antMessage.warning('当前模型不支持识图');
      return Upload.LIST_IGNORE;
    }
    let conversationId: number;
    try {
      conversationId = await ensureConversationId();
    } catch (err) {
      antMessage.error(err instanceof Error ? err.message : '创建会话失败');
      return Upload.LIST_IGNORE;
    }
    try {
      const uploaded = await uploadAttachment(conversationId, file);
      const preview_url = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;
      setAttachments((prev) => [...prev, { ...uploaded, mime_type: uploaded.mime_type || file.type, preview_url }]);
      antMessage.success(`已上传：${uploaded.filename}`);
    } catch (err) {
      antMessage.error(err instanceof Error ? err.message : '附件上传失败');
    }
    return Upload.LIST_IGNORE;
  };

  const copyAnswer = async (message: ChatMessageView) => {
    const { content } = resolveAssistantParts(message);
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      antMessage.success('已复制回答');
    } catch {
      antMessage.error('复制失败');
    }
  };

  const renderMessageContent = (
    message: ChatMessageView,
    turnStartedAt: number | null,
    bodyContent?: string,
  ) => {
    const streaming = getMetaBoolean(message.metadata, 'streaming');
    const { think, content: resolvedContent } = resolveAssistantParts(message);
    const content = bodyContent ?? resolvedContent;
    const isAssistant = message.role === 'assistant';
    const msgAttachments = getMessageAttachments(message.metadata);
    const showWorkingStatus = streaming && isAssistant && !content.trim() && !think.trim();
    const awaitingGate =
      getMetaBoolean(message.metadata, 'awaiting_gate') ||
      (isAssistant && effectiveAwaitingUserGate);

    return (
      <>
        {msgAttachments.length > 0 && <MessageAttachmentList attachments={msgAttachments} />}
        {showWorkingStatus ? (
          <TurnWorkingStatus
            visible
            toolSteps={effectiveToolSteps}
            think={think}
            content={content}
            startedAt={turnStartedAt}
            awaitingUserGate={awaitingGate}
          />
        ) : null}
        {isAssistant && think && (
          <details className="studio-bubble__think" open={streaming}>
            <summary>思考过程</summary>
            <div className="studio-bubble__markdown">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{think}</ReactMarkdown>
            </div>
          </details>
        )}
        {content && (
          <div className="studio-bubble__markdown">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        )}
      </>
    );
  };

  if (booting) {
    return (
      <PageScaffold immersive>
        <div className="studio-chat" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Spin size="large" />
        </div>
      </PageScaffold>
    );
  }

  // 搜索时不分组直接平铺；否则按时间分组
  const sessionGroups: SessionGroup[] = searchQuery.trim()
    ? filteredSessions.length > 0
      ? [{ label: `搜索结果 (${filteredSessions.length})`, items: filteredSessions }]
      : []
    : groupSessions(filteredSessions);

  return (
    <PageScaffold immersive>
      <div className="studio-chat">

        {/* ── 左侧栏 ── */}
        <aside className="studio-chat__sidebar">
          <div className="studio-chat__sidebar-top">
            <Button
              type="primary"
              className="studio-chat__new-btn"
              block
              icon={<PlusOutlined />}
              onClick={() => void newSession()}
            >
              新对话
            </Button>

            <label className="studio-chat__search">
              <SearchOutlined className="studio-chat__search-icon" />
              <input
                type="text"
                placeholder="搜索对话..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </label>
          </div>

          {/* 时间筛选标签（搜索模式下隐藏） */}
          {!searchQuery.trim() && (
            <div className="studio-chat__filter-tabs">
              {TIME_FILTER_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={`studio-chat__filter-tab${sessionFilter === tab.key ? ' studio-chat__filter-tab--active' : ''}`}
                  onClick={() => setSessionFilter(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          <div className="studio-chat__sessions">
            {sessionGroups.length === 0 && (
              <div className="studio-chat__empty">
                {searchQuery ? '无匹配结果' : '暂无对话'}
              </div>
            )}
            {sessionGroups.map((group) => (
              <div key={group.label}>
                {/* 搜索结果 label 不用 uppercase 样式 */}
                <div className="studio-chat__section-label">{group.label}</div>
                {group.items.map((s) => (
                  <SessionListItem
                    key={s.id}
                    session={s}
                    active={s.id === activeConversationId}
                    busy={loadingConversationIds.has(s.id)}
                    onSelect={selectSession}
                    onRenamed={(id, title) =>
                      setSessions((prev) => prev.map((x) => (x.id === id ? { ...x, title } : x)))
                    }
                    onDeleted={handleSessionDeleted}
                  />
                ))}
              </div>
            ))}
          </div>

          <div className="studio-chat__sidebar-bottom">
            <button type="button" className="studio-chat__trash-btn">
              <DeleteOutlined />
              回收站
            </button>
          </div>
        </aside>

        {/* ── 中间内容区 ── */}
        <section className="studio-chat__main">
          {/* 标题栏 */}
          {activeSession && (
            <div className="studio-chat__title-bar">
              <span className="studio-chat__title">{activeSession.title}</span>
            </div>
          )}

          <div className="studio-chat__content">
            {/* 消息列表 */}
            <div
              className="studio-chat__messages"
              ref={messagesContainerRef}
              onScroll={handleMessagesScroll}
            >
              {activeConversationId == null && (
                <div className="studio-chat__empty">
                  <p>点击「新对话」或直接输入发送以开始</p>
                </div>
              )}
              {visibleMessages(messages).map((m) => {
                const isActiveUserTurn = m.role === 'user' && isActiveTurnMessage(m);
                const userTurnTimeline =
                  m.role === 'user'
                    ? resolveTurnTimelineForUser(m, messages, liveTurnId, liveTurnTimeline, {
                        mergeLive: isActiveUserTurn,
                      })
                    : [];
                const turnStartedAt =
                  m.role === 'assistant' &&
                  getMetaString(m.metadata, 'client_turn_id') === liveTurnId
                    ? liveTurnStartedAt
                    : null;
                const assistantBodyContent =
                  streamingAssistantMessage?.id === m.id ? streamingBodyContent : undefined;
                return (
                  <Fragment key={m.id}>
                    <div
                      className={`studio-bubble studio-bubble--${m.role === 'assistant' ? 'assistant' : 'user'}`}
                    >
                      {renderMessageContent(m, turnStartedAt, assistantBodyContent)}
                      {m.role === 'assistant' && (assistantBodyContent ?? resolveAssistantParts(m).content) && (
                        <div className="studio-bubble__actions">
                          <button
                            type="button"
                            className="studio-bubble__action-btn"
                            onClick={() => void copyAnswer(m)}
                            title="复制回答"
                          >
                            <CopyOutlined />
                          </button>
                        </div>
                      )}
                    </div>
                    {m.role === 'user' && userTurnTimeline.length > 0 ? (
                      <div className="studio-turn-progress">
                        <ToolRunTimeline
                          items={userTurnTimeline}
                          turnInProgress={isActiveUserTurn}
                        />
                      </div>
                    ) : null}
                  </Fragment>
                );
              })}
              {showServerGeneratingBubble ? (
                <div className="studio-bubble studio-bubble--assistant">
                  <TurnWorkingStatus
                    visible
                    toolSteps={effectiveToolSteps}
                    think=""
                    content=""
                    startedAt={effectiveTurnStartedAt}
                    awaitingUserGate={effectiveAwaitingUserGate}
                  />
                </div>
              ) : null}
              <div ref={messagesEndRef} />
            </div>

            {/* 输入框 */}
            <footer className="studio-chat__composer">
              <div className="studio-composer-box">
                {modelVisionHint && (
                  <div className="studio-composer-box__notice">{modelVisionHint}</div>
                )}
                <ComposerAttachmentList
                  attachments={attachments}
                  onRemove={(attachmentId) =>
                    setAttachments((prev) => {
                      const target = prev.find((item) => item.attachment_id === attachmentId);
                      if (target?.preview_url) URL.revokeObjectURL(target.preview_url);
                      return prev.filter((item) => item.attachment_id !== attachmentId);
                    })
                  }
                />
                <div className="studio-composer-box__input">
                  <textarea
                    ref={composerInputRef}
                    className="studio-composer-box__textarea"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="描述你的想法…"
                    disabled={conversationBusy}
                    rows={1}
                    onInput={(e) => {
                      const t = e.currentTarget;
                      t.style.height = 'auto';
                      t.style.height = `${Math.min(t.scrollHeight, 180)}px`;
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        void send();
                      }
                    }}
                  />
                </div>
                <div className="studio-composer-box__footer">
                  <div className="studio-composer-box__footer-left">
                    {/* 图片 + 文件合并上传 */}
                    <Upload
                      beforeUpload={(f) => void onUpload(f, false)}
                      showUploadList={false}
                      disabled={conversationBusy}
                    >
                      <button
                        type="button"
                        className="studio-composer-tool"
                        disabled={conversationBusy}
                        title="上传图片或文件"
                      >
                        <PictureOutlined />
                        图片 / 文件
                      </button>
                    </Upload>
                  </div>

                  <div className="studio-composer-box__footer-right">
                    <Select
                      className="studio-composer-box__model"
                      popupMatchSelectWidth={false}
                      value={selectedModel || undefined}
                      onChange={handleModelChange}
                      disabled={conversationBusy || models.length === 0}
                      options={models.map((m) => ({ value: m.key, label: m.display_name }))}
                    />
                    <button
                      type="button"
                      className={`studio-composer-box__send${conversationBusy ? ' studio-composer-box__send--stop' : ''}`}
                      onClick={() => (conversationBusy ? void cancelInFlightTurn() : void send())}
                      disabled={!conversationBusy && !input.trim() && attachmentIdsForSend.length === 0}
                      aria-label={conversationBusy ? '停止生成' : '发送'}
                      title={conversationBusy ? '停止生成' : '发送'}
                    >
                      {conversationBusy ? <StopOutlined /> : <ArrowUpOutlined />}
                    </button>
                  </div>
                </div>
              </div>
              <p className="studio-composer-disclaimer">
                Nexus Studio 由 AI 生成内容，可能出现错误，请核实重要信息。
              </p>
            </footer>
          </div>
        </section>

        {/* ── 右侧资源面板 ── */}
        <ChatRightPanel
          messages={messages}
          onAddRef={() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.onchange = async (e) => {
              const file = (e.target as HTMLInputElement).files?.[0];
              if (file) await onUpload(file, false);
            };
            input.click();
          }}
        />
      </div>
      {gatePending && (
        <UserGatePanel
          gate={gatePending}
          open
          submitting={false}
          cancelling={gateCancelling}
          onSubmit={(fields) => void submitUserGate(fields)}
          onCancel={() => void cancelUserGate()}
        />
      )}
    </PageScaffold>
  );
}
