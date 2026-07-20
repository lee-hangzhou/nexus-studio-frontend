import {
  AudioOutlined,
  FileTextOutlined,
  PictureOutlined,
  PlaySquareOutlined,
} from '@ant-design/icons';
import type { ReactNode } from 'react';
import type { WorkflowNodeType } from '../../types';
import './CanvasAddNodeMenu.less';

type MenuItemDef = {
  key: WorkflowNodeType | 'world3d';
  label: string;
  desc?: string;
  icon: ReactNode;
  beta?: boolean;
  badge?: boolean;
  disabled?: boolean;
};

const MENU_ITEMS: MenuItemDef[] = [
  {
    key: 'text',
    label: '文本',
    icon: <FileTextOutlined />,
  },
  {
    key: 'image',
    label: '图片',
    icon: <PictureOutlined />,
  },
  {
    key: 'video',
    label: '视频',
    icon: <PlaySquareOutlined />,
  },
  {
    key: 'audio',
    label: '音频',
    icon: <AudioOutlined />,
  },
];

export function CanvasAddNodeMenu({
  x,
  y,
  allowedTypes,
  onSelect,
  onClose,
}: {
  x: number;
  y: number;
  /** 连线锚点允许的前置类型；未传则展示全部（如右键画布） */
  allowedTypes?: WorkflowNodeType[];
  onSelect: (type: WorkflowNodeType) => void;
  onClose: () => void;
}) {
  const allowedSet = allowedTypes ? new Set(allowedTypes) : null;

  return (
    <>
      <div
        className="workflow-add-node-menu__backdrop"
        role="presentation"
        onClick={onClose}
        onContextMenu={e => {
          e.preventDefault();
          onClose();
        }}
      />
      <div
        className="workflow-add-node-menu"
        style={{ left: x, top: y }}
        role="menu"
        onContextMenu={e => e.preventDefault()}
      >
        <div className="workflow-add-node-menu__title">添加节点</div>
        <ul className="workflow-add-node-menu__list">
          {MENU_ITEMS.map(item => {
            if (item.key === 'world3d') {
              return null;
            }
            const hidden =
              allowedSet !== null && !allowedSet.has(item.key);
            if (hidden) {
              return null;
            }
            return (
            <li key={item.key}>
              <button
                type="button"
                className="workflow-add-node-menu__item"
                disabled={item.disabled}
                onClick={() => {
                  if (item.disabled) {
                    return;
                  }
                  onSelect(item.key as WorkflowNodeType);
                }}
              >
                <span
                  className={`workflow-add-node-menu__icon${
                    item.badge ? ' workflow-add-node-menu__icon--badge' : ''
                  }`}
                >
                  {item.icon}
                </span>
                <span className="workflow-add-node-menu__text">
                  <span className="workflow-add-node-menu__label-row">
                    <span className="workflow-add-node-menu__label">{item.label}</span>
                    {item.beta ? (
                      <span className="workflow-add-node-menu__beta">Beta</span>
                    ) : null}
                  </span>
                  {item.desc ? (
                    <span className="workflow-add-node-menu__desc">{item.desc}</span>
                  ) : null}
                </span>
              </button>
            </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}
