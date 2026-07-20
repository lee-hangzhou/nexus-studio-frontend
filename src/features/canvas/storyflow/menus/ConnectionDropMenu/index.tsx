import {
  AudioOutlined,
  FileTextOutlined,
  PictureOutlined,
  PlaySquareOutlined,
} from '@ant-design/icons';
import type { ReactNode } from 'react';
import type { SpawnTargetType, WorkflowNodeType } from '../../types';
import './ConnectionDropMenu.less';

type MenuItemDef = {
  key: SpawnTargetType;
  label: string;
  desc?: string;
  icon: ReactNode;
};

const MENU_ITEMS: MenuItemDef[] = [
  {
    key: 'text',
    label: '文本生成',
    icon: <FileTextOutlined />,
  },
  {
    key: 'image',
    label: '图片生成',
    icon: <PictureOutlined />,
  },
  {
    key: 'video',
    label: '视频生成',
    icon: <PlaySquareOutlined />,
  },
  {
    key: 'audio',
    label: '音频生成',
    icon: <AudioOutlined />,
  },
];

export function ConnectionDropMenu({
  x,
  y,
  allowedTypes,
  onSelect,
  onClose,
}: {
  x: number;
  y: number;
  /** 锚点节点允许的后置类型；未传则展示全部 */
  allowedTypes?: WorkflowNodeType[];
  onSelect: (type: SpawnTargetType) => void;
  onClose: () => void;
}) {
  const allowedSet = allowedTypes ? new Set(allowedTypes) : null;
  const visibleItems = allowedSet
    ? MENU_ITEMS.filter(item => allowedSet.has(item.key))
    : MENU_ITEMS;

  return (
    <>
      <div
        className="workflow-connection-menu__backdrop"
        role="presentation"
        onClick={onClose}
      />
      <div
        className="workflow-connection-menu"
        style={{ left: x, top: y }}
        role="menu"
      >
        <div className="workflow-connection-menu__title">引用该节点生成</div>
        <ul className="workflow-connection-menu__list">
          {visibleItems.map(item => (
            <li key={item.key}>
              <button
                type="button"
                className="workflow-connection-menu__item"
                onClick={() => onSelect(item.key)}
              >
                <span className="workflow-connection-menu__icon">{item.icon}</span>
                <span className="workflow-connection-menu__text">
                  <span className="workflow-connection-menu__label-row">
                    <span className="workflow-connection-menu__label">{item.label}</span>
                  </span>
                  {item.desc ? (
                    <span className="workflow-connection-menu__desc">{item.desc}</span>
                  ) : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
