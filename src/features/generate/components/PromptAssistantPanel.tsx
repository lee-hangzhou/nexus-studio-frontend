import { CloseOutlined, HistoryOutlined } from '@ant-design/icons';
import { Select } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  getOrCreatePromptAssistantSession,
  listChatModels,
  listMessages,
  streamMessage,
  type ChatMessageView,
  type ChatModelItem,
} from '../../../api/chat';
import { getAsset } from '../../../api/assets';
import type { TurnMaterialBlock } from '../../../api/turnContent';
import { pickChatModelKey } from '../../canvas/lib/chatModelKey';
import { ComposerSendButton } from '../../../shared/ui/ComposerSendButton';
import { ComposerShell } from '../../../shared/ui/ComposerShell';
import { StudioChip } from '../../../shared/ui/StudioChip';
import { isAuthenticated } from '../../../shared/utils/authGate';
import type { WorkflowPromptContent } from '../composer/promptContent';
import type { CreateComposerParams } from './CreateComposer';
import type { GenerateKind, GenerateRefImage } from '../types';
import styles from './PromptAssistantPanel.module.css';

export type PromptAssistantApplyPayload = {
  prompt: string;
  content: WorkflowPromptContent;
  refImages: GenerateRefImage[];
};

export type PromptAssistantComposerSnapshot = {
  kind: GenerateKind;
  prompt: string;
  content: WorkflowPromptContent;
  params: CreateComposerParams;
  refImages: GenerateRefImage[];
};

type PanelMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
};

type PromptAssistantPanelProps = {
  open: boolean;
  snapshot: PromptAssistantComposerSnapshot;
  onClose: () => void;
  onOpenHistory: () => void;
  onApply: (payload: PromptAssistantApplyPayload) => void;
};

function toPanelMessages(items: ChatMessageView[]): PanelMessage[] {
  return items
    .filter((item) => item.role === 'user' || item.role === 'assistant')
    .map((item) => ({
      id: String(item.id),
      role: item.role as 'user' | 'assistant',
      content: item.content,
    }));
}

function buildComposerContext(snapshot: PromptAssistantComposerSnapshot) {
  return {
    kind: snapshot.kind,
    prompt: snapshot.prompt,
    content: snapshot.content,
    model_id: snapshot.params.model,
    ratio: snapshot.params.ratio,
    resolution: snapshot.params.resolution,
    count: snapshot.params.count,
    duration: snapshot.params.duration ?? null,
    reference_mode: snapshot.params.referenceMode ?? null,
    ref_asset_ids: snapshot.refImages
      .map((item) => item.assetId)
      .filter((id): id is number => typeof id === 'number' && id > 0),
  };
}

function buildTurnMaterials(snapshot: PromptAssistantComposerSnapshot): TurnMaterialBlock[] {
  const materials: TurnMaterialBlock[] = [];
  for (const ref of snapshot.refImages) {
    if (typeof ref.assetId !== 'number' || ref.assetId < 1) {
      throw new Error('创作器参考素材缺少有效 assetId，无法作为助手视觉上下文');
    }
    const mime = (ref.mimeType || '').toLowerCase();
    const type = mime.startsWith('video/')
      ? 'video'
      : mime.startsWith('audio/')
        ? 'audio'
        : 'image';
    materials.push({
      type,
      origin: 'library',
      assetId: ref.assetId,
      previewUrl: ref.url || undefined,
      name: ref.name,
    });
  }
  return materials;
}

async function resolveRefImages(assetIds: number[]): Promise<GenerateRefImage[]> {
  if (assetIds.length === 0) return [];
  const resolved: GenerateRefImage[] = [];
  for (const assetId of assetIds) {
    const asset = await getAsset(String(assetId));
    const idNum = Number(asset.id);
    if (!Number.isFinite(idNum) || idNum < 1) {
      throw new Error(`素材 ${assetId} 返回了无效 id`);
    }
    resolved.push({
      id: `ref-${idNum}`,
      assetId: idNum,
      url: asset.previewUrl || '',
      name: asset.filename || asset.title || `asset-${idNum}`,
      mimeType: asset.mimeType || '',
    });
  }
  return resolved;
}

export function PromptAssistantPanel({
  open,
  snapshot,
  onClose,
  onOpenHistory,
  onApply,
}: PromptAssistantPanelProps) {
  const [messages, setMessages] = useState<PanelMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [models, setModels] = useState<ChatModelItem[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsFailed, setModelsFailed] = useState(false);
  const [model, setModel] = useState('');
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [loadingSession, setLoadingSession] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, streaming]);

  useEffect(() => {
    if (!open) {
      abortRef.current?.abort();
      abortRef.current = null;
      setStreaming(false);
      return;
    }
    if (!isAuthenticated()) {
      setError('请先登录后再使用创作提示词助手');
      return;
    }

    let cancelled = false;
    setLoadingSession(true);
    setModelsLoading(true);
    setModelsFailed(false);
    setError(null);

    void (async () => {
      try {
        const modelList = await listChatModels();
        if (cancelled) return;
        setModels(modelList);
        setModelsLoading(false);
        if (modelList.length === 0) {
          throw new Error('暂无可用对话模型');
        }
        const bootstrapModel = pickChatModelKey(modelList, undefined);
        if (!bootstrapModel) {
          // 与 Chat/Foyer 一致：无默认模型时不强塞首项，交给下拉让用户自选
          setModel('');
          setConversationId(null);
          setMessages([]);
          setError('请先选择对话模型');
          return;
        }
        const session = await getOrCreatePromptAssistantSession({ model: bootstrapModel });
        if (session.kind !== 'prompt_assistant') {
          throw new Error('会话类型错误：期望 prompt_assistant');
        }
        const history = await listMessages(session.id, { turnLimit: 40 });
        if (cancelled) return;
        const resolved =
          pickChatModelKey(modelList, session.default_model) ?? bootstrapModel;
        setModel(resolved);
        setConversationId(session.id);
        setMessages(toPanelMessages(history.items));
      } catch (err) {
        if (cancelled) return;
        setModelsFailed(true);
        setError(err instanceof Error ? err.message : '助手会话初始化失败');
      } finally {
        if (!cancelled) {
          setLoadingSession(false);
          setModelsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open]);

  const ensureSession = useCallback(async (modelKey: string) => {
    const session = await getOrCreatePromptAssistantSession({ model: modelKey });
    if (session.kind !== 'prompt_assistant') {
      throw new Error('会话类型错误：期望 prompt_assistant');
    }
    if (conversationId !== session.id) {
      const history = await listMessages(session.id, { turnLimit: 40 });
      setConversationId(session.id);
      setMessages(toPanelMessages(history.items));
    }
    return session.id;
  }, [conversationId]);

  const handleModelChange = useCallback((next: string) => {
    setModel(next);
    setError(null);
    if (!isAuthenticated()) return;
    void ensureSession(next).catch((err) => {
      setError(err instanceof Error ? err.message : '会话初始化失败');
    });
  }, [ensureSession]);

  const send = useCallback(async () => {
    const text = draft.trim();
    if (!text || streaming || loadingSession || !model || !isAuthenticated()) return;

    let activeConversationId = conversationId;
    if (activeConversationId == null) {
      try {
        activeConversationId = await ensureSession(model);
      } catch (err) {
        setError(err instanceof Error ? err.message : '会话初始化失败');
        return;
      }
    }

    const requestId = crypto.randomUUID();
    const clientTurnId = `pa-${Date.now()}`;
    const userMessage: PanelMessage = {
      id: `local-user-${clientTurnId}`,
      role: 'user',
      content: text,
    };
    const assistantId = `local-assistant-${clientTurnId}`;
    setMessages((prev) => [
      ...prev,
      userMessage,
      { id: assistantId, role: 'assistant', content: '' },
    ]);
    setDraft('');
    setStreaming(true);
    setError(null);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const materials = buildTurnMaterials(snapshotRef.current);
      await streamMessage(
        {
          request_id: requestId,
          conversation_id: activeConversationId,
          content: [{ type: 'text', text }],
          materials,
          model,
          enable_tools: true,
          client_turn_id: clientTurnId,
          composer_context: buildComposerContext(snapshotRef.current),
        },
        {
          onToken: (channel, token) => {
            if (channel !== 'answer' || !token) return;
            setMessages((prev) =>
              prev.map((item) =>
                item.id === assistantId
                  ? { ...item, content: `${item.content}${token}` }
                  : item,
              ),
            );
          },
          onToolStart: () => undefined,
          onToolEnd: (_callId, _name, ok, preview) => {
            if (!ok || !preview) return;
            setMessages((prev) => [
              ...prev,
              {
                id: `tool-${_callId}`,
                role: 'system',
                content: preview,
              },
            ]);
          },
          onComposerPromptApplied: (payload) => {
            void (async () => {
              try {
                if (!Array.isArray(payload.content)) {
                  throw new Error('composer_prompt_applied.content 缺失或类型错误');
                }
                const content = payload.content as unknown as WorkflowPromptContent;
                const refImages = await resolveRefImages(payload.ref_asset_ids);
                onApply({
                  prompt: payload.prompt,
                  content,
                  refImages,
                });
              } catch (applyErr) {
                setError(
                  applyErr instanceof Error ? applyErr.message : '写回创作器失败',
                );
              }
            })();
          },
          onError: (code, messageText) => {
            setError(`${code}: ${messageText}`);
          },
          onCancelled: (reason) => {
            setError(reason || '已取消');
          },
          onDone: () => undefined,
        },
        controller.signal,
      );
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : '发送失败');
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
      setStreaming(false);
      setMessages((prev) =>
        prev.filter((item) => !(item.id === assistantId && item.content.trim() === '')),
      );
    }
  }, [conversationId, draft, ensureSession, loadingSession, model, onApply, streaming]);

  if (!open) return null;

  const canSend =
    Boolean(draft.trim())
    && !loadingSession
    && Boolean(model)
    && isAuthenticated()
    && !modelsFailed;

  return (
    <div className={styles.panel}>
      <header className={styles.header}>
        <h2 className={styles.title}>创作提示词助手</h2>
        <div className={styles.headerActions}>
          <StudioChip
            size="sm"
            icon={<HistoryOutlined aria-hidden />}
            onClick={onOpenHistory}
            aria-label="切换到最近生成"
          >
            最近生成
          </StudioChip>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="关闭助手">
            <CloseOutlined />
          </button>
        </div>
      </header>

      <div className={styles.messages}>
        {loadingSession ? <p className={styles.status}>正在打开助手会话…</p> : null}
        {!loadingSession && messages.length === 0 ? (
          <p className={styles.empty}>
            描述你想生成的画面、风格或参考，我会帮你打磨提示词并写回创作框。
          </p>
        ) : null}
        {messages.map((item) => {
          if (item.role === 'system') {
            return (
              <div key={item.id} className={styles.toolNote}>
                {item.content}
              </div>
            );
          }
          if (item.role === 'user') {
            return (
              <div key={item.id} className={`${styles.bubble} ${styles.bubbleUser}`}>
                {item.content}
              </div>
            );
          }
          const streamingEmpty = streaming && item.content.trim() === '';
          return (
            <div key={item.id} className={`${styles.bubble} ${styles.bubbleAssistant}`}>
              {streamingEmpty ? (
                <div className="studio-bubble__typing" aria-label="助手正在回复">
                  <span />
                  <span />
                  <span />
                </div>
              ) : (
                <div className={`studio-bubble__markdown ${styles.markdown}`}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.content}</ReactMarkdown>
                </div>
              )}
            </div>
          );
        })}
        {error ? <p className={styles.error}>{error}</p> : null}
        <div ref={bottomRef} />
      </div>

      <div className={styles.composerWrap}>
        <ComposerShell
          input={
            <textarea
              className="studio-composer-box__textarea"
              value={draft}
              placeholder=""
              rows={3}
              disabled={loadingSession || streaming || !isAuthenticated()}
              aria-label="创作提示词助手输入"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void send();
                }
              }}
            />
          }
          footerLeft={
            <Select
              className="studio-composer-box__model"
              popupMatchSelectWidth={false}
              value={model || undefined}
              onChange={handleModelChange}
              disabled={streaming || modelsLoading || models.length === 0}
              loading={modelsLoading}
              options={models.map((item) => ({
                value: item.key,
                label: item.display_name || item.key,
              }))}
              placeholder={modelsFailed ? '模型不可用' : '选择模型'}
              aria-label="对话模型"
            />
          }
          footerRight={
            <ComposerSendButton
              busy={streaming}
              disabled={!canSend}
              onSend={() => void send()}
              onStop={() => {
                abortRef.current?.abort();
                abortRef.current = null;
                setStreaming(false);
              }}
              title={model ? '发送' : '暂无可用模型'}
            />
          }
        />
      </div>
    </div>
  );
}
