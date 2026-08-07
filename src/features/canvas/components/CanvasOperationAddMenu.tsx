import {
  AudioOutlined,
  FileTextOutlined,
  PictureOutlined,
  PlaySquareOutlined,
} from '@ant-design/icons';
import { useLayoutEffect, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import type { CanvasNodeKind } from '../api/canvasTypes';

type NodeMenuItem = {
  key: CanvasNodeKind;
  label: string;
  icon: ReactNode;
};

const NODE_MENU_ITEMS: NodeMenuItem[] = [
  { key: 'text', label: '文本', icon: <FileTextOutlined /> },
  { key: 'image', label: '图片', icon: <PictureOutlined /> },
  { key: 'video', label: '视频', icon: <PlaySquareOutlined /> },
  { key: 'audio', label: '音频', icon: <AudioOutlined /> },
];

type CanvasOperationAddMenuProps = {
  open: boolean;
  anchorRef: RefObject<HTMLButtonElement | null>;
  disabled?: boolean;
  onSelectNode: (kind: CanvasNodeKind) => void;
  onClose: () => void;
};

/** 操作栏「新增节点」浮层 */
export function CanvasOperationAddMenu({
  open,
  anchorRef,
  disabled = false,
  onSelectNode,
  onClose,
}: CanvasOperationAddMenuProps) {
  const [position, setPosition] = useState({ left: 0, top: 0 });

  useLayoutEffect(() => {
    if (!open) {
      return;
    }
    const anchor = anchorRef.current;
    if (!anchor) {
      return;
    }
    const rect = anchor.getBoundingClientRect();
    setPosition({
      left: rect.right + 10,
      top: rect.top - 4,
    });
  }, [anchorRef, open]);

  if (!open || disabled) {
    return null;
  }

  return createPortal(
    <>
      <div
        className="workflow-add-node-menu__backdrop"
        role="presentation"
        onClick={onClose}
        onContextMenu={(event) => {
          event.preventDefault();
          onClose();
        }}
      />
      <div
        className="workflow-add-node-menu canvas-operation-add-menu"
        style={{ left: position.left, top: position.top }}
        role="menu"
        onContextMenu={(event) => event.preventDefault()}
      >
        <div className="workflow-add-node-menu__title">添加节点</div>
        <ul className="workflow-add-node-menu__list">
          {NODE_MENU_ITEMS.map((item) => (
            <li key={item.key}>
              <button
                type="button"
                className="workflow-add-node-menu__item"
                onClick={() => {
                  onSelectNode(item.key);
                  onClose();
                }}
              >
                <span className="workflow-add-node-menu__icon">{item.icon}</span>
                <span className="workflow-add-node-menu__text">
                  <span className="workflow-add-node-menu__label-row">
                    <span className="workflow-add-node-menu__label">{item.label}</span>
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </>,
    document.body,
  );
}
