import {
  AudioOutlined,
  FileTextOutlined,
  PictureOutlined,
  PlaySquareOutlined,
} from '@ant-design/icons';
import type { ReactNode } from 'react';
import './CanvasEmptyState.less';
import { AimOutlined } from '@ant-design/icons';

export type CanvasEmptyQuickAction =
  | 'text_to_video'
  | 'image_background'
  | 'first_frame_video'
  | 'audio_to_video'
  | 'template';

type QuickActionItem = {
  key: CanvasEmptyQuickAction;
  label: string;
  icon: ReactNode;
};

const QUICK_ACTIONS: QuickActionItem[] = [
  { key: 'text_to_video', label: '文字生视频', icon: <FileTextOutlined /> },
  { key: 'image_background', label: '图片换背景', icon: <PictureOutlined /> },
  { key: 'first_frame_video', label: '首帧生成视频', icon: <PlaySquareOutlined /> },
  { key: 'audio_to_video', label: '音频生视频', icon: <AudioOutlined /> },
];

type CanvasEmptyStateProps = {
  onQuickAction: (action: CanvasEmptyQuickAction) => void;
};

/** 画布无节点时居中展示引导与快捷入口 */
export function CanvasEmptyState({ onQuickAction }: CanvasEmptyStateProps) {
  return (
    <div className="workflow-canvas-empty">
      <div className="workflow-canvas-empty__hint">
        <span className="workflow-canvas-empty__dblclick-badge">
          <AimOutlined />
          双击
        </span>
        <span className="workflow-canvas-empty__hint-text">画布自由生成，或查看模板</span>
      </div>
      <div className="workflow-canvas-empty__actions">
        {QUICK_ACTIONS.map(item => (
          <button
            key={item.key}
            type="button"
            className="workflow-canvas-empty__action"
            onClick={() => onQuickAction(item.key)}
          >
            <span className="workflow-canvas-empty__action-icon" aria-hidden>
              {item.icon}
            </span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
