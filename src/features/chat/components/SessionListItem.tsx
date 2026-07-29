import { useState } from 'react';
import { Dropdown, Input, Modal, message as antMessage } from 'antd';
import type { MenuProps } from 'antd';

import { updateConversation, deleteConversation, type ConversationView } from '../../../api/chat';
import { useStudioApp } from '../../../shared/ui/useStudioApp';
import { formatConversationTime } from '../utils/formatConversationTime';

export interface SessionListItemProps {
  session: ConversationView;
  active: boolean;
  busy?: boolean;
  onSelect: (id: number) => void;
  onRenamed: (id: number, title: string) => void;
  onDeleted: (id: number) => void;
}

export function SessionListItem({ session, active, busy = false, onSelect, onRenamed, onDeleted }: SessionListItemProps) {
  const { modal } = useStudioApp();
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState(session.title);

  const openRename = () => {
    setRenameValue(session.title);
    setRenameOpen(true);
  };

  const submitRename = async () => {
    const title = renameValue.trim();
    if (!title) {
      antMessage.warning('标题不能为空');
      return;
    }
    try {
      await updateConversation({ conversation_id: session.id, title });
      onRenamed(session.id, title);
      setRenameOpen(false);
      antMessage.success('已重命名');
    } catch (err) {
      antMessage.error(err instanceof Error ? err.message : '重命名失败');
    }
  };

  const confirmDelete = () => {
    modal.confirm({
      title: '删除此会话？',
      content: '删除后无法恢复',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteConversation(session.id);
          onDeleted(session.id);
          antMessage.success('已删除');
        } catch (err) {
          antMessage.error(err instanceof Error ? err.message : '删除失败');
          throw err;
        }
      },
    });
  };

  const stopMenuEvent = (info: { domEvent: React.MouseEvent | React.KeyboardEvent }) => {
    info.domEvent.stopPropagation();
  };

  const menuItems: MenuProps['items'] = [
    {
      key: 'rename',
      label: '重命名',
      onClick: (info) => {
        stopMenuEvent(info);
        openRename();
      },
    },
    {
      key: 'delete',
      label: '删除',
      danger: true,
      onClick: (info) => {
        stopMenuEvent(info);
        confirmDelete();
      },
    },
  ];

  return (
    <>
      <div className={`studio-chat__session${active ? ' studio-chat__session--active' : ''}`}>
        <button type="button" className="studio-chat__session-body" onClick={() => onSelect(session.id)}>
          <div className="studio-chat__session-title">{session.title}</div>
          <div className="studio-chat__session-meta">
            {busy ? '生成中… · ' : ''}
            {formatConversationTime(session.updated_at)}
          </div>
        </button>
        <div className="studio-chat__session-actions">
          <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="bottomRight">
            <button
              type="button"
              className="studio-chat__session-menu-btn"
              aria-label="会话操作"
              onClick={(e) => e.stopPropagation()}
            >
              ⋯
            </button>
          </Dropdown>
        </div>
      </div>
      <Modal
        title="重命名会话"
        open={renameOpen}
        onOk={() => void submitRename()}
        onCancel={() => setRenameOpen(false)}
        okText="保存"
        cancelText="取消"
        destroyOnClose
      >
        <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} onPressEnter={() => void submitRename()} />
      </Modal>
    </>
  );
}
