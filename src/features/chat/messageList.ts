import {
  listMessages,
  type ChatMessageView,
  type MessageListResponse,
} from '../../api/chat';
import {
  MESSAGE_LIST_MAX_INITIAL_PAGES,
  MESSAGE_LIST_TURN_LIMIT,
} from './constants';

export type ConversationMessagePagination = {
  hasMore: boolean;
  nextBeforeId: number | null;
};

export type LoadedConversationMessages = {
  messages: ChatMessageView[];
  pagination: ConversationMessagePagination;
};

export async function loadConversationMessages(
  conversationId: number,
  options?: { beforeId?: number; turnLimit?: number },
): Promise<LoadedConversationMessages> {
  const response = await listMessages(conversationId, {
    turnLimit: options?.turnLimit ?? MESSAGE_LIST_TURN_LIMIT,
    beforeId: options?.beforeId,
  });
  return {
    messages: response.items,
    pagination: {
      hasMore: response.has_more,
      nextBeforeId: response.next_before_id,
    },
  };
}

/** 打开会话：按 turn 分页拉全可见历史（有上限），替代按 raw 行数盲翻页。 */
export async function loadInitialConversationMessages(
  conversationId: number,
): Promise<LoadedConversationMessages> {
  let messages: ChatMessageView[] = [];
  let beforeId: number | undefined;
  let hasMore = true;
  let nextBeforeId: number | null = null;

  for (let page = 0; page < MESSAGE_LIST_MAX_INITIAL_PAGES && hasMore; page += 1) {
    const response: MessageListResponse = await listMessages(conversationId, {
      turnLimit: MESSAGE_LIST_TURN_LIMIT,
      beforeId,
    });
    messages = beforeId != null ? [...response.items, ...messages] : response.items;
    hasMore = response.has_more;
    nextBeforeId = response.next_before_id;
    if (!hasMore || nextBeforeId == null) {
      break;
    }
    beforeId = nextBeforeId;
  }

  return {
    messages,
    pagination: {
      hasMore,
      nextBeforeId,
    },
  };
}

export async function loadOlderConversationMessages(
  conversationId: number,
  beforeId: number,
): Promise<LoadedConversationMessages> {
  return loadConversationMessages(conversationId, { beforeId });
}
