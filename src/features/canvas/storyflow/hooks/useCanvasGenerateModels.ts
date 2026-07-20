import { useStore } from '@xyflow/react';
import { useCallback, useEffect, useMemo } from 'react';
import type { MenuProps } from 'antd';
import type { GenerateModelItem } from '../../../../api/generate';
import { useGenerateModelCatalog } from '../../context/GenerateModelCatalogContext';
import { isPlaceholderModelId } from '../../lib/generateModelId';
import { useCanvasActions } from '../context/CanvasActionsContext';
import type { CanvasNodeData } from '../../schema/canvasSchema';
import {
  RATIO_OPTIONS,
  RESOLUTION_OPTIONS,
  VIDEO_DURATION_OPTIONS,
  VIDEO_REFERENCE_MODES,
} from '../nodes/shared/canvasPromptCopy';

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

  const ratioOptions = useMemo(() => {
    const fromApi = currentSpec?.param_options?.ratios;
    return fromApi?.length ? fromApi : RATIO_OPTIONS;
  }, [currentSpec]);

  const durationOptions = useMemo(() => {
    const fromApi = currentSpec?.param_options?.durations;
    return fromApi?.length ? fromApi : VIDEO_DURATION_OPTIONS;
  }, [currentSpec]);

  const referenceModeOptions = useMemo(() => {
    const fromApi = currentSpec?.param_options?.reference_modes;
    return fromApi?.length ? fromApi : VIDEO_REFERENCE_MODES;
  }, [currentSpec]);

  const resolutionOptions = useMemo(() => {
    const fromApi = currentSpec?.param_options?.resolutions;
    return fromApi?.length ? fromApi : [...RESOLUTION_OPTIONS];
  }, [currentSpec]);

  const modelReady = !loading && !loadFailed && models.length > 0 && !!resolvedModelId;

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
  };
}

export type { GenerateModelItem };
