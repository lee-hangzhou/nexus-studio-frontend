import { CloseOutlined, EditOutlined } from '@ant-design/icons';
import { Input, Modal } from 'antd';
import { useEffect, useState } from 'react';
import type { CanvasSessionView } from '../api/canvasTypes';
import { CANVAS_DEFAULT_SESSION_TITLE, CANVAS_SESSION_TITLE_MAX_LEN } from '../constants';
import { useStudioApp } from '../../../shared/ui/useStudioApp';

export function CanvasAgentSessionList({
  sessions,
  activeSessionId,
  loading,
  onSelect,
  onRename,
  onClose,
  onEditingChange,
}: {
  sessions: CanvasSessionView[];
  activeSessionId: number | null;
  loading: boolean;
  onSelect: (sessionId: number) => void;
  onRename: (sessionId: number, title: string) => void | Promise<void>;
  onClose: (sessionId: number) => void | Promise<void>;
  onEditingChange?: (editing: boolean) => void;
}) {
  const { modal } = useStudioApp();
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [closingId, setClosingId] = useState<number | null>(null);

  useEffect(() => {
    onEditingChange?.(renamingId != null);
  }, [renamingId, onEditingChange]);

  const openRename = (session: CanvasSessionView) => {
    setRenamingId(session.id);
    setRenameDraft(session.title);
  };

  const closeRename = () => {
    if (renaming) return;
    setRenamingId(null);
    setRenameDraft('');
  };

  const confirmRename = async () => {
    if (renamingId == null) return;
    const title = renameDraft.trim();
    if (!title) return;
    setRenaming(true);
    try {
      await onRename(renamingId, title);
      setRenamingId(null);
      setRenameDraft('');
    } finally {
      setRenaming(false);
    }
  };

  const confirmClose = (session: CanvasSessionView) => {
    modal.confirm({
      title: '关闭会话',
      content: `关闭「${session.title?.trim() || CANVAS_DEFAULT_SESSION_TITLE}」后将无法继续发送，历史仍可读`,
      okText: '关闭',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        setClosingId(session.id);
        try {
          await onClose(session.id);
        } finally {
          setClosingId(null);
        }
      },
    });
  };

  if (loading) {
    return <div className="canvas-agent-session-list canvas-agent-session-list--empty">加载中…</div>;
  }
  if (sessions.length === 0) {
    return <div className="canvas-agent-session-list canvas-agent-session-list--empty">暂无会话</div>;
  }

  return (
    <>
      <div className="canvas-agent-session-list" role="listbox" aria-label="会话列表">
        {sessions.map((session) => {
          const active = session.id === activeSessionId;
          return (
            <div
              key={session.id}
              role="option"
              aria-selected={active}
              className={`canvas-agent-session-list__item${
                active ? ' canvas-agent-session-list__item--active' : ''
              }`}
              onClick={() => onSelect(session.id)}
            >
              <span className="canvas-agent-session-list__title">{session.title}</span>
              <button
                type="button"
                className="canvas-agent-session-list__action-btn"
                title="重命名"
                aria-label={`重命名 ${session.title}`}
                onClick={(event) => {
                  event.stopPropagation();
                  openRename(session);
                }}
              >
                <EditOutlined />
              </button>
              <button
                type="button"
                className="canvas-agent-session-list__action-btn"
                title="关闭会话"
                aria-label={`关闭 ${session.title}`}
                disabled={closingId === session.id || sessions.length <= 1}
                onClick={(event) => {
                  event.stopPropagation();
                  confirmClose(session);
                }}
              >
                <CloseOutlined />
              </button>
            </div>
          );
        })}
      </div>
      <Modal
        title="重命名会话"
        open={renamingId != null}
        onOk={() => void confirmRename()}
        onCancel={closeRename}
        okText="确定"
        cancelText="取消"
        confirmLoading={renaming}
        okButtonProps={{ disabled: !renameDraft.trim() }}
        destroyOnHidden
      >
        <Input
          value={renameDraft}
          onChange={(event) => setRenameDraft(event.target.value)}
          placeholder={CANVAS_DEFAULT_SESSION_TITLE}
          maxLength={CANVAS_SESSION_TITLE_MAX_LEN}
          onPressEnter={() => void confirmRename()}
          autoFocus
        />
      </Modal>
    </>
  );
}
