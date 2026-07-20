import type { ChatMessageView, ToolStepView } from '../../api/chat';
import { sanitizeToolResultPreview } from './toolResultPreview';
import { isFailedToolStep } from './toolStepVisibility';

export type TurnTimelineNarration = {
  kind: 'narration';
  id: string;
  text: string;
};

export type TurnTimelineTool = {
  kind: 'tool';
  id: string;
  step: ToolStepView;
};

export type TurnTimelineItem = TurnTimelineNarration | TurnTimelineTool;

function metaString(metadata: Record<string, unknown>, key: string): string {
  const value = metadata[key];
  return typeof value === 'string' ? value : '';
}

export function turnIdFromMessage(message: ChatMessageView): string | null {
  const turnId = metaString(message.metadata, 'turn_id') || metaString(message.metadata, 'client_turn_id');
  return turnId || null;
}

export function turnIdFromUserMessage(message: ChatMessageView): string | null {
  return metaString(message.metadata, 'turn_id') || metaString(message.metadata, 'client_turn_id') || null;
}

export function userMessageMatchesLiveTurn(message: ChatMessageView, liveTurnId: string | null): boolean {
  if (!liveTurnId) return false;
  const clientTurnId = metaString(message.metadata, 'client_turn_id');
  const serverTurnId = metaString(message.metadata, 'turn_id');
  return liveTurnId === clientTurnId || liveTurnId === serverTurnId;
}

function parseToolResultSuccess(previewRaw: string): boolean {
  const text = previewRaw.trim();
  if (!text.startsWith('{')) {
    return !text.startsWith('tool_error:');
  }
  try {
    const raw = JSON.parse(text) as { tool_result?: { success?: boolean } };
    if (raw.tool_result && typeof raw.tool_result.success === 'boolean') {
      return raw.tool_result.success;
    }
  } catch {
    // fall through
  }
  return !text.startsWith('tool_error:');
}

export function toolStepFromToolMessage(message: ChatMessageView, index: number): ToolStepView {
  const meta = message.metadata;
  const name = String(meta.name ?? 'tool');
  const previewRaw =
    typeof meta.result_preview === 'string' ? meta.result_preview : (message.content || '').slice(0, 500);
  const ok = parseToolResultSuccess(previewRaw);
  const safePreview = sanitizeToolResultPreview(name, previewRaw, ok);
  const preview = ok ? safePreview : `失败: ${safePreview}`;
  return {
    call_id: String(meta.call_id ?? `persisted-${index}`),
    name,
    args: (typeof meta.args === 'object' && meta.args !== null
      ? meta.args
      : {}) as Record<string, unknown>,
    result_preview: preview,
  };
}

function toolStepsFromFinalMetadata(metadata: Record<string, unknown>): ToolStepView[] {
  const raw = metadata.tool_steps;
  if (!Array.isArray(raw)) return [];
  return raw.map((item, index) => {
    const step = item as Record<string, unknown>;
    const ok = step.ok !== false;
    const preview = typeof step.result_preview === 'string' ? step.result_preview : '';
    const name = String(step.name ?? 'tool');
    const safePreview = ok
      ? sanitizeToolResultPreview(name, preview, true)
      : `失败: ${sanitizeToolResultPreview(name, preview, false)}`;
    return {
      call_id: String(step.call_id ?? `meta-${index}`),
      name,
      args: (typeof step.args === 'object' && step.args !== null
        ? step.args
        : {}) as Record<string, unknown>,
      result_preview: safePreview,
    };
  });
}

/** Chronological narration + tool rows for one turn from persisted messages. */
export function buildPersistedTurnTimeline(
  messages: ChatMessageView[],
  turnId: string,
): TurnTimelineItem[] {
  const items: TurnTimelineItem[] = [];
  for (const message of messages) {
    if (turnIdFromMessage(message) !== turnId) continue;
    if (message.role === 'assistant' && metaString(message.metadata, 'phase') === 'tool_request') {
      const text = message.content.trim();
      if (text) {
        items.push({ kind: 'narration', id: `narr-${message.id}`, text });
      }
      continue;
    }
    if (message.role === 'tool') {
      const step = toolStepFromToolMessage(message, items.length);
      items.push({ kind: 'tool', id: step.call_id, step });
    }
  }

  if (items.length > 0) {
    return items;
  }

  const finalAssistant = messages.find(
    (message) =>
      message.role === 'assistant'
      && metaString(message.metadata, 'phase') === 'final'
      && turnIdFromMessage(message) === turnId,
  );
  if (!finalAssistant) return items;
  return toolStepsFromFinalMetadata(finalAssistant.metadata).map((step) => ({
    kind: 'tool' as const,
    id: step.call_id,
    step,
  }));
}

/** Overlay in-flight SSE timeline onto DB rows for the active turn. */
export function mergeTurnTimelines(
  persisted: TurnTimelineItem[],
  live: TurnTimelineItem[],
): TurnTimelineItem[] {
  if (live.length === 0) return persisted;
  const known = new Set(persisted.map((item) => item.id));
  const liveById = new Map(live.map((item) => [item.id, item]));
  const merged = persisted.map((item) => {
    const update = liveById.get(item.id);
    if (!update) return item;
    if (item.kind === 'tool' && update.kind === 'tool') {
      const settled = item.step.result_preview !== '执行中…' && item.step.result_preview !== '参数异常，正在自动修复…';
      const livePending = update.step.result_preview === '执行中…' || update.step.result_preview === '参数异常，正在自动修复…';
      if (settled && livePending) return item;
      return update;
    }
    return update;
  });
  const tail = live.filter((item) => !known.has(item.id));
  return [...merged, ...tail];
}

export function visibleTurnTimeline(items: TurnTimelineItem[]): TurnTimelineItem[] {
  return items.filter((item) => item.kind === 'narration' || !isFailedToolStep(item.step));
}

export function toolStepsFromTimeline(items: TurnTimelineItem[]): ToolStepView[] {
  return items.filter((item): item is TurnTimelineTool => item.kind === 'tool').map((item) => item.step);
}

export function resolveTurnTimelineForUser(
  userMessage: ChatMessageView,
  messages: ChatMessageView[],
  liveTurnId: string | null,
  liveTurnTimeline: TurnTimelineItem[],
  options?: { mergeLive?: boolean },
): TurnTimelineItem[] {
  const turnId = turnIdFromUserMessage(userMessage);
  if (!turnId) return [];
  const persisted = buildPersistedTurnTimeline(messages, turnId);
  const shouldMergeLive =
    options?.mergeLive
    ?? (liveTurnTimeline.length > 0 && userMessageMatchesLiveTurn(userMessage, liveTurnId));
  const merged = shouldMergeLive ? mergeTurnTimelines(persisted, liveTurnTimeline) : persisted;
  return visibleTurnTimeline(merged);
}

export function appendLiveToolStart(
  timeline: TurnTimelineItem[],
  callId: string,
  name: string,
  args: Record<string, unknown>,
): TurnTimelineItem[] {
  const id = callId || `local-${timeline.length}`;
  const step: ToolStepView = {
    call_id: id,
    name,
    args,
    result_preview: '执行中…',
  };
  if (callId && timeline.some((item) => item.kind === 'tool' && item.id === callId)) {
    return timeline.map((item) =>
      item.kind === 'tool' && item.id === callId ? { kind: 'tool', id, step } : item,
    );
  }
  return [...timeline, { kind: 'tool', id, step }];
}

export function updateLiveToolEnd(
  timeline: TurnTimelineItem[],
  callId: string,
  name: string,
  preview: string,
): TurnTimelineItem[] {
  let matched = false;
  return timeline.map((item) => {
    if (item.kind !== 'tool') return item;
    if (callId && item.id === callId) {
      return { ...item, step: { ...item.step, result_preview: preview } };
    }
    if (!matched && item.step.name === name && item.step.result_preview === '执行中…') {
      matched = true;
      return {
        ...item,
        id: callId || item.id,
        step: { ...item.step, call_id: callId || item.step.call_id, result_preview: preview },
      };
    }
    return item;
  });
}

export function appendLiveNarration(
  timeline: TurnTimelineItem[],
  id: string,
  text: string,
): TurnTimelineItem[] {
  const trimmed = text.trim();
  if (!trimmed) return timeline;
  if (timeline.some((item) => item.kind === 'narration' && item.text === trimmed)) {
    return timeline;
  }
  return [...timeline, { kind: 'narration', id, text: trimmed }];
}
