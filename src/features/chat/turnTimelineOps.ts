import type { ChatMessageView } from '../../api/chat';
import type { TurnTimelineItem } from './turnTimeline';
import { appendLiveNarration } from './turnTimeline';

type NarrationUiSlice = {
  messages: ChatMessageView[];
  narrationCursor: number;
  liveTurnTimeline: TurnTimelineItem[];
};

/** Move assistant answer prefix since last tool into the turn timeline as narration. */
export function flushAssistantNarration<T extends NarrationUiSlice>(
  prev: T,
  assistantMessageId: number | string,
): T {
  const assistant = prev.messages.find((message) => message.id === assistantMessageId);
  if (!assistant) return prev;
  const slice = assistant.content.slice(prev.narrationCursor).trim();
  if (!slice) return prev;
  const id = `narr-live-${assistantMessageId}-${prev.narrationCursor}`;
  return {
    ...prev,
    narrationCursor: assistant.content.length,
    liveTurnTimeline: appendLiveNarration(prev.liveTurnTimeline, id, slice),
  };
}
