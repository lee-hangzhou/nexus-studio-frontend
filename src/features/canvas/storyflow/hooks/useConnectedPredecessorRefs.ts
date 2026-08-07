import { useMemo, useRef } from 'react';
import type {
  CanvasMentionProvider,
  WorkflowMentionItem,
  WorkflowMentionMediaType,
} from '../components/CanvasPromptEditor/types';
import {
  assignMentionLabels,
  createCanvasMentionProvider,
  mapConnectedPredecessorsToMentionItems,
  pickConnectedMediaMentionItems,
} from '../providers/canvasMentionProvider';
import {
  pickConnectedPromptInputTexts,
  pickConnectedReferenceAssetIds,
} from '../utils/mergePredecessorTextForSubmit';
import type { CanvasFlowEdge, CanvasFlowNode } from '../../schema/canvasSchema';
import { useDirectPredecessors } from './useDirectPredecessors';
import { useStore } from '@xyflow/react';
import { useCallback } from 'react';
import { IMAGE_PROMPT_MAX_REFERENCE_IMAGES } from '../constants';

type Options = {
  allowedTypes?: WorkflowMentionMediaType[];
  maxReferenceCount?: number;
  /** 额外可 @ 引用项（如本节点已上传素材），仅进 mention 数据源，不进连线预览轨道 */
  extraReferenceItems?: WorkflowMentionItem[];
};

/** 连线前置节点：顶栏预览 + @ 数据源 + 提交 asset id */
export function useConnectedPredecessorRefs(nodeId: string, active: boolean, options?: Options) {
  const allowedTypes = options?.allowedTypes ?? ['image', 'video', 'audio'];
  const maxReferenceCount = options?.maxReferenceCount ?? IMAGE_PROMPT_MAX_REFERENCE_IMAGES;
  const extraReferenceItems = options?.extraReferenceItems ?? [];
  const predecessors = useDirectPredecessors(nodeId, active);
  const graphNodes = useStore(useCallback((s) => (active ? s.nodes : []), [active]));
  const graphEdges = useStore(useCallback((s) => (active ? s.edges : []), [active]));
  const providerRef = useRef<CanvasMentionProvider | null>(null);

  const connectedMentionItems = useMemo(
    () => mapConnectedPredecessorsToMentionItems(predecessors),
    [predecessors],
  );

  const connectedMediaItems = useMemo(
    () => pickConnectedMediaMentionItems(connectedMentionItems, allowedTypes),
    [allowedTypes, connectedMentionItems],
  );

  const previewMediaRefs = useMemo(
    () => connectedMediaItems.slice(0, maxReferenceCount),
    [connectedMediaItems, maxReferenceCount],
  );

  const connectedAssetIds = useMemo(
    () =>
      pickConnectedReferenceAssetIds(
        nodeId,
        graphNodes as CanvasFlowNode[],
        graphEdges as CanvasFlowEdge[],
      ),
    [active, graphEdges, graphNodes, nodeId],
  );

  const connectedPromptTexts = useMemo(
    () =>
      pickConnectedPromptInputTexts(
        nodeId,
        graphNodes as CanvasFlowNode[],
        graphEdges as CanvasFlowEdge[],
      ),
    [active, graphEdges, graphNodes, nodeId],
  );

  const previewTextRefs = useMemo(
    () => connectedMentionItems.filter((item) => item.type === 'text' && item.source === 'connected'),
    [connectedMentionItems],
  );

  const referenceAssets = useMemo(
    () => assignMentionLabels([...connectedMentionItems, ...extraReferenceItems]),
    [connectedMentionItems, extraReferenceItems],
  );

  const assetsRef = useRef(referenceAssets);
  assetsRef.current = referenceAssets;

  if (!providerRef.current) {
    providerRef.current = createCanvasMentionProvider(() => assetsRef.current);
  }

  return {
    mentionProvider: providerRef.current,
    predecessors,
    connectedMentionItems,
    previewMediaRefs,
    previewTextRefs,
    connectedAssetIds,
    connectedPromptTexts,
    connectedImageCount: connectedMediaItems.length,
  };
}
