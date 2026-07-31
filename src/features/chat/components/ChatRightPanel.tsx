import { CloseOutlined } from '@ant-design/icons';

import type { ChatMessageView } from '../../../api/chat';
import { SessionResourcesBody } from './SessionResourcesBody';

interface ChatRightPanelProps {
  messages: ChatMessageView[];
  onCollapse?: () => void;
}

/** @deprecated 优先使用统一侧栏 UnifiedChatSidePanel；保留供过渡兼容 */
export function ChatRightPanel({ messages, onCollapse }: ChatRightPanelProps) {
  return (
    <aside className="studio-chat__panel" id="studio-chat-resources-panel">
      <div className="studio-panel__head">
        <strong className="studio-panel__title">当前会话资源</strong>
        {onCollapse ? (
          <button
            type="button"
            className="studio-panel__close"
            onClick={onCollapse}
            aria-label="关闭"
          >
            <CloseOutlined aria-hidden />
          </button>
        ) : null}
      </div>
      <SessionResourcesBody messages={messages} />
    </aside>
  );
}
