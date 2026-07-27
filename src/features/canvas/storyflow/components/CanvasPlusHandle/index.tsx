import { PlusOutlined } from '@ant-design/icons';
import { Handle, Position, type HandleProps } from '@xyflow/react';
import './CanvasPlusHandle.less';
import { useCallback, useRef } from 'react';

const PLUS_CENTER_TRANSFORM = 'translate(-50%, -50%)';

/** 将加号中心限制在 orb 矩形内 */
function clampPlusOffset(
  orb: DOMRect,
  plusW: number,
  plusH: number,
  clientX: number,
  clientY: number,
) {
  const halfW = plusW / 2;
  const halfH = plusH / 2;
  const localX = clientX - orb.left;
  const localY = clientY - orb.top;
  const x = Math.max(halfW, Math.min(orb.width - halfW, localX));
  const y = Math.max(halfH, Math.min(orb.height - halfH, localY));
  return {
    offsetX: x - orb.width / 2,
    offsetY: y - orb.height / 2,
  };
}

/**
 * 连线锚点贴在节点左右边框中点；可视「+」圆钮仅在悬浮/选中时出现，
 * 点击圆钮拖拽拉线（底层仍用 React Flow Handle，非默认样式）。
 */
export function CanvasPlusHandle({
  type,
  position,
  hidden = false,
}: {
  type: HandleProps['type'];
  position: Position.Left | Position.Right;
  /** 拖拽节点时隐藏可视圆钮并禁用命中 */
  hidden?: boolean;
}) {
  const side = position === Position.Left ? 'left' : 'right';
  const orbRef = useRef<HTMLDivElement>(null);
  const plusRef = useRef<HTMLSpanElement>(null);
  /** 进入加号后开始跟手，直到指针离开 plus */
  const trackingRef = useRef(false);

  const resetPlusPosition = useCallback(() => {
    trackingRef.current = false;
    const plus = plusRef.current;
    if (plus) plus.style.transform = PLUS_CENTER_TRANSFORM;
  }, []);

  const followPointerInOrb = useCallback((clientX: number, clientY: number) => {
    const orb = orbRef.current;
    const plus = plusRef.current;
    if (!orb || !plus) return;

    const rect = orb.getBoundingClientRect();
    const { offsetX, offsetY } = clampPlusOffset(
      rect,
      plus.offsetWidth,
      plus.offsetHeight,
      clientX,
      clientY,
    );
    plus.style.transform = `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))`;
  }, []);

  const handlePlusMouseEnter = useCallback(
    (e: React.MouseEvent<HTMLSpanElement>) => {
      trackingRef.current = true;
      followPointerInOrb(e.clientX, e.clientY);
    },
    [followPointerInOrb],
  );

  const handlePlusMouseMove = useCallback(
    (e: React.MouseEvent<HTMLSpanElement>) => {
      if (!trackingRef.current) return;
      followPointerInOrb(e.clientX, e.clientY);
    },
    [followPointerInOrb],
  );

  return (
    <Handle
      type={type}
      position={position}
      id={side}
      className={`nodrag nopan workflow-canvas-handle workflow-canvas-handle--${side}`}
    >
      <div
        ref={orbRef}
        className={`workflow-canvas-handle__orb workflow-canvas-handle__orb--${side}${hidden ? ' workflow-canvas-handle__orb--hidden' : ''}`}
        aria-hidden
      >
        <span
          ref={plusRef}
          className="workflow-canvas-handle__plus"
          onMouseEnter={handlePlusMouseEnter}
          onMouseMove={handlePlusMouseMove}
          onMouseLeave={resetPlusPosition}
        >
          <PlusOutlined />
        </span>
      </div>
    </Handle>
  );
}
