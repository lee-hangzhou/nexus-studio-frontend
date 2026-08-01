import { describe, expect, it } from 'vitest';
import type { ChatMessageView } from '../../../api/chat';
import {
  buildPersistedTurnTimeline,
  resolveTurnTimelineForUser,
  visibleTurnTimeline,
} from '../turnTimeline';
import { JUDGMENT_TOOL_NAMES, visibleToolSteps } from '../toolStepVisibility';

function msg(
  partial: Partial<ChatMessageView> & Pick<ChatMessageView, 'id' | 'role' | 'content'>,
): ChatMessageView {
  return {
    conversation_id: 1305,
    created_at: '2026-08-01T15:37:56Z',
    metadata: {},
    ...partial,
  };
}

describe('judgment tools must not appear on user timeline', () => {
  it('hides answer_directly rebuilt from persisted tool messages (conv 1305 symptom)', () => {
    const turnId = 'b003cd26-6edc-4d3a-a';
    const messages: ChatMessageView[] = [
      msg({
        id: 76,
        role: 'user',
        content: '今天几号',
        metadata: { turn_id: turnId },
      }),
      msg({
        id: 78,
        role: 'tool',
        content: '{"tool_result":{"success":true,"output":"judgment=answer_directly"}}',
        metadata: {
          turn_id: turnId,
          name: 'answer_directly',
          call_id: 'call_1',
          result_preview: 'judgment=answer_directly',
        },
      }),
      msg({
        id: 79,
        role: 'assistant',
        content: '今天是 2026 年 8 月 1 日。',
        metadata: { turn_id: turnId, phase: 'final' },
      }),
    ];

    const persisted = buildPersistedTurnTimeline(messages, turnId);
    expect(persisted.some((item) => item.kind === 'tool' && item.step.name === 'answer_directly')).toBe(
      false,
    );

    const visible = visibleTurnTimeline(persisted);
    expect(visible.some((item) => item.kind === 'tool' && JUDGMENT_TOOL_NAMES.has(item.step.name))).toBe(
      false,
    );

    const resolved = resolveTurnTimelineForUser(messages[0], messages, null, []);
    expect(resolved.some((item) => item.kind === 'tool')).toBe(false);
  });

  it('visibleToolSteps filters propose_upgrade_and_invite', () => {
    const steps = visibleToolSteps([
      {
        call_id: 'c1',
        name: 'propose_upgrade_and_invite',
        args: {},
        result_preview: '已完成',
      },
      {
        call_id: 'c2',
        name: 'web_search',
        args: { query: 'x' },
        result_preview: '已完成',
      },
    ]);
    expect(steps.map((s) => s.name)).toEqual(['web_search']);
  });
});
