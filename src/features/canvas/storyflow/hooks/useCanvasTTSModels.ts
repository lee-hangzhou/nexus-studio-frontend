import { useStore } from '@xyflow/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { MenuProps } from 'antd';
import { listGenerateVoices, type GenerateVoiceItem } from '../../../../api/generate';
import { useGenerateModelCatalog } from '../../context/GenerateModelCatalogContext';
import { isPlaceholderModelId } from '../../lib/generateModelId';
import { useCanvasActions } from '../context/CanvasActionsContext';
import type { CanvasNodeData } from '../../schema/canvasSchema';

export function useCanvasTTSModels(nodeId: string) {
  const { onNodeChange } = useCanvasActions();
  const catalog = useGenerateModelCatalog();
  const audioCatalog = catalog.audio;

  const data = useStore(
    useCallback((s) => (s.nodeLookup.get(nodeId)?.data ?? {}) as CanvasNodeData, [nodeId]),
  );

  const [voices, setVoices] = useState<GenerateVoiceItem[]>([]);
  const [voicesLoading, setVoicesLoading] = useState(false);
  const [voicesFailed, setVoicesFailed] = useState(false);

  const resolvedModelId = useMemo(
    () => catalog.resolveModelId('audio', data.model_id),
    [catalog, data.model_id],
  );

  const currentSpec = useMemo(
    () => catalog.getSpec('audio', resolvedModelId),
    [catalog, resolvedModelId],
  );

  useEffect(() => {
    if (audioCatalog.loading || !resolvedModelId) return;
    if (data.model_id === resolvedModelId) return;
    if (isPlaceholderModelId(data.model_id) || !audioCatalog.items.some((m) => m.model_id === data.model_id)) {
      onNodeChange({ nodeId, patch: { model_id: resolvedModelId } });
    }
  }, [audioCatalog.loading, audioCatalog.items, resolvedModelId, data.model_id, nodeId, onNodeChange]);

  useEffect(() => {
    if (!resolvedModelId) {
      setVoices([]);
      return;
    }
    let cancelled = false;
    setVoicesLoading(true);
    setVoicesFailed(false);
    void listGenerateVoices(resolvedModelId)
      .then((res) => {
        if (cancelled) return;
        const items = res.items ?? [];
        setVoices(items);
        if (!data.voice_id && items[0]?.voiceId) {
          onNodeChange({ nodeId, patch: { voice_id: items[0].voiceId } });
        }
      })
      .catch(() => {
        if (!cancelled) setVoicesFailed(true);
      })
      .finally(() => {
        if (!cancelled) setVoicesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [resolvedModelId, nodeId, onNodeChange, data.voice_id]);

  const modelLabel = useMemo(() => {
    if (audioCatalog.loading) return '加载中…';
    if (audioCatalog.failed) return '模型加载失败';
    if (audioCatalog.items.length === 0) return '无可用模型';
    return currentSpec?.label ?? '选择模型';
  }, [audioCatalog.loading, audioCatalog.failed, audioCatalog.items.length, currentSpec?.label]);

  const modelMenuItems: MenuProps['items'] = useMemo(
    () =>
      audioCatalog.items.map((opt) => ({
        key: opt.model_id,
        label: opt.label,
        onClick: () => onNodeChange({ nodeId, patch: { model_id: opt.model_id, voice_id: undefined } }),
      })),
    [audioCatalog.items, nodeId, onNodeChange],
  );

  const resolvedVoiceId = useMemo(() => {
    if (data.voice_id && voices.some((v) => v.voiceId === data.voice_id)) return data.voice_id;
    return voices[0]?.voiceId;
  }, [data.voice_id, voices]);

  const voiceLabel = useMemo(() => {
    if (voicesLoading) return '加载音色…';
    if (voicesFailed) return '音色加载失败';
    if (voices.length === 0) return '无可用音色';
    const hit = voices.find((v) => v.voiceId === resolvedVoiceId);
    return hit?.name || hit?.voiceId || '选择音色';
  }, [voicesLoading, voicesFailed, voices, resolvedVoiceId]);

  const voiceMenuItems: MenuProps['items'] = useMemo(
    () =>
      voices.map((voice) => ({
        key: voice.voiceId,
        label: voice.name || voice.voiceId,
        onClick: () => onNodeChange({ nodeId, patch: { voice_id: voice.voiceId } }),
      })),
    [voices, nodeId, onNodeChange],
  );

  const modelReady =
    !audioCatalog.loading &&
    !audioCatalog.failed &&
    audioCatalog.items.length > 0 &&
    !!resolvedModelId &&
    !voicesLoading &&
    !voicesFailed &&
    !!resolvedVoiceId;

  return {
    modelLabel,
    modelMenuItems,
    voiceLabel,
    voiceMenuItems,
    resolvedModelId,
    resolvedVoiceId,
    modelReady,
  };
}
