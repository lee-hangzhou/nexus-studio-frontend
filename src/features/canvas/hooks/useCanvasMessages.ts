import { useCallback, useRef, useState } from 'react';
import type { ToolStepView } from '../../../api/chat';
import type { TurnUserInput } from '../../skills/types';
import { parseUserInputSnapshot } from '../../skills/serializeTurnContent';
import { listCanvasMessages } from '../api/canvas';
import { stripPseudoToolMarkup } from '../utils/stripPseudoToolMarkup';
import type { CanvasMessageRecord } from '../api/canvasTypes';

const ROLE_USER = 1;

export type CanvasFeedMessage = {
  id: number | string;
  role: 'user' | 'assistant';
  content: string;
  input?: TurnUserInput | null;
  metadata: Record<string, unknown>;
  created_at: string;
  streaming?: boolean;
};

function toFeed(m: CanvasMessageRecord): CanvasFeedMessage {
  const input = m.input ? parseUserInputSnapshot(m.input) : null;
  return {
    id: m.id,
    role: m.role === ROLE_USER ? 'user' : 'assistant',
    content: stripPseudoToolMarkup(m.content),
    input,
    metadata: m.metadata ?? {},
    created_at: m.created_at,
  };
}

function isToolStepRecord(m: CanvasMessageRecord): boolean {
  return m.metadata?.phase === 'tool_step' && typeof m.metadata.tool_step === 'object' && m.metadata.tool_step !== null;
}

function normalizeToolStep(raw: unknown): ToolStepView | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    console.error('[canvas] malformed tool_step payload', raw);
    return null;
  }
  const step = raw as Record<string, unknown>;
  if (typeof step.call_id !== 'string' || !step.call_id) {
    console.error('[canvas] tool_step missing call_id', raw);
    return null;
  }
  if (typeof step.name !== 'string' || !step.name) {
    console.error('[canvas] tool_step missing name', raw);
    return null;
  }
  if (
    step.args != null &&
    (typeof step.args !== 'object' || step.args === null || Array.isArray(step.args))
  ) {
    console.error('[canvas] tool_step.args must be object', raw);
    return null;
  }
  const ok = step.ok !== false;
  const preview =
    typeof step.result_preview === 'string'
      ? step.result_preview
      : typeof step.preview === 'string'
        ? step.preview
        : '';
  return {
    call_id: step.call_id,
    name: step.name,
    args: (step.args ?? {}) as Record<string, unknown>,
    result_preview: ok ? preview : `失败: ${preview}`,
  };
}

function buildFeed(rows: CanvasMessageRecord[]): CanvasFeedMessage[] {
  const toolStepsByTurn = new Map<string, ToolStepView[]>();
  rows.forEach((row) => {
    if (!isToolStepRecord(row)) return;
    const turnId = typeof row.metadata.turn_id === 'string' ? row.metadata.turn_id : '';
    if (!turnId) return;
    const normalized = normalizeToolStep(row.metadata.tool_step);
    if (!normalized) return;
    const steps = toolStepsByTurn.get(turnId) ?? [];
    steps.push(normalized);
    toolStepsByTurn.set(turnId, steps);
  });

  return rows
    .filter((row) => !isToolStepRecord(row))
    .map((row) => {
      const feed = toFeed(row);
      const turnId = typeof feed.metadata.turn_id === 'string' ? feed.metadata.turn_id : '';
      const steps = turnId ? toolStepsByTurn.get(turnId) : undefined;
      if (feed.role === 'assistant' && steps?.length) {
        feed.metadata = { ...feed.metadata, tool_steps: steps };
      }
      return feed;
    })
    .filter((message) => message.role === 'user' || message.content.trim() || Array.isArray(message.metadata.tool_steps));
}

/** 按 session 加载消息, 带 abort 与序号防串台 */
export function useCanvasMessages(episodeId: number, sessionId: number | null) {
  const [messages, setMessages] = useState<CanvasFeedMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const seqRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const clearMessages = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    seqRef.current += 1;
    setMessages([]);
    setLoading(false);
  }, []);

  const loadMessages = useCallback(async () => {
    if (sessionId == null) {
      clearMessages();
      return;
    }
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    const seq = ++seqRef.current;
    setMessages([]);
    setLoading(true);
    try {
      const rows = await listCanvasMessages(episodeId, { session_id: sessionId, limit: 50 }, ac.signal);
      if (ac.signal.aborted || seq !== seqRef.current) return;
      setMessages(buildFeed(rows));
    } catch (err) {
      if (ac.signal.aborted || seq !== seqRef.current) return;
      if (err instanceof DOMException && err.name === 'AbortError') return;
      throw err;
    } finally {
      if (!ac.signal.aborted && seq === seqRef.current) setLoading(false);
    }
  }, [episodeId, sessionId, clearMessages]);

  const appendUser = useCallback((content: string, clientTurnId: string, input?: TurnUserInput) => {
    const temp: CanvasFeedMessage = {
      id: `temp-user-${clientTurnId}`,
      role: 'user',
      content,
      input: input ?? null,
      metadata: { client_turn_id: clientTurnId, ...(input ? { input } : {}) },
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, temp]);
  }, []);

  const appendAssistantStream = useCallback((clientTurnId: string) => {
    const temp: CanvasFeedMessage = {
      id: `temp-assistant-${clientTurnId}`,
      role: 'assistant',
      content: '',
      metadata: { client_turn_id: clientTurnId, streaming: true },
      created_at: new Date().toISOString(),
      streaming: true,
    };
    setMessages((prev) => [...prev, temp]);
  }, []);

  const appendAssistantToken = useCallback((clientTurnId: string, text: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === `temp-assistant-${clientTurnId}`
          ? { ...m, content: stripPseudoToolMarkup(m.content + text) }
          : m,
      ),
    );
  }, []);

  const finishAssistantStream = useCallback((clientTurnId: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === `temp-assistant-${clientTurnId}`
          ? { ...m, streaming: false, metadata: { ...m.metadata, streaming: false } }
          : m,
      ),
    );
  }, []);

  return {
    messages,
    setMessages,
    loading,
    loadMessages,
    clearMessages,
    appendUser,
    appendAssistantStream,
    appendAssistantToken,
    finishAssistantStream,
  };
}
