import { useStore } from '@xyflow/react';
import { useCallback, useEffect, useMemo } from 'react';
import type { MenuProps } from 'antd';
import { useChatModelCatalog } from '../../context/ChatModelCatalogContext';
import { isPlaceholderChatModelKey } from '../../lib/chatModelKey';
import { useCanvasActions } from '../context/CanvasActionsContext';
import type { CanvasNodeData } from '../../schema/canvasSchema';

/** 文本/音频节点：model_id 字段存 chat model key（与 /chat/model/list 一致）。 */
export function useCanvasChatModels(nodeId: string) {
  const { onNodeChange } = useCanvasActions();
  const catalog = useChatModelCatalog();
  const data = useStore(
    useCallback((s) => (s.nodeLookup.get(nodeId)?.data ?? {}) as CanvasNodeData, [nodeId]),
  );

  const resolvedModelKey = useMemo(
    () => catalog.resolveModelKey(data.model_id),
    [catalog, data.model_id],
  );

  const currentSpec = useMemo(
    () => catalog.getSpec(resolvedModelKey),
    [catalog, resolvedModelKey],
  );

  useEffect(() => {
    if (catalog.loading || !resolvedModelKey) return;
    if (data.generatePending) return;
    if (data.model_id === resolvedModelKey) return;
    if (isPlaceholderChatModelKey(data.model_id) || !catalog.items.some((m) => m.key === data.model_id)) {
      onNodeChange({ nodeId, patch: { model_id: resolvedModelKey } });
    }
  }, [catalog.loading, catalog.items, resolvedModelKey, data.model_id, data.generatePending, nodeId, onNodeChange]);

  const modelLabel = useMemo(() => {
    if (catalog.loading) return '加载中…';
    if (catalog.failed) return '模型加载失败';
    if (catalog.items.length === 0) return '无可用模型';
    return currentSpec?.display_name ?? '选择模型';
  }, [catalog.loading, catalog.failed, catalog.items.length, currentSpec?.display_name]);

  const modelMenuItems: MenuProps['items'] = useMemo(
    () =>
      catalog.items.map((opt) => ({
        key: opt.key,
        label: opt.display_name,
        onClick: () => onNodeChange({ nodeId, patch: { model_id: opt.key } }),
      })),
    [catalog.items, nodeId, onNodeChange],
  );

  const modelReady =
    !catalog.loading && !catalog.failed && catalog.items.length > 0 && !!resolvedModelKey;

  return {
    modelLabel,
    modelMenuItems,
    resolvedModelKey,
    modelReady,
  };
}
