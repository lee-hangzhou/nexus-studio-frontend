import type { NodeProps } from '@xyflow/react';

/** 节点外壳/内容区 memo：仅在 id、选中、尺寸、data、位置变化时重渲染 */
export function workflowNodePropsAreEqual(
  prev: NodeProps,
  next: NodeProps,
): boolean {
  return (
    prev.id === next.id &&
    prev.selected === next.selected &&
    prev.dragging === next.dragging &&
    prev.type === next.type &&
    prev.width === next.width &&
    prev.height === next.height &&
    prev.data === next.data &&
    prev.positionAbsoluteX === next.positionAbsoluteX &&
    prev.positionAbsoluteY === next.positionAbsoluteY
  );
}
