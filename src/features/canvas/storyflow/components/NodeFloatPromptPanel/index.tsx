import { useCallback, useState, type ReactNode } from 'react';
import { CompressOutlined, ExpandOutlined } from '@ant-design/icons';
import './NodeFloatPromptPanel.less';

export type NodeFloatPromptPanelProps = {
  /** 是否展示（通常：节点选中且未拖拽） */
  visible?: boolean;
  /** 面板宽度，与节点对齐时可取节点 width */
  width?: number | string;
  /** 顶部中间扩展区（参考素材缩略图条；无素材时可省略） */
  topSlot?: ReactNode;
  /** 输入区左上角（如 + 参考），与 placeholder 同区对齐 storyflow */
  bodyLeadingSlot?: ReactNode;
  /** 顶部右侧展开按钮；不传则仍渲染按钮但无回调 */
  onExpand?: () => void;
  /** 中部：Prompt 编辑器等 */
  children: ReactNode;
  /** 底部左侧：模型 / 比例等（设计稿左侧编组） */
  bottomStartSlot?: ReactNode;
  /** 底部中间扩展区 */
  bottomCenterSlot?: ReactNode;
  /** 底部右侧：张数 / 提交等；不传则由使用方完全自定义 bottomEnd */
  bottomEndSlot?: ReactNode;
  className?: string;
};

/**
 * 节点下方悬浮生成输入面板：上/下可插槽，中部为 Prompt。
 * 对齐 canvas-node-generation-input-bar 布局。
 */
export function NodeFloatPromptPanel({
  visible = true,
  width = 680,
  topSlot,
  bodyLeadingSlot,
  onExpand,
  children,
  bottomStartSlot,
  bottomCenterSlot,
  bottomEndSlot,
  className,
}: NodeFloatPromptPanelProps) {
  const [expanded, setExpanded] = useState(false);

  const handleExpandClick = useCallback(() => {
    setExpanded(prev => {
      const next = !prev;
      if (next) {
        onExpand?.();
      }
      return next;
    });
  }, [onExpand]);

  if (!visible) {
    return null;
  }

  return (
    <div
      className={`node-float-prompt nodrag nowheel node-float-prompt--visible${expanded ? ' node-float-prompt--expanded' : ''}${className ? ` ${className}` : ''}`}
      data-testid="canvas-node-generation-input-bar"
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        minWidth: typeof width === 'number' ? `${width}px` : undefined,
        maxWidth: typeof width === 'number' ? `${width}px` : undefined,
      }}
      onPointerDown={e => e.stopPropagation()}
    >
      <div className="node-float-prompt__card">
        {topSlot ? (
          <div className="node-float-prompt__top">
            <div className="node-float-prompt__top-slot">{topSlot}</div>
          </div>
        ) : null}

        <button
          type="button"
          className="node-float-prompt__expand-btn"
          aria-label={expanded ? '收起' : '展开'}
          aria-expanded={expanded}
          onClick={handleExpandClick}
        >
          {expanded ? <CompressOutlined /> : <ExpandOutlined />}
        </button>

        <div
          className={`node-float-prompt__body${bodyLeadingSlot ? ' node-float-prompt__body--with-leading' : ''}`}
        >
          {bodyLeadingSlot ? (
            <div className="node-float-prompt__body-leading">{bodyLeadingSlot}</div>
          ) : null}
          {children}
        </div>

        <div className="node-float-prompt__bottom">
          {bottomStartSlot ? (
            <div className="node-float-prompt__bottom-start">{bottomStartSlot}</div>
          ) : null}
          {bottomCenterSlot ? (
            <div className="node-float-prompt__bottom-center">{bottomCenterSlot}</div>
          ) : null}
          {bottomEndSlot ? (
            <div className="node-float-prompt__bottom-end">{bottomEndSlot}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
