import { message } from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { listGenerateModels, type GenerateModelItem } from '../../../api/generate';
import { isAuthenticated } from '../../../shared/utils/authGate';
import type { GenerateKind, GenerateRatio } from '../types';
import { normalizeRatioOptions, pickImageRatio } from './paramUtils';

export type GenerateModelOption = { value: string; label: string };

export type EnsureModelPatch = {
  model: string;
  ratio?: GenerateRatio;
  resolution?: string;
  count?: number;
  duration?: number;
  referenceMode?: number;
};

export type UseGenerateModelOptionsResult = {
  models: GenerateModelItem[];
  modelOptions: GenerateModelOption[];
  loading: boolean;
  failed: boolean;
  currentSpec: GenerateModelItem | undefined;
  resolutionOptions: string[];
  countOptions: number[];
  durationOptions: number[];
  referenceModeOptions: { value: number; label: string }[];
  maxMaterialImages: number | undefined;
};

/**
 * 按 kind 拉取生成模型目录（创作页 / HITL 用）。
 * 画布节点继续用 GenerateModelCatalogContext。
 */
export function useGenerateModelOptions(
  kind: GenerateKind,
  modelId: string | undefined,
  onEnsureModel?: (patch: EnsureModelPatch) => void,
): UseGenerateModelOptionsResult {
  const [models, setModels] = useState<GenerateModelItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const onEnsureRef = useRef(onEnsureModel);
  onEnsureRef.current = onEnsureModel;
  const modelIdRef = useRef(modelId);
  modelIdRef.current = modelId;

  const load = useCallback((k: GenerateKind) => {
    let cancelled = false;
    if (!isAuthenticated()) {
      setModels([]);
      setLoading(false);
      setFailed(false);
      return () => {
        cancelled = true;
      };
    }
    setLoading(true);
    setFailed(false);
    void listGenerateModels(k)
      .then((res) => {
        if (cancelled) return;
        const items = res.items ?? [];
        setModels(items);
        if (items.length === 0) {
          message.warning('暂无可用生成模型');
          return;
        }
        const opts = items.map((m) => ({ value: m.model_id, label: m.label }));
        const current = modelIdRef.current;
        if (!current || !opts.find((o) => o.value === current)) {
          const nextSpec = items[0];
          const nextOptions = nextSpec?.param_options;
          const nextRatios = nextOptions?.ratios as GenerateRatio[] | undefined;
          const nextRatio =
            k === 'image' ? pickImageRatio(nextRatios) : nextRatios?.[0];
          onEnsureRef.current?.({
            model: opts[0].value,
            ...(nextRatio ? { ratio: nextRatio } : {}),
            ...(nextOptions?.resolutions?.[0] ? { resolution: nextOptions.resolutions[0] } : {}),
            ...(nextOptions?.counts?.[0] != null ? { count: nextOptions.counts[0] } : {}),
            ...(nextOptions?.durations?.[0] != null ? { duration: nextOptions.durations[0] } : {}),
            ...(nextOptions?.reference_modes?.[0]?.value != null
              ? { referenceMode: nextOptions.reference_modes[0].value }
              : {}),
          });
        }
      })
      .catch(() => {
        if (cancelled) return;
        message.error('模型列表加载失败');
        setModels([]);
        setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => load(kind), [kind, load]);

  const modelOptions = useMemo(
    () => models.map((m) => ({ value: m.model_id, label: m.label })),
    [models],
  );

  const currentSpec = useMemo(
    () => models.find((m) => m.model_id === modelId) ?? models[0],
    [models, modelId],
  );

  const paramOptions = currentSpec?.param_options;
  const maxMaterialImages = paramOptions?.material_limits?.images;

  return {
    models,
    modelOptions,
    loading,
    failed,
    currentSpec,
    resolutionOptions: paramOptions?.resolutions ?? [],
    countOptions: paramOptions?.counts ?? [],
    durationOptions: paramOptions?.durations ?? [],
    referenceModeOptions: paramOptions?.reference_modes ?? [],
    maxMaterialImages: typeof maxMaterialImages === 'number' ? maxMaterialImages : undefined,
  };
}

export function ratiosForResolution(
  spec: GenerateModelItem | undefined,
  resolution: string,
) {
  const paramOptions = spec?.param_options;
  const values =
    paramOptions?.ratios_by_resolution?.[resolution] ?? paramOptions?.ratios;
  return normalizeRatioOptions(values);
}
