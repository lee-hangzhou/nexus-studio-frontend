import { useStore } from '@xyflow/react';
import { useCallback, useEffect, useMemo } from 'react';
import type { MenuProps } from 'antd';
import type { GenerateModelItem } from '../../../../api/generate';
import { useGenerateModelCatalog } from '../../context/GenerateModelCatalogContext';
import { isPlaceholderModelId } from '../../lib/generateModelId';
import { useCanvasActions } from '../context/CanvasActionsContext';
import type { CanvasNodeData } from '../../schema/canvasSchema';

export {
  LEGACY_PLACEHOLDER_MODEL_ID,
  hasResolvedModelId,
  isPlaceholderModelId,
} from '../../lib/generateModelId';

export function useCanvasGenerateModels(nodeId: string, kind: 'image' | 'video') {
  const { onNodeChange } = useCanvasActions();
  const catalog = useGenerateModelCatalog();
  const kindCatalog = kind === 'image' ? catalog.image : catalog.video;

  const data = useStore(
    useCallback((s) => (s.nodeLookup.get(nodeId)?.data ?? {}) as CanvasNodeData, [nodeId]),
  );

  const models = kindCatalog.items;
  const loading = kindCatalog.loading;
  const loadFailed = kindCatalog.failed;

  const resolvedModelId = useMemo(
    () => catalog.resolveModelId(kind, data.model_id),
    [catalog, kind, data.model_id],
  );

  const currentSpec = useMemo(
    () => catalog.getSpec(kind, resolvedModelId),
    [catalog, kind, resolvedModelId],
  );

  useEffect(() => {
    if (loading || !resolvedModelId) return;
    if (data.model_id === resolvedModelId) return;
    if (isPlaceholderModelId(data.model_id) || !models.some((m) => m.model_id === data.model_id)) {
      onNodeChange({ nodeId, patch: { model_id: resolvedModelId } });
    }
  }, [loading, resolvedModelId, data.model_id, models, nodeId, onNodeChange]);

  const modelLabel = useMemo(() => {
    if (loading) return '加载中…';
    if (loadFailed) return '模型加载失败';
    if (models.length === 0) return '无可用模型';
    return currentSpec?.label ?? '选择模型';
  }, [loading, loadFailed, models.length, currentSpec?.label]);

  const modelMenuItems: MenuProps['items'] = useMemo(
    () =>
      models.map((opt) => ({
        key: opt.model_id,
        label: opt.label,
        onClick: () => onNodeChange({ nodeId, patch: { model_id: opt.model_id } }),
      })),
    [models, nodeId, onNodeChange],
  );

  const ratioOptions = useMemo(
    () => currentSpec?.param_options?.ratios ?? [],
    [currentSpec],
  );

  const durationOptions = useMemo(
    () => currentSpec?.param_options?.durations ?? [],
    [currentSpec],
  );

  const referenceModeOptions = useMemo(
    () => currentSpec?.param_options?.reference_modes ?? [],
    [currentSpec],
  );

  const resolutionOptions = useMemo(
    () => currentSpec?.param_options?.resolutions ?? [],
    [currentSpec],
  );

  const maxReferenceImages = useMemo(() => {
    const fromCaps = currentSpec?.param_options?.material_limits?.images;
    return typeof fromCaps === 'number' && fromCaps > 0 ? fromCaps : undefined;
  }, [currentSpec]);

  const modelReady = !loading && !loadFailed && models.length > 0 && !!resolvedModelId
    && (
      kind === 'image'
        ? resolutionOptions.length > 0 && ratioOptions.length > 0
        : ratioOptions.length > 0 && durationOptions.length > 0 && referenceModeOptions.length > 0
    );

  return {
    models,
    loading,
    loadFailed,
    modelLabel,
    modelMenuItems,
    resolvedModelId,
    currentSpec,
    modelReady,
    ratioOptions,
    resolutionOptions,
    durationOptions,
    referenceModeOptions,
    maxReferenceImages,
  };
}

export type { GenerateModelItem };
