import { useCallback, useEffect, useRef, useState } from 'react';
import type { ConnectDropMenuState, PaneAddNodeMenuState } from '../types';

/** 右键拖动画布超过该距离（px）时视为平移，不再弹出添加节点菜单 */
const RIGHT_CLICK_PAN_THRESHOLD_PX = 5;

/** pane 上 dblclick 会冒泡，需排除节点/连线等可交互层，仅空白区才打开菜单 */
function isBlankPaneHitTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }
  return (
    !target.closest('.react-flow__node') &&
    !target.closest('.react-flow__edge') &&
    !target.closest('.react-flow__controls') &&
    !target.closest('.react-flow__minimap')
  );
}

/** 画布浮层菜单：添加节点 / 连线落点引用菜单，及 pane 点击关闭逻辑 */
export function useCanvasOverlayMenus() {
  const [connectMenu, setConnectMenu] = useState<ConnectDropMenuState | null>(null);
  const [addNodeMenu, setAddNodeMenu] = useState<PaneAddNodeMenuState | null>(null);

  /**
   * 连线松手到 pane 会连续触发 mouseup → click；click 里的 onPaneClick 会清空菜单。
   * onConnectEnd 置 true，下一次 onPaneClick 跳过关闭（仅吞掉这次「松手误触」）。
   */
  const skipNextPaneClickRef = useRef(false);
  /** 右键按下起点，用于区分「右键拖动平移」与「右键打开菜单」 */
  const rightClickPanStartRef = useRef<{ x: number; y: number } | null>(null);
  const rightClickPanMovedRef = useRef(false);
  const onPaneDoubleClickRef = useRef<(event: MouseEvent | React.MouseEvent) => void>(() => {});

  /** 画布 pane：右键拖动平移 vs 右键菜单；空白区双击打开添加节点菜单 */
  useEffect(() => {
    const pane = document.querySelector('.workflow-canvas-flow .react-flow__pane');
    if (!pane) {
      return;
    }

    const onMouseDown = (event: Event) => {
      const mouseEvent = event as MouseEvent;
      if (mouseEvent.button !== 2) {
        return;
      }
      rightClickPanStartRef.current = { x: mouseEvent.clientX, y: mouseEvent.clientY };
      rightClickPanMovedRef.current = false;
    };

    const onMouseMove = (event: Event) => {
      const mouseEvent = event as MouseEvent;
      const start = rightClickPanStartRef.current;
      if (!start || rightClickPanMovedRef.current) {
        return;
      }
      const dx = mouseEvent.clientX - start.x;
      const dy = mouseEvent.clientY - start.y;
      if (Math.hypot(dx, dy) > RIGHT_CLICK_PAN_THRESHOLD_PX) {
        rightClickPanMovedRef.current = true;
      }
    };

    const onMouseUp = (event: Event) => {
      const mouseEvent = event as MouseEvent;
      if (mouseEvent.button !== 2) {
        return;
      }
      rightClickPanStartRef.current = null;
    };

    const onDoubleClick = (event: Event) => {
      if (!isBlankPaneHitTarget(event.target)) {
        return;
      }
      onPaneDoubleClickRef.current(event as MouseEvent);
    };

    pane.addEventListener('mousedown', onMouseDown);
    pane.addEventListener('dblclick', onDoubleClick);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      pane.removeEventListener('mousedown', onMouseDown);
      pane.removeEventListener('dblclick', onDoubleClick);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  const closeOverlayMenus = useCallback(() => {
    skipNextPaneClickRef.current = false;
    setConnectMenu(null);
    setAddNodeMenu(null);
  }, []);

  const onPaneClick = useCallback(() => {
    if (skipNextPaneClickRef.current) {
      skipNextPaneClickRef.current = false;
      return;
    }
    closeOverlayMenus();
  }, [closeOverlayMenus]);

  const onPaneContextMenu = useCallback((event: MouseEvent | React.MouseEvent) => {
    event.preventDefault();
    if (rightClickPanMovedRef.current) {
      rightClickPanMovedRef.current = false;
      return;
    }
    setConnectMenu(null);
    setAddNodeMenu({
      screenX: event.clientX,
      screenY: event.clientY,
    });
  }, []);

  /** 画布空白区双击：打开添加节点菜单（与右键画布一致） */
  const onPaneDoubleClick = useCallback((event: MouseEvent | React.MouseEvent) => {
    if (!isBlankPaneHitTarget(event.target)) {
      return;
    }
    setConnectMenu(null);
    setAddNodeMenu({
      screenX: event.clientX,
      screenY: event.clientY,
    });
  }, []);
  onPaneDoubleClickRef.current = onPaneDoubleClick;

  const markSkipNextPaneClick = useCallback(() => {
    skipNextPaneClickRef.current = true;
  }, []);

  return {
    connectMenu,
    setConnectMenu,
    addNodeMenu,
    setAddNodeMenu,
    closeOverlayMenus,
    onPaneClick,
    onPaneContextMenu,
    onPaneDoubleClick,
    markSkipNextPaneClick,
  };
}
