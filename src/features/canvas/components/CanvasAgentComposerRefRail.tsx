import {
  AudioOutlined,
  CloseOutlined,
  FileTextOutlined,
  PictureOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons';
import { useCallback, useMemo } from 'react';
import type { TurnMaterialBlock } from '../../skills/types';
import { useCanvasAgentPick } from '../context/CanvasAgentPickContext';
import type { CanvasFlowNode } from '../schema/canvasSchema';
import { resolveAgentCanvasNodeRefView } from '../lib/agentCanvasNodeRef';
import { CanvasMaterialChipList } from './CanvasMaterialChipList';
import { CanvasFocusIcon } from './CanvasFocusIcon';

type CanvasAgentComposerRefRailProps = {
  disabled?: boolean;
  materials: TurnMaterialBlock[];
  materialPreviewUrls: ReadonlyMap<number, string>;
  onMaterialsChange: (materials: TurnMaterialBlock[]) => void;
  canvasNodesById?: Map<string, CanvasFlowNode>;
};

/** Agent 输入框顶部：选取按钮 + 已选节点缩略图 + 附件素材 */
export function CanvasAgentComposerRefRail({
  disabled = false,
  materials,
  materialPreviewUrls,
  onMaterialsChange,
  canvasNodesById,
}: CanvasAgentComposerRefRailProps) {
  const {
    isPickMode,
    pickedNodeIds,
    togglePickMode,
    removePickedNode,
    clearPickedNodes,
  } = useCanvasAgentPick();

  const pickedViews = useMemo(
    () =>
      pickedNodeIds.map((nodeId) =>
        resolveAgentCanvasNodeRefView(nodeId, canvasNodesById?.get(nodeId)),
      ),
    [pickedNodeIds, canvasNodesById],
  );

  const mediaMaterials = useMemo(
    () => materials.filter((item) => item.type !== 'node'),
    [materials],
  );

  const handlePickToggle = useCallback(() => {
    if (disabled) {
      return;
    }
    togglePickMode();
  }, [disabled, togglePickMode]);

  const hasPickedNodes = pickedViews.length > 0;
  const hasAttachedAssets = mediaMaterials.length > 0;
  const showClearAll = hasPickedNodes || hasAttachedAssets;

  const handleClearAll = useCallback(() => {
    if (disabled) {
      return;
    }
    if (hasPickedNodes) {
      clearPickedNodes();
    }
    if (hasAttachedAssets) {
      onMaterialsChange([]);
    }
  }, [
    clearPickedNodes,
    disabled,
    hasAttachedAssets,
    hasPickedNodes,
    onMaterialsChange,
  ]);

  return (
    <div className="workflow-canvas-agent-panel__composer-ref-rail">
      <div className="workflow-image-prompt-ref-rail">
        <button
          type="button"
          className={`workflow-canvas-agent-panel__composer-pick-btn${
            isPickMode ? ' workflow-canvas-agent-panel__composer-pick-btn--active' : ''
          }`}
          aria-label="从画布选取节点"
          aria-pressed={isPickMode}
          disabled={disabled}
          onClick={handlePickToggle}
        >
          <CanvasFocusIcon />
        </button>
        {pickedViews.map((view) => (
          <div key={view.nodeId} className="workflow-image-prompt-ref-rail__thumb" title={view.label}>
            {view.mediaType === 'audio' ? (
              <span className="workflow-image-prompt-ref-rail__icon" aria-hidden>
                <AudioOutlined />
              </span>
            ) : view.mediaType === 'text' ? (
              <span className="workflow-image-prompt-ref-rail__icon" aria-hidden>
                <FileTextOutlined />
              </span>
            ) : view.thumbSrc ? (
              <img src={view.thumbSrc} alt={view.label} />
            ) : (
              <span className="workflow-image-prompt-ref-rail__icon" aria-hidden>
                <PictureOutlined />
              </span>
            )}
            {view.mediaType === 'video' ? (
              <span className="workflow-video-prompt-ref-play-badge" aria-hidden>
                <PlayCircleOutlined />
              </span>
            ) : null}
            <button
              type="button"
              className="workflow-image-prompt-ref-rail__thumb-remove"
              aria-label={`移除${view.label}`}
              disabled={disabled}
              onClick={(event) => {
                event.stopPropagation();
                removePickedNode(view.nodeId);
              }}
            >
              <CloseOutlined />
            </button>
          </div>
        ))}
        <CanvasMaterialChipList
          materials={mediaMaterials}
          previewUrlsByAssetId={materialPreviewUrls}
          onRemove={(index) =>
            onMaterialsChange(mediaMaterials.filter((_, i) => i !== index))
          }
        />
      </div>
      {showClearAll ? (
        <button
          type="button"
          className="workflow-canvas-agent-panel__composer-ref-clear"
          aria-label="清空已选节点和素材"
          disabled={disabled}
          onClick={handleClearAll}
        >
          <CloseOutlined />
        </button>
      ) : null}
    </div>
  );
}
