import { useCallback, useState } from 'react';
import type { ToolStepView } from '../../../api/chat';
import { listCanvasMessages } from '../api/canvas';
import { stripPseudoToolMarkup } from '../utils/stripPseudoToolMarkup';
import type { CanvasMessageRecord } from '../api/canvasTypes';

const ROLE_USER = 1;

export type CanvasFeedMessage = {
  id: number | string;
  role: 'user' | 'assistant';
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
  streaming?: boolean;
};

function toFeed(m: CanvasMessageRecord): CanvasFeedMessage {
  return {
    id: m.id,
    role: m.role === ROLE_USER ? 'user' : 'assistant',
    content: stripPseudoToolMarkup(m.content),
    metadata: m.metadata ?? {},
    created_at: m.created_at,
  };
}

function isToolStepRecord(m: CanvasMessageRecord): boolean {
  return m.metadata?.phase === 'tool_step' && typeof m.metadata.tool_step === 'object' && m.metadata.tool_step !== null;
}

function normalizeToolStep(raw: unknown, index: number): ToolStepView {
  const step = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const ok = step.ok !== false;
  const preview =
    typeof step.result_preview === 'string'
      ? step.result_preview
      : typeof step.preview === 'string'
        ? step.preview
        : '';
  return {
    call_id: String(step.call_id ?? `tool-${index}`),
    name: String(step.name ?? 'tool'),
    args: (typeof step.args === 'object' && step.args !== null ? step.args : {}) as Record<string, unknown>,
    result_preview: ok ? preview : `失败: ${preview}`,
  };
}

function buildFeed(rows: CanvasMessageRecord[]): CanvasFeedMessage[] {
  const toolStepsByTurn = new Map<string, ToolStepView[]>();
  rows.forEach((row, index) => {
    if (!isToolStepRecord(row)) return;
    const turnId = typeof row.metadata.turn_id === 'string' ? row.metadata.turn_id : '';
    if (!turnId) return;
    const steps = toolStepsByTurn.get(turnId) ?? [];
    steps.push(normalizeToolStep(row.metadata.tool_step, index));
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

export function useCanvasMessages(episodeId: number) {
  const [messages, setMessages] = useState<CanvasFeedMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const loadMessages = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listCanvasMessages(episodeId, { limit: 50 });
      setMessages(buildFeed(rows));
    } finally {
      setLoading(false);
    }
  }, [episodeId]);

  const appendUser = useCallback((content: string, clientTurnId: string) => {
    const temp: CanvasFeedMessage = {
      id: `temp-user-${clientTurnId}`,
      role: 'user',
      content,
      metadata: { client_turn_id: clientTurnId },
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
    appendUser,
    appendAssistantStream,
    appendAssistantToken,
    finishAssistantStream,
  };
}
