import {
  CopyOutlined,
  FolderOpenOutlined,
  MenuOutlined,
  PlusOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { Button, Drawer, Grid, Spin, Upload, message as antMessage } from 'antd';
import dayjs from 'dayjs';
import { useCallback, useEffect, useMemo, useRef, useState, Fragment } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { DEFAULT_CHAT_MODEL_KEY } from '../../canvas/lib/chatModelKey';
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
import { StudioChip } from '../../../shared/ui/StudioChip';
import { useStudioApp } from '../../../shared/ui/useStudioApp';
import { ChatComposerBox } from '../components/ChatComposerBox';
import {
  UnifiedChatSidePanel,
  type UnifiedSidePanelTab,
} from '../components/UnifiedChatSidePanel';
import { useChatSidePanelWidth } from '../hooks/useChatSidePanelWidth';
import { UserGatePanel, type UserGateState } from '../components/UserGatePanel';
import { TurnWorkingStatus } from '../components/TurnWorkingStatus';
import { MessageAttachmentList, getMessageAttachments } from '../components/MessageAttachmentList';
import { SessionListItem } from '../components/SessionListItem';
import { ToolRunTimeline } from '../components/ToolRunTimeline';
import {
  clearChatSelectedExpert,
  getChatSelectedExpert,
  getWorkshopProjectByChat,
  inviteWorkshopExpert,
  listExpertDirectory,
  listWorkshopConnectors,
  listWorkshopProjects,
  listWorkshopRoomMembers,
  listWorkshopRoster,
  setChatSelectedExpert,
  upgradeWorkshopFromExpert,
  upgradeWorkshopProject,
  confirmUpgradeInvite,
  declineUpgradeInvite,
  getPendingUpgradeInvite,
  addWorkshopPreset,
  beginWorkshopShopAuth,
  type ExpertDirectoryEntry,
  type WorkshopConnectorEntry,
  type WorkshopProjectView,
  type WorkshopRoomMemberView,
  type WorkshopRosterExpertView,
} from '../../../api/workshop';
import {
  confirmInviteUpgradeCopy,
} from '../../workshop/utils/inviteExpertFlow';
import {
  UpgradeInviteConfirmModal,
  type UpgradeInviteProposedPayload,
} from '../../workshop/components/UpgradeInviteConfirmModal';
import {
  findExpertByKey,
  resolveSpeakerAttribution,
} from '../../workshop/utils/expertDirectory';
import {
  buildRoomRecipientExperts,
  resolveRoomTurnTargetExpertId,
} from '../../workshop/utils/turnRouting';
import {
  FOYER_HANDOFF_STATE_KEY,
  isFoyerAgentHandoff,
  type LocationStateWithFoyerHandoff,
} from '../../home/foyerHandoff';
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
import { buildMaterialsFromUploads, isVisionMime } from '../buildUploadMaterials';
import { buildTurnUserInput, compileHumanTextFromBlocks } from '../../skills/serializeTurnContent';
import { UserMessageContent } from '../../skills/UserMessageContent';

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
  if (lower.endsWith('.png')) {
    mimeType = 'image/png';
  } else if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
    mimeType = 'image/jpeg';
  } else if (lower.endsWith('.gif')) {
    mimeType = 'image/gif';
  } else if (lower.endsWith('.webp')) {
    mimeType = 'image/webp';
  } else if (lower.endsWith('.bmp')) {
    mimeType = 'image/bmp';
  } else if (lower.endsWith('.svg')) {
    mimeType = 'image/svg+xml';
  } else if (lower.endsWith('.docx')) {
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
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { modal } = useStudioApp();
  const [input, setInput] = useState('');
  const [selectedSkillPaths, setSelectedSkillPaths] = useState<string[]>([]);
  const [selectedExpertKey, setSelectedExpertKey] = useState<string | null>(null);
  const [expertDirectory, setExpertDirectory] = useState<ExpertDirectoryEntry[]>([]);
  const [workshopConnectors, setWorkshopConnectors] = useState<WorkshopConnectorEntry[]>([]);
  const [expertsLoading, setExpertsLoading] = useState(false);
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
  const [upgradeInviteProposed, setUpgradeInviteProposed] =
    useState<UpgradeInviteProposedPayload | null>(null);
  const [upgradeInviteConfirming, setUpgradeInviteConfirming] = useState(false);
  const [modelVisionHint, setModelVisionHint] = useState<string | null>(null);
  const [workshopProject, setWorkshopProject] = useState<WorkshopProjectView | null>(null);
  const [workshopProjects, setWorkshopProjects] = useState<WorkshopProjectView[]>([]);
  const [workshopRoster, setWorkshopRoster] = useState<WorkshopRosterExpertView[]>([]);
  const [workshopRoomMembers, setWorkshopRoomMembers] = useState<WorkshopRoomMemberView[]>([]);
  const [sidePanelTab, setSidePanelTab] = useState<UnifiedSidePanelTab>('overview');
  const [pendingShopAuth, setPendingShopAuth] = useState(false);
  const [shopAuthBusy, setShopAuthBusy] = useState(false);
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [conversationListOpen, setConversationListOpen] = useState(false);
  const screens = Grid.useBreakpoint();
  const layoutCompact = !screens.lg;
  const showSidePanelColumn = sidePanelOpen && !layoutCompact;
  const sidePanelWidth = useChatSidePanelWidth('nexus-chat-side-panel-width');
  const [loadingConversationIds, setLoadingConversationIds] = useState<Set<number>>(() => new Set());
  const [booting, setBooting] = useState(true);
  const uiByConversationRef = useRef<Map<number, ConversationUiState>>(new Map());
  const streamsByConversationRef = useRef<
    Map<number, { turnId: string; controller: AbortController }>
  >(new Map());
  const gateResumeInFlightRef = useRef(false);
  const gateResumeControllerRef = useRef<AbortController | null>(null);
  const foyerHandoffConsumedRef = useRef(false);
  const sendTurnRef = useRef<
    ((options?: {
      text?: string;
      model?: string;
      conversationId?: number;
      attachments?: UploadedAttachment[];
    }) => Promise<void>) | null
  >(null);
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
  const turnStartedAtFallbackRef = useRef<number | null>(null);

  const focusComposerIfActive = useCallback((_conversationId: number) => {
    // 输入焦点由 ChatComposerBox 自持；会话切换后不强抢焦点。
  }, []);

  const activeSession = sessions.find((s) => s.id === activeConversationId);

  const activeConversationLoading =
    activeConversationId != null && loadingConversationIds.has(activeConversationId);
  const serverGenerating = Boolean(activeSession?.is_generating) && !activeConversationLoading;
  const awaitingUserGate = Boolean(activeSession?.awaiting_user_gate) || gatePending != null;
  const awaitingUpgradeInvite =
    Boolean(activeSession?.awaiting_upgrade_invite) || upgradeInviteProposed != null;
  const conversationBusy =
    activeConversationLoading
    || Boolean(activeSession?.is_generating)
    || awaitingUpgradeInvite;
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

  const refreshWorkshopProjects = useCallback(async () => {
    try {
      const res = await listWorkshopProjects();
      setWorkshopProjects(res.items ?? []);
    } catch {
      // ignore list errors on soft refresh
    }
  }, []);

  const resolveWorkshopForConversation = useCallback(async (conversationId: number | null) => {
    if (conversationId == null) {
      setWorkshopProject(null);
      return;
    }
    try {
      const res = await getWorkshopProjectByChat(conversationId);
      setWorkshopProject(res.project ?? null);
      if (res.project) {
        setSidePanelOpen(true);
      }
    } catch {
      setWorkshopProject(null);
    }
  }, []);

  useEffect(() => {
    void refreshWorkshopProjects();
  }, [refreshWorkshopProjects]);

  useEffect(() => {
    void resolveWorkshopForConversation(activeConversationId);
  }, [activeConversationId, resolveWorkshopForConversation]);

  const refreshWorkshopRoster = useCallback(async (projectId: string) => {
    try {
      const [rosterRes, roomRes] = await Promise.all([
        listWorkshopRoster(projectId),
        listWorkshopRoomMembers(projectId),
      ]);
      setWorkshopRoster(rosterRes.items ?? []);
      setWorkshopRoomMembers(roomRes.items ?? []);
    } catch {
      setWorkshopRoster([]);
      setWorkshopRoomMembers([]);
    }
  }, []);

  useEffect(() => {
    if (!workshopProject) {
      setWorkshopRoster([]);
      setWorkshopRoomMembers([]);
      return;
    }
    void refreshWorkshopRoster(workshopProject.id);
  }, [refreshWorkshopRoster, workshopProject?.id]);

  const speakerRoster = useMemo(
    () =>
      workshopRoster.map((expert) => ({
        id: expert.id,
        name:
          (expert as { display_name?: string | null }).display_name?.trim() ||
          expert.name ||
          expert.id,
        avatar_url:
          (expert as { avatar_id?: string | null }).avatar_id != null
            ? `/avatars/experts/${(expert as { avatar_id?: string | null }).avatar_id}.png`
            : findExpertByKey(expert.preset_key ?? '')?.avatar_url,
        preset_key: expert.preset_key ?? null,
      })),
    [workshopRoster],
  );

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
    const hasVisionAttachments = attachments.some((item) => isVisionMime(item.mime_type));
    if (!nextSupportsVision && hasVisionAttachments) {
      setModelVisionHint('当前模型不支持识图，已上传的图片和视频将不会被发送');
    } else {
      setModelVisionHint(null);
    }
  };

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
    if (!selectedModel) {
      throw new Error('请先选择模型');
    }
    const conv = await createConversation({
      title: DEFAULT_CONVERSATION_TITLE,
      model: selectedModel,
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
        const preferred = modelList.find((m) => m.key === DEFAULT_CHAT_MODEL_KEY);
        if (preferred) setSelectedModel(preferred.key);
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
      Boolean(activeSession?.is_generating)
      || Boolean(activeSession?.awaiting_user_gate)
      || Boolean(activeSession?.awaiting_upgrade_invite);
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
    activeSession?.awaiting_upgrade_invite,
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

  // 刷新/切会话：仍有 pending 升级邀请时恢复弹窗
  useEffect(() => {
    if (activeConversationId == null || activeConversationLoading) {
      return;
    }
    if (!activeSession?.awaiting_upgrade_invite) {
      return;
    }
    if (upgradeInviteProposed?.conversation_id === activeConversationId) {
      return;
    }
    const conversationId = activeConversationId;
    void (async () => {
      try {
        const pending = await getPendingUpgradeInvite({ conversation_id: conversationId });
        if (pending.proposal == null) {
          setSessions((prev) =>
            prev.map((s) =>
              s.id === conversationId ? { ...s, awaiting_upgrade_invite: false } : s,
            ),
          );
          return;
        }
        setUpgradeInviteProposed(pending.proposal);
      } catch (err) {
        antMessage.error(err instanceof Error ? err.message : '恢复升级邀请失败');
      }
    })();
  }, [
    activeConversationId,
    activeConversationLoading,
    activeSession?.awaiting_upgrade_invite,
    upgradeInviteProposed?.conversation_id,
  ]);

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
    setSelectedSkillPaths([]);
    setUpgradeInviteProposed(null);
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
      setSelectedSkillPaths([]);
    }
  };

  const newSession = async () => {
    try {
      if (!selectedModel) {
        antMessage.error('请先选择模型');
        return;
      }
      if (activeConversationId != null) {
        saveUiToCache(activeConversationId);
      }
      const conv = await createConversation({
        title: DEFAULT_CONVERSATION_TITLE,
        model: selectedModel,
      });
      const items = await loadSessions();
      setSessions(items);
      uiByConversationRef.current.set(conv.id, { ...EMPTY_CONVERSATION_UI });
      setActiveConversationId(conv.id);
      setSelectedSkillPaths([]);
      applyUiFromCache(conv.id);
      setWorkshopProject(null);
    } catch (err) {
      antMessage.error(err instanceof Error ? err.message : '创建会话失败');
    }
  };

  useEffect(() => {
    setExpertsLoading(true);
    void Promise.all([
      listExpertDirectory(),
      listWorkshopConnectors({ project_id: workshopProject?.id }),
    ])
      .then(([expertsRes, connectorsRes]) => {
        setExpertDirectory(expertsRes.items ?? []);
        setWorkshopConnectors(connectorsRes.items ?? []);
      })
      .catch((err) => {
        antMessage.error(err instanceof Error ? err.message : '专家目录加载失败');
      })
      .finally(() => setExpertsLoading(false));
  }, [workshopProject?.id]);

  useEffect(() => {
    if (activeConversationId == null) {
      setSelectedExpertKey(null);
      return;
    }
    void getChatSelectedExpert(activeConversationId)
      .then((res) => setSelectedExpertKey(res.expert_key))
      .catch(() => setSelectedExpertKey(null));
  }, [activeConversationId]);

  const selectedExpert = useMemo(() => {
    if (!selectedExpertKey || selectedExpertKey === 'host') return null;
    if (workshopProject) {
      const rosterExpert =
        workshopRoster.find((item) => item.preset_key === selectedExpertKey) ??
        workshopRoster.find((item) => item.id === selectedExpertKey);
      if (!rosterExpert) return null;
      const roomMember = workshopRoomMembers.find((item) => item.expert_id === rosterExpert.id);
      if (!roomMember) return null;
      return {
        key: selectedExpertKey,
        name: roomMember.name ?? rosterExpert.name,
        avatarUrl:
          roomMember.avatar_url ||
          findExpertByKey(rosterExpert.preset_key ?? selectedExpertKey)?.avatar_url ||
          '/avatars/experts/host.png',
      };
    }
    const expert =
      expertDirectory.find((item) => item.key === selectedExpertKey) ??
      findExpertByKey(selectedExpertKey);
    if (!expert) return null;
    return {
      key: expert.key,
      name: expert.name,
      avatarUrl: expert.avatar_url,
    };
  }, [expertDirectory, selectedExpertKey, workshopProject, workshopRoomMembers, workshopRoster]);

  const applySingleExpertSelection = useCallback(
    async (expertKey: string) => {
      if (activeConversationId == null) {
        antMessage.warning('请先选择或创建会话');
        return;
      }
      await setChatSelectedExpert(activeConversationId, expertKey);
      setSelectedExpertKey(expertKey);
    },
    [activeConversationId],
  );

  const handleInviteExpert = useCallback(
    (expertKey: string) => {
      const expertMeta =
        expertDirectory.find((item) => item.key === expertKey) ?? findExpertByKey(expertKey);
      const expertName = expertMeta?.name ?? expertKey;

      if (!workshopProject) {
        const copy = confirmInviteUpgradeCopy(expertName);
        modal.confirm({
          title: copy.title,
          content: copy.content,
          okText: copy.okText,
          cancelText: '取消',
          onOk: async () => {
            if (activeConversationId == null) {
              antMessage.warning('请先选择或创建会话');
              return;
            }
            try {
              const result = await upgradeWorkshopFromExpert({
                conversation_id: activeConversationId,
                expert_key: expertKey,
                project_name: activeSession?.title || expertName,
                carried_message_count: messages.length,
              });
              await clearChatSelectedExpert(activeConversationId);
              setSelectedExpertKey(null);
              setWorkshopProject(result.project);
              setSidePanelOpen(true);
              setSidePanelTab('members');
              await refreshWorkshopProjects();
              await refreshWorkshopRoster(result.project.id);
            } catch (err) {
              antMessage.error(err instanceof Error ? err.message : '邀请失败');
              throw err;
            }
          },
        });
        return;
      }

      void (async () => {
        try {
          const [roster, room] = await Promise.all([
            listWorkshopRoster(workshopProject.id),
            listWorkshopRoomMembers(workshopProject.id),
          ]);
          let rosterExpert =
            roster.items.find((item) => item.preset_key === expertKey) ??
            roster.items.find((item) => item.id === expertKey);
          if (!rosterExpert) {
            rosterExpert = await addWorkshopPreset(workshopProject.id, expertKey);
          }
          const inRoom = room.items.some((member) => member.expert_id === rosterExpert!.id);
          if (!inRoom) {
            await inviteWorkshopExpert(workshopProject.id, rosterExpert.id);
          }
          await refreshWorkshopRoster(workshopProject.id);
          setSidePanelOpen(true);
          setSidePanelTab('members');
          antMessage.success(`已邀请「${expertName}」进房间`);
        } catch (err) {
          antMessage.error(err instanceof Error ? err.message : '邀请失败');
        }
      })();
    },
    [
      activeConversationId,
      activeSession?.title,
      expertDirectory,
      messages.length,
      modal,
      refreshWorkshopProjects,
      refreshWorkshopRoster,
      workshopProject,
    ],
  );

  const handleExpertSelect = useCallback(
    (expertKey: string) => {
      if (!workshopProject) {
        handleInviteExpert(expertKey);
        return;
      }
      const recipients = buildRoomRecipientExperts({
        roomMembers: workshopRoomMembers,
        roster: workshopRoster,
      });
      if (!recipients.some((item) => item.key === expertKey)) {
        antMessage.warning('请先邀请该专家进入房间，再选择发给');
        return;
      }
      void applySingleExpertSelection(expertKey).catch((err) => {
        antMessage.error(err instanceof Error ? err.message : '选择专家失败');
      });
    },
    [
      applySingleExpertSelection,
      handleInviteExpert,
      workshopProject,
      workshopRoomMembers,
      workshopRoster,
    ],
  );

  const handleClearSelectedExpert = useCallback(async () => {
    if (activeConversationId == null) {
      setSelectedExpertKey(null);
      return;
    }
    await clearChatSelectedExpert(activeConversationId);
    setSelectedExpertKey(null);
  }, [activeConversationId]);

  const composerExperts = useMemo(() => {
    if (!workshopProject) {
      return {
        loading: expertsLoading,
        items: expertDirectory.filter((item) => item.key !== 'host'),
        selectedKey: selectedExpertKey,
        onSelect: handleExpertSelect,
        onBrowseMore: () => {
          setSidePanelOpen(true);
          setSidePanelTab('members');
        },
        menuLabel: '发给',
      };
    }
    return {
      loading: expertsLoading,
      items: buildRoomRecipientExperts({
        roomMembers: workshopRoomMembers,
        roster: workshopRoster,
      }),
      selectedKey: selectedExpertKey,
      onSelect: handleExpertSelect,
      onBrowseMore: () => {
        setSidePanelOpen(true);
        setSidePanelTab('members');
      },
      menuLabel: '发给',
    };
  }, [
    expertDirectory,
    expertsLoading,
    handleExpertSelect,
    selectedExpertKey,
    workshopProject,
    workshopRoomMembers,
    workshopRoster,
  ]);

  const beginTaobaoShopAuth = useCallback(async () => {
    if (activeConversationId == null) {
      antMessage.warning('请先选择或创建会话');
      return;
    }
    setShopAuthBusy(true);
    try {
      let project = workshopProject;
      if (!project) {
        const upgraded = await upgradeWorkshopProject({
          group_chat_id: activeConversationId,
          project_name: activeSession?.title || '新项目',
          carried_message_count: messages.length,
        });
        project = upgraded.project;
        setWorkshopProject(project);
        await refreshWorkshopProjects();
        setSidePanelOpen(true);
        setSidePanelTab('connect');
      }
      const result = await beginWorkshopShopAuth(project.id);
      if (!result.authorize_url) {
        antMessage.error('当前环境未配置淘宝应用');
        return;
      }
      window.open(result.authorize_url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      antMessage.error(err instanceof Error ? err.message : '连接淘宝店铺失败');
    } finally {
      setShopAuthBusy(false);
    }
  }, [
    activeConversationId,
    activeSession?.title,
    messages.length,
    refreshWorkshopProjects,
    workshopProject,
  ]);

  useEffect(() => {
    const workshopId = searchParams.get('workshop');
    if (!workshopId || workshopProjects.length === 0) return;
    const project = workshopProjects.find((item) => item.id === workshopId);
    if (!project) return;
    const chatId = project.group_chat_id;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('workshop');
        return next;
      },
      { replace: true },
    );
    if (activeConversationId !== chatId) {
      void selectSession(chatId);
    }
    // Intentionally omit selectSession from deps: deep-link runs once per workshop query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workshopProjects, searchParams]);

  const send = async (options?: {
    text?: string;
    model?: string;
    conversationId?: number;
    attachments?: UploadedAttachment[];
  }) => {
    const text = (options?.text ?? input).trim();
    const skillPaths = options?.text != null ? [] : selectedSkillPaths;
    // content[] 须含非空文本块；仅附件不可发空 content（与后端 min_length / validate 对齐）
    if (!text) {
      if (skillPaths.length > 0) {
        antMessage.warning('引用技能后须填写说明文字');
      }
      return;
    }
    const model = options?.model ?? selectedModel;
    if (!model) {
      antMessage.error('暂无可用模型，请稍后重试');
      return;
    }
    const currentAttachments = options?.attachments ?? attachments;
    const modelSupportsVision = models.find((item) => item.key === model)?.supports_vision === true;
    if (currentAttachments.some((item) => isVisionMime(item.mime_type)) && !modelSupportsVision) {
      antMessage.error('当前模型不支持识图，无法发送图片或视频');
      return;
    }

    let conversationId: number;
    try {
      if (options?.conversationId != null) {
        conversationId = options.conversationId;
        if (activeConversationIdRef.current !== conversationId) {
          setActiveConversationId(conversationId);
          applyUiFromCache(conversationId);
        }
      } else {
        conversationId = await ensureConversationId();
      }
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

    const sentMaterials = buildMaterialsFromUploads(currentAttachments, {
      supportsVision: modelSupportsVision,
    });
    const sentAttachments: MessageAttachment[] = currentAttachments.map((item) => ({
      attachment_id: item.attachment_id,
      filename: item.filename,
      mime_type: item.mime_type,
      preview_url: item.preview_url,
    }));
    queuePreviewUrlForDelayedRevoke(sentAttachments.map((item) => item.preview_url));
    const userInput = buildTurnUserInput(text, skillPaths, sentMaterials);
    const turnContent = userInput.content;
    if (isActiveConversation()) {
      setInput('');
      setSelectedSkillPaths([]);
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
          content: compileHumanTextFromBlocks(turnContent),
          input: userInput,
          metadata: { client_turn_id: turnId, attachments: sentAttachments, input: userInput },
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
    let upgradeInviteInterrupted = false;

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
      onSpeakerAttribution: (payload: {
        speaker_role?: string | null;
        expert_id?: string | null;
        expert_name?: string | null;
        avatar?: string | null;
        task_id?: string | null;
      }) => {
        if (!isCurrentTurn()) return;
        patchConversationUi(conversationId, (prev) => ({
          ...prev,
          messages: prev.messages.map((m) => {
            if (m.id !== assistantTempId) return m;
            return {
              ...m,
              metadata: {
                ...m.metadata,
                ...(payload.speaker_role ? { speaker_role: payload.speaker_role } : {}),
                ...(payload.expert_id ? { expert_id: payload.expert_id } : {}),
                ...(payload.expert_name ? { expert_name: payload.expert_name } : {}),
                ...(payload.avatar ? { avatar: payload.avatar } : {}),
                ...(payload.task_id ? { task_id: payload.task_id } : {}),
              },
            };
          }),
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
      onUpgradeInviteProposed: (payload: {
        turn_id: string;
        proposal_id: number;
        conversation_id: number;
        expert_keys: string[];
        primary_expert_key: string;
        rationale: string;
        experts: Array<{ key: string; name: string }>;
      }) => {
        if (!isCurrentTurn()) return;
        upgradeInviteInterrupted = true;
        setUpgradeInviteProposed({
          proposal_id: payload.proposal_id,
          conversation_id: payload.conversation_id,
          expert_keys: payload.expert_keys,
          primary_expert_key: payload.primary_expert_key,
          rationale: payload.rationale,
          experts: payload.experts.filter(
            (item: { key: string; name: string }) => item.key && item.name,
          ),
        });
        patchConversationUi(conversationId, (prev) => {
          const flushed = flushAssistantNarration(prev, assistantTempId);
          return {
            ...flushed,
            messages: flushed.messages.map((m) =>
              m.id === assistantTempId
                ? {
                    ...m,
                    metadata: {
                      ...m.metadata,
                      streaming: false,
                      awaiting_upgrade_invite: true,
                    },
                  }
                : m,
            ),
          };
        });
        setSessions((prev) =>
          prev.map((s) =>
            s.id === conversationId
              ? {
                  ...s,
                  is_generating: false,
                  awaiting_upgrade_invite: true,
                  generating_started_at: null,
                }
              : s,
          ),
        );
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
        // 标题可能在首轮 DONE 前到达；按 conversation_id 更新，不依赖 isCurrentTurn
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
        if (upgradeInviteInterrupted) {
          patchConversationUi(conversationId, (prev) => ({
            ...prev,
            liveTurnId: null,
            liveTurnStartedAt: null,
            liveTurnTimeline: [],
            narrationCursor: 0,
            messages: prev.messages.map((m) =>
              m.id === assistantTempId
                ? { ...m, metadata: { ...m.metadata, streaming: false } }
                : m,
            ),
          }));
          setSessions((prev) =>
            prev.map((s) =>
              s.id === conversationId
                ? {
                    ...s,
                    is_generating: false,
                    awaiting_upgrade_invite: true,
                    generating_started_at: null,
                  }
                : s,
            ),
          );
          return;
        }
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
                  awaiting_upgrade_invite: false,
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
      let turnTarget:
        | {
            expert_id?: string | null;
            task_id?: string | null;
            speaker_role?: string | null;
          }
        | undefined;

      if (workshopProject && selectedExpertKey && selectedExpertKey !== 'host') {
        const expertId = resolveRoomTurnTargetExpertId({
          selectedKey: selectedExpertKey,
          roomMembers: workshopRoomMembers,
          roster: workshopRoster,
        });
        if (expertId) {
          turnTarget = { expert_id: expertId };
        } else {
          antMessage.warning('选中的专家尚未进入房间，本轮将由项目助手回复');
        }
      }

      await streamMessage(
        {
          request_id: crypto.randomUUID(),
          conversation_id: conversationId,
          content: turnContent,
          materials: sentMaterials,
          model: model,
          enable_tools: true,
          client_turn_id: turnId,
          ...(turnTarget ? { turn_target: turnTarget } : {}),
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

  sendTurnRef.current = send;

  useEffect(() => {
    if (booting || foyerHandoffConsumedRef.current) return;
    const locationState = location.state as LocationStateWithFoyerHandoff | null;
    const handoff = locationState?.[FOYER_HANDOFF_STATE_KEY];
    if (!isFoyerAgentHandoff(handoff)) return;

    foyerHandoffConsumedRef.current = true;
    navigate(location.pathname, { replace: true, state: {} });

    void (async () => {
      try {
        if (!models.some((item) => item.key === handoff.model)) {
          antMessage.error('模型不可用，无法从首页发起对话');
          return;
        }
        const model = handoff.model;
        setSelectedModel(model);
        if (activeConversationIdRef.current != null) {
          saveUiToCache(activeConversationIdRef.current);
        }
        const conv = await createConversation({
          title: DEFAULT_CONVERSATION_TITLE,
          model,
        });
        const items = await loadSessions();
        setSessions(items);
        uiByConversationRef.current.set(conv.id, { ...EMPTY_CONVERSATION_UI });
        setActiveConversationId(conv.id);
        applyUiFromCache(conv.id);

        const uploaded: UploadedAttachment[] = [];
        for (const file of handoff.files) {
          if (!(file instanceof File)) continue;
          try {
            const result = await uploadAttachment(conv.id, file);
            const preview_url = file.type.startsWith('image/')
              ? URL.createObjectURL(file)
              : undefined;
            uploaded.push({
              ...result,
              mime_type: result.mime_type || file.type,
              preview_url,
            });
          } catch (err) {
            antMessage.error(err instanceof Error ? err.message : '附件上传失败');
          }
        }
        if (uploaded.length > 0) {
          setAttachments(uploaded);
        }

        await sendTurnRef.current?.({
          text: handoff.message,
          model,
          conversationId: conv.id,
          attachments: uploaded,
        });
      } catch (err) {
        antMessage.error(err instanceof Error ? err.message : '无法从首页发起对话');
      }
    })();
  }, [applyUiFromCache, booting, loadSessions, location.pathname, location.state, models, navigate, saveUiToCache]);

  const submitUserGate = async (fields: Record<string, string>) => {
    if (!activeConversationId || !gatePending) return;
    if (!selectedModel) {
      antMessage.error('暂无可用模型，无法继续当前任务');
      return;
    }
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
          request_id: crypto.randomUUID(),
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
    if (!imageOnly && isVisionMime(file.type) && !supportsVision) {
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
        {isAssistant ? (
          (() => {
            const speaker = resolveSpeakerAttribution({
              speaker_role: getMetaString(message.metadata, 'speaker_role'),
              expert_id: getMetaString(message.metadata, 'expert_id'),
              expert_name: getMetaString(message.metadata, 'expert_name'),
              avatar: getMetaString(message.metadata, 'avatar'),
              directory: expertDirectory,
              roster: speakerRoster,
            });
            if (!speaker) return null;
            return (
              <div className="studio-bubble__speaker">
                <img
                  className="studio-bubble__speaker-avatar"
                  src={speaker.avatar_url}
                  alt=""
                  aria-hidden
                />
                <span>{speaker.name}</span>
                {getMetaString(message.metadata, 'task_id') ? ' · 当前工作' : null}
              </div>
            );
          })()
        ) : null}
        {message.role === 'user' ? (
          <UserMessageContent
            content={message.content}
            input={message.input ?? (message.metadata.input as Record<string, unknown> | undefined)}
            hideMaterials={msgAttachments.length > 0}
          />
        ) : null}
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
        {content && isAssistant && (
          <div className="studio-bubble__markdown">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        )}
      </>
    );
  };

  const clearConversationBusy = useCallback((conversationId: number) => {
    setConversationLoading(conversationId, false);
    setSessions((prev) =>
      prev.map((s) =>
        s.id === conversationId
          ? {
              ...s,
              is_generating: false,
              awaiting_upgrade_invite: false,
              awaiting_user_gate: false,
              generating_started_at: null,
            }
          : s,
      ),
    );
  }, [setConversationLoading]);

  const handleConfirmUpgradeInvite = useCallback(
    async (selection: { expert_keys: string[]; primary_expert_key: string }) => {
      if (!upgradeInviteProposed || !activeConversationId) return;
      const conversationId = activeConversationId;
      const expertKeys = selection.expert_keys;
      setUpgradeInviteConfirming(true);
      const proposed = upgradeInviteProposed;
      try {
        const result = await confirmUpgradeInvite({
          conversation_id: proposed.conversation_id,
          proposal_id: proposed.proposal_id,
          expert_keys: expertKeys,
          primary_expert_key:
            expertKeys.length > 0 ? selection.primary_expert_key : '',
          project_name: `工坊 ${dayjs().format('MM-DD HH:mm')}`,
          carried_message_count: messages.length,
        });
        setUpgradeInviteProposed(null);
        setWorkshopProject(result.project);
        const [roster, room] = await Promise.all([
          listWorkshopRoster(result.project.id),
          listWorkshopRoomMembers(result.project.id),
        ]);
        setWorkshopRoster(roster.items ?? []);
        setWorkshopRoomMembers(room.items ?? []);

        // 先刷出 Host 说明；force 避免被 loadingIds 误跳过
        await loadMessages(conversationId, { force: true });

        const continueTurnId = crypto.randomUUID();
        const assistantTempId = nextTempId();
        const controller = new AbortController();
        streamsByConversationRef.current.set(conversationId, {
          turnId: continueTurnId,
          controller,
        });
        const isCurrentTurn = () =>
          streamsByConversationRef.current.get(conversationId)?.turnId === continueTurnId;

        setConversationLoading(conversationId, true);
        setSessions((prev) =>
          prev.map((s) =>
            s.id === conversationId
              ? {
                  ...s,
                  awaiting_upgrade_invite: false,
                  is_generating: true,
                  generating_started_at: new Date().toISOString(),
                }
              : s,
          ),
        );
        patchConversationUi(conversationId, (prev) => ({
          ...prev,
          liveTurnId: continueTurnId,
          liveTurnStartedAt: Date.now(),
          liveTurnTimeline: [],
          narrationCursor: 0,
          messages: [
            ...prev.messages,
            {
              id: assistantTempId,
              role: 'assistant',
              content: '',
              metadata: {
                streaming: true,
                think: '',
                client_turn_id: continueTurnId,
                speaker_role: result.primary_expert_id ? 'expert' : 'host',
                ...(result.primary_expert_id
                  ? {}
                  : { expert_name: '项目助手', avatar: '/avatars/experts/host.png' }),
              },
              created_at: new Date().toISOString(),
            },
          ],
        }));

        let streamDone = false;
        try {
          await streamMessage(
            {
              request_id: crypto.randomUUID(),
              conversation_id: conversationId,
              content: [{ type: 'text', text: result.source_user_text }],
              materials: [],
              model: selectedModel,
              enable_tools: true,
              client_turn_id: continueTurnId,
              turn_target: {
                expert_id: result.primary_expert_id ?? null,
                persist_user_message: false,
              },
            },
            {
              onToken: (channel, delta) => {
                if (!isCurrentTurn()) return;
                if (channel === 'think') {
                  patchConversationUi(conversationId, (prev) => ({
                    ...prev,
                    messages: prev.messages.map((m) => {
                      if (m.id !== assistantTempId) return m;
                      const think = getMetaString(m.metadata, 'think');
                      return {
                        ...m,
                        metadata: { ...m.metadata, think: `${think}${delta}`, streaming: true },
                      };
                    }),
                  }));
                  return;
                }
                patchConversationUi(conversationId, (prev) => ({
                  ...prev,
                  messages: prev.messages.map((m) =>
                    m.id !== assistantTempId
                      ? m
                      : {
                          ...m,
                          content: `${m.content}${delta}`,
                          metadata: { ...m.metadata, streaming: true },
                        },
                  ),
                }));
              },
              onSpeakerAttribution: (payload) => {
                if (!isCurrentTurn()) return;
                patchConversationUi(conversationId, (prev) => ({
                  ...prev,
                  messages: prev.messages.map((m) => {
                    if (m.id !== assistantTempId) return m;
                    return {
                      ...m,
                      metadata: {
                        ...m.metadata,
                        ...(payload.speaker_role ? { speaker_role: payload.speaker_role } : {}),
                        ...(payload.expert_id ? { expert_id: payload.expert_id } : {}),
                        ...(payload.expert_name ? { expert_name: payload.expert_name } : {}),
                        ...(payload.avatar ? { avatar: payload.avatar } : {}),
                        ...(payload.task_id ? { task_id: payload.task_id } : {}),
                      },
                    };
                  }),
                }));
              },
              onToolStart: () => undefined,
              onToolEnd: () => undefined,
              onError: (code, message) => {
                if (!isCurrentTurn()) return;
                antMessage.error(message || code);
              },
              onCancelled: () => undefined,
              onDone: () => {
                if (!isCurrentTurn()) return;
                streamDone = true;
                patchConversationUi(conversationId, (prev) => ({
                  ...prev,
                  liveTurnId: null,
                  liveTurnStartedAt: null,
                  liveTurnTimeline: [],
                  narrationCursor: 0,
                  messages: prev.messages.map((m) =>
                    m.id === assistantTempId
                      ? { ...m, metadata: { ...m.metadata, streaming: false } }
                      : m,
                  ),
                }));
              },
            },
            controller.signal,
          );
          if (isCurrentTurn() && !streamDone) {
            patchConversationUi(conversationId, (prev) => ({
              ...prev,
              messages: prev.messages.filter((m) => m.id !== assistantTempId),
            }));
            antMessage.error('专家回复流中断，正在刷新消息');
          }
        } finally {
          if (streamsByConversationRef.current.get(conversationId)?.turnId === continueTurnId) {
            streamsByConversationRef.current.delete(conversationId);
          }
          clearConversationBusy(conversationId);
          await loadMessages(conversationId, { force: true });
        }
      } catch (err) {
        antMessage.error(err instanceof Error ? err.message : '确认升级失败');
        clearConversationBusy(conversationId);
        try {
          await loadMessages(conversationId, { force: true });
        } catch {
          // 刷新失败不遮盖确认错误
        }
      } finally {
        setUpgradeInviteConfirming(false);
      }
    },
    [
      activeConversationId,
      clearConversationBusy,
      loadMessages,
      messages.length,
      patchConversationUi,
      selectedModel,
      setConversationLoading,
      upgradeInviteProposed,
    ],
  );

  const handleDeclineUpgradeInvite = useCallback(async () => {
    if (!upgradeInviteProposed) return;
    try {
      await declineUpgradeInvite({
        conversation_id: upgradeInviteProposed.conversation_id,
        proposal_id: upgradeInviteProposed.proposal_id,
      });
      setUpgradeInviteProposed(null);
      setSessions((prev) =>
        prev.map((s) =>
          s.id === upgradeInviteProposed.conversation_id
            ? { ...s, awaiting_upgrade_invite: false, is_generating: false, generating_started_at: null }
            : s,
        ),
      );
      antMessage.info('已拒绝升级；本会话将不再主动邀请专家');
    } catch (err) {
      antMessage.error(err instanceof Error ? err.message : '拒绝失败');
    }
  }, [upgradeInviteProposed]);

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
  const projectByConversation = new Map(
    workshopProjects.map((project) => [project.group_chat_id, project] as const),
  );
  const conversationNavigation = (
    <>
      <div className="studio-chat__sidebar-top">
        <Button
          type="primary"
          className="studio-chat__new-btn"
          block
          icon={<PlusOutlined />}
          aria-label="新对话"
          onClick={() => {
            setConversationListOpen(false);
            void newSession();
          }}
        />

        <label className="studio-chat__search">
          <SearchOutlined className="studio-chat__search-icon" />
          <input
            type="text"
            placeholder="搜索对话和项目"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </label>
      </div>

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
            {searchQuery ? '没有找到相关内容' : '还没有对话'}
          </div>
        )}
        {sessionGroups.map((group) => (
          <div key={group.label}>
            <div className="studio-chat__section-label">{group.label}</div>
            {group.items.map((session) => {
              const project = projectByConversation.get(session.id);
              return (
                <SessionListItem
                  key={session.id}
                  session={session}
                  active={session.id === activeConversationId}
                  busy={loadingConversationIds.has(session.id)}
                  projectLabel={project ? '项目' : undefined}
                  onSelect={(id) => {
                    setConversationListOpen(false);
                    void selectSession(id);
                  }}
                  onRenamed={(id, title) =>
                    setSessions((prev) =>
                      prev.map((item) => (item.id === id ? { ...item, title } : item)),
                    )
                  }
                  onDeleted={handleSessionDeleted}
                />
              );
            })}
          </div>
        ))}
      </div>
    </>
  );

  return (
    <PageScaffold immersive>
      <div
        className={`studio-chat${
          showSidePanelColumn ? ' studio-chat--resources-open' : ''
        }${workshopProject ? ' studio-chat--workshop' : ''}`}
      >
        {!layoutCompact ? (
          <aside className="studio-chat__sidebar">{conversationNavigation}</aside>
        ) : null}

        {/* ── 中间内容区 ── */}
        <section className="studio-chat__main">
          <div className="studio-chat__title-bar">
            <span className="studio-chat__title">
              {activeSession?.title || '新会话'}
              {workshopProject ? (
                <span className="studio-chat__mode-chip">项目</span>
              ) : null}
            </span>
            <div className="studio-chat__title-actions">
              {layoutCompact ? (
                <StudioChip
                  icon={<MenuOutlined aria-hidden />}
                  onClick={() => setConversationListOpen(true)}
                >
                  对话与项目
                </StudioChip>
              ) : null}
              {!sidePanelOpen ? (
                <StudioChip
                  icon={<FolderOpenOutlined aria-hidden />}
                  aria-controls="studio-chat-side-panel"
                  onClick={() => setSidePanelOpen(true)}
                >
                  详情
                </StudioChip>
              ) : null}
            </div>
          </div>

          <div className="studio-chat__content">
            {/* 消息列表 */}
            <div
              className="studio-chat__messages"
              ref={messagesContainerRef}
              onScroll={handleMessagesScroll}
            >
              {messages.length === 0 && !activeConversationLoading ? (
                <div className="studio-chat__start">
                  <h1>一起开始探索吧</h1>
                  <p className="studio-chat__start-hint">
                    输入 @ 指定专家，/ 引用技能；需要协作或连店铺时，打开右侧详情即可
                  </p>
                </div>
              ) : null}
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

            <ChatComposerBox
              input={input}
              onInputChange={setInput}
              selectedSkillPaths={selectedSkillPaths}
              onSelectedSkillPathsChange={setSelectedSkillPaths}
              selectedExpert={selectedExpert}
              expertTargetPrefix={workshopProject ? '发给 ' : null}
              onSelectedExpertChange={(expert) => {
                if (!expert) void handleClearSelectedExpert();
              }}
              composerExperts={composerExperts}
              models={models}
              selectedModel={selectedModel}
              onModelChange={handleModelChange}
              attachments={attachments.map((item) => ({
                id: String(item.attachment_id),
                filename: item.filename,
                mime_type: item.mime_type,
                preview_url: item.preview_url,
              }))}
              onRemoveAttachment={(attachmentId) => {
                const numericId = Number(attachmentId);
                setAttachments((prev) => {
                  const target = prev.find((item) => item.attachment_id === numericId);
                  if (target?.preview_url) URL.revokeObjectURL(target.preview_url);
                  return prev.filter((item) => item.attachment_id !== numericId);
                });
              }}
              onUploadFile={(file) => onUpload(file, false)}
              busy={conversationBusy}
              modelVisionHint={modelVisionHint}
              canSend={Boolean(selectedModel) && Boolean(input.trim())}
              onSend={() => void send()}
              onStop={() => void cancelInFlightTurn()}
            />
          </div>
        </section>

        {showSidePanelColumn ? (
          <aside
            className="studio-chat__panel studio-chat__panel--workshop"
            style={{ width: sidePanelWidth.width }}
          >
            <div
              className="studio-chat__panel-resize"
              onPointerDown={sidePanelWidth.onResizePointerDown}
              role="separator"
              aria-orientation="vertical"
              aria-label="调整详情面板宽度"
            />
            <UnifiedChatSidePanel
              title={activeSession?.title || workshopProject?.name || '新会话'}
              project={workshopProject}
              messages={messages}
              expertDirectory={expertDirectory}
              connectors={workshopConnectors}
              onClose={() => setSidePanelOpen(false)}
              onInviteExpert={handleInviteExpert}
              onBeginShopAuth={() => void beginTaobaoShopAuth()}
              onProjectUpdated={() => void resolveWorkshopForConversation(activeConversationId)}
              activeTab={sidePanelTab}
              onTabChange={setSidePanelTab}
              pendingShopAuth={pendingShopAuth}
              onPendingShopAuthHandled={() => setPendingShopAuth(false)}
              shopAuthBusy={shopAuthBusy}
            />
          </aside>
        ) : null}
      </div>
      {layoutCompact ? (
        <Drawer
          title="对话与项目"
          placement="left"
          width={320}
          open={conversationListOpen}
          onClose={() => setConversationListOpen(false)}
          styles={{ body: { padding: 0 } }}
        >
          <div className="studio-chat__sidebar studio-chat__sidebar--drawer">
            {conversationNavigation}
          </div>
        </Drawer>
      ) : null}
      {layoutCompact && sidePanelOpen ? (
        <Drawer
          title={null}
          closable={false}
          placement="right"
          width="min(92vw, 380px)"
          open
          onClose={() => setSidePanelOpen(false)}
          styles={{ body: { padding: 0 }, header: { display: 'none' } }}
          destroyOnClose={false}
        >
          <UnifiedChatSidePanel
            title={activeSession?.title || workshopProject?.name || '新会话'}
            project={workshopProject}
            messages={messages}
            expertDirectory={expertDirectory}
            connectors={workshopConnectors}
            onClose={() => setSidePanelOpen(false)}
            onInviteExpert={handleInviteExpert}
            onBeginShopAuth={() => void beginTaobaoShopAuth()}
            onProjectUpdated={() => void resolveWorkshopForConversation(activeConversationId)}
            activeTab={sidePanelTab}
            onTabChange={setSidePanelTab}
            pendingShopAuth={pendingShopAuth}
            onPendingShopAuthHandled={() => setPendingShopAuth(false)}
            shopAuthBusy={shopAuthBusy}
          />
        </Drawer>
      ) : null}
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
      <UpgradeInviteConfirmModal
        open={Boolean(upgradeInviteProposed)}
        payload={upgradeInviteProposed}
        confirming={upgradeInviteConfirming}
        onConfirm={(selection) => {
          void handleConfirmUpgradeInvite(selection);
        }}
        onDecline={() => {
          void handleDeclineUpgradeInvite();
        }}
      />
    </PageScaffold>
  );
}
