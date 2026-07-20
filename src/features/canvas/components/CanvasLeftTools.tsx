import { AppstoreOutlined, BorderOutlined } from '@ant-design/icons';
import { Tooltip } from 'antd';
import type { CanvasNodeKind } from '../api/canvasTypes';

const ADD_ACTIONS: { kind: CanvasNodeKind; label: string }[] = [
  { kind: 'text', label: '+文本' },
  { kind: 'image', label: '+生图' },
  { kind: 'video', label: '+生视频' },
  { kind: 'audio', label: '+音频' },
];

export function CanvasLeftTools({
  showMiniMap,
  onAddNode,
  onToggleMiniMap,
  onFitView,
}: {
  showMiniMap: boolean;
  onAddNode: (kind: CanvasNodeKind) => void;
  onToggleMiniMap: () => void;
  onFitView: () => void;
}) {
  return (
    <aside className="studio-canvas-v2-left-tools">
      <div className="studio-canvas-v2-left-tools__group studio-canvas-v2-left-tools__group--primary">
        {ADD_ACTIONS.map((action) => (
          <button
            key={action.kind}
            type="button"
            className="studio-canvas-v2-tool-btn"
            onClick={() => onAddNode(action.kind)}
          >
            {action.label}
          </button>
        ))}
      </div>
      <div className="studio-canvas-v2-left-tools__group studio-canvas-v2-left-tools__group--view">
        <Tooltip title="小地图">
          <button
            type="button"
            className={`studio-canvas-v2-tool-icon${showMiniMap ? ' is-active' : ''}`}
            onClick={onToggleMiniMap}
            aria-label="小地图"
            aria-pressed={showMiniMap}
          >
            <BorderOutlined />
          </button>
        </Tooltip>
        <Tooltip title="适配视图">
          <button type="button" className="studio-canvas-v2-tool-icon" onClick={onFitView} aria-label="适配视图">
            <AppstoreOutlined />
          </button>
        </Tooltip>
      </div>
    </aside>
  );
}
