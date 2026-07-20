import { useReactFlow, type Node } from '@xyflow/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CanvasNodeKind } from '../../api/canvasTypes';
import { DEFAULT_NODE_META } from '../../schema/nodeDefaults';
import { CanvasEmptyState, type CanvasEmptyQuickAction } from './CanvasEmptyState';

const QUICK_TO_KIND: Record<CanvasEmptyQuickAction, CanvasNodeKind> = {
  text_to_video: 'video',
  image_background: 'image',
  first_frame_video: 'video',
  audio_to_video: 'video',
  template: 'text',
};

export function CanvasEmptyStateHost({
  nodes,
  loaded,
  onQuickAdd,
}: {
  nodes: Node[];
  loaded: boolean;
  onQuickAdd: (kind: CanvasNodeKind, position: { x: number; y: number }) => void;
}) {
  const { screenToFlowPosition } = useReactFlow();
  const [stageEl, setStageEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setStageEl(document.querySelector<HTMLElement>('.workflow-canvas-flow__stage'));
  }, []);

  const isEmpty = useMemo(() => nodes.length === 0, [nodes.length]);

  const handleQuickAction = useCallback(
    (action: CanvasEmptyQuickAction) => {
      const stage = document.querySelector<HTMLElement>('.workflow-canvas-flow__stage');
      const rect = stage?.getBoundingClientRect();
      const center = screenToFlowPosition({
        x: rect ? rect.left + rect.width / 2 : window.innerWidth / 2,
        y: rect ? rect.top + rect.height / 2 : window.innerHeight / 2,
      });
      const kind = QUICK_TO_KIND[action];
      void DEFAULT_NODE_META[kind];
      onQuickAdd(kind, center);
    },
    [onQuickAdd, screenToFlowPosition],
  );

  if (!loaded || !isEmpty || !stageEl) return null;

  return createPortal(<CanvasEmptyState onQuickAction={handleQuickAction} />, stageEl);
}
