import { Button, Input, Select, message } from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getAsset } from '../../../api/assets';
import { uploadGenerateMaterial } from '../../../api/generate';
import type {
  PendingCanvasPatchOperation,
  PendingGenerateOperation,
  ToolPendingOperation,
} from '../../../api/toolPending';
import type { GenerateKind, GenerateRatio, GenerateRefImage, GenerateResolution } from '../../generate/types';
import {
  GenerationParamsPanel,
  GenerationRefRail,
  filledRefs,
  isDualFrameMode,
  isFirstFrameMode,
  isFrameSlotMode,
  normalizeUploadedAssetsForMode,
  ratiosForResolution,
  resolveMaxReferenceImages,
  useGenerateModelOptions,
} from '../../generate/composer';
import styles from './CanvasNodePendingCard.module.css';

type Props = {
  summary: string;
  operation: PendingCanvasPatchOperation | PendingGenerateOperation;
  loading?: boolean;
  onConfirm: (operation: ToolPendingOperation) => void;
  onReject: () => void;
};

function segmentText(content: unknown): string {
  if (!Array.isArray(content)) return '';
  const parts: string[] = [];
  for (const seg of content) {
    if (!seg || typeof seg !== 'object') continue;
    const row = seg as { type?: string; text?: string };
    if (row.type === 'text' && typeof row.text === 'string') parts.push(row.text);
  }
  return parts.join('');
}

function hasNonTextSegments(content: unknown): boolean {
  if (!Array.isArray(content)) return false;
  return content.some(
    (seg) => seg && typeof seg === 'object' && (seg as { type?: string }).type !== 'text',
  );
}

function readBody(operation: PendingCanvasPatchOperation | PendingGenerateOperation): string {
  const node =
    operation.type === 'generate' ? operation.node : operation.nodes?.[0];
  if (!node?.data) return '';
  const data = node.data;
  // text create/update：只读生成输入（prompt / prompt_content），禁止回退 content 正文
  if (node.kind === 'text' && operation.type !== 'generate') {
    if (typeof data.prompt === 'string' && data.prompt) return data.prompt;
    if (Array.isArray(data.prompt_content)) {
      const fromPromptContent = data.prompt_content
        .filter((s) => s && typeof s === 'object' && (s as { type?: string }).type === 'text')
        .map((s) => String((s as { text?: string }).text ?? ''))
        .filter(Boolean)
        .join('\n');
      if (fromPromptContent) return fromPromptContent;
    }
    return '';
  }
  if (typeof data.prompt === 'string' && data.prompt) return data.prompt;
  if (Array.isArray(data.prompt_content)) {
    const fromPromptContent = data.prompt_content
      .filter((s) => s && typeof s === 'object' && (s as { type?: string }).type === 'text')
      .map((s) => String((s as { text?: string }).text ?? ''))
      .filter(Boolean)
      .join('\n');
    if (fromPromptContent) return fromPromptContent;
  }
  return segmentText(data.content);
}

function toNum(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function readGenerateConfig(operation: PendingGenerateOperation) {
  const node = operation.node;
  const config = node?.data?.config ?? {};
  const args = operation.submit_args;
  return {
    model: String(node?.data?.model ?? config.model ?? args.model_id ?? ''),
    ratio: String(config.ratio ?? args.ratio ?? ''),
    resolution: String(config.resolution ?? args.resolution ?? ''),
    duration:
      toNum(config.duration_sec)
      ?? (config.duration ? toNum(config.duration) : undefined)
      ?? toNum(args.duration),
    voice_id: String(config.voice_id ?? args.voice_id ?? ''),
    referenceMode:
      toNum(config.reference_mode) ?? toNum(args.reference_mode) ?? undefined,
    count: toNum(config.img_num) ?? toNum(args.count) ?? 1,
    refAssetIds: Array.isArray(args.ref_asset_ids)
      ? args.ref_asset_ids.map((id) => Number(id)).filter((id) => Number.isFinite(id))
      : [],
  };
}

function kindOfGenerate(operation: PendingGenerateOperation): 'image' | 'video' | 'audio' {
  const raw = String(operation.node.kind ?? operation.submit_args.kind ?? '');
  if (raw === 'video' || raw === 'audio') return raw;
  return 'image';
}

export function CanvasNodePendingCard({ summary, operation, loading, onConfirm, onReject }: Props) {
  const initialBody = useMemo(() => readBody(operation), [operation]);
  const generateKind = operation.type === 'generate' ? kindOfGenerate(operation) : null;
  const mediaKind: GenerateKind | null =
    generateKind === 'image' || generateKind === 'video' ? generateKind : null;

  const initialGenerate = useMemo(
    () => (operation.type === 'generate' ? readGenerateConfig(operation) : null),
    [operation],
  );

  const [bodyText, setBodyText] = useState(initialBody);
  const [model, setModel] = useState(initialGenerate?.model ?? '');
  const [ratio, setRatio] = useState<GenerateRatio>(initialGenerate?.ratio ?? '');
  const [resolution, setResolution] = useState<GenerateResolution>(
    initialGenerate?.resolution ?? '',
  );
  const [duration, setDuration] = useState<number | undefined>(initialGenerate?.duration);
  const [voiceId, setVoiceId] = useState(initialGenerate?.voice_id ?? '');
  const [referenceMode, setReferenceMode] = useState<number | undefined>(
    initialGenerate?.referenceMode,
  );
  const [count, setCount] = useState(initialGenerate?.count ?? 1);
  const [uploadedAssets, setUploadedAssets] = useState<(GenerateRefImage | null)[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingSlotRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    setBodyText(initialBody);
    if (!initialGenerate) return;
    setModel(initialGenerate.model);
    setRatio(initialGenerate.ratio);
    setResolution(initialGenerate.resolution);
    setDuration(initialGenerate.duration);
    setVoiceId(initialGenerate.voice_id);
    setReferenceMode(initialGenerate.referenceMode);
    setCount(initialGenerate.count);
  }, [initialBody, initialGenerate]);

  useEffect(() => {
    if (!initialGenerate?.refAssetIds.length) {
      setUploadedAssets([]);
      return;
    }
    const placeholders = initialGenerate.refAssetIds.map(
      (assetId) =>
        ({
          id: `ref-${assetId}`,
          assetId,
          url: '',
          name: `素材 ${assetId}`,
          mimeType: 'application/octet-stream',
        }) satisfies GenerateRefImage,
    );
    const kind = mediaKind ?? 'image';
    setUploadedAssets(
      normalizeUploadedAssetsForMode(kind, initialGenerate.referenceMode, placeholders),
    );
    let cancelled = false;
    void (async () => {
      const loaded = await Promise.all(
        initialGenerate.refAssetIds.map(async (assetId) => {
          try {
            const asset = await getAsset(String(assetId));
            return {
              id: `ref-${assetId}`,
              assetId,
              url: asset.previewUrl || '',
              name: asset.title || `素材 ${assetId}`,
              mimeType: asset.mimeType || 'application/octet-stream',
            } satisfies GenerateRefImage;
          } catch {
            return {
              id: `ref-${assetId}`,
              assetId,
              url: '',
              name: `素材 ${assetId}`,
              mimeType: 'application/octet-stream',
            } satisfies GenerateRefImage;
          }
        }),
      );
      if (cancelled) return;
      setUploadedAssets(
        normalizeUploadedAssetsForMode(kind, initialGenerate.referenceMode, loaded),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [initialGenerate, mediaKind]);

  const ensureModel = useCallback(
    (patch: {
      model: string;
      ratio?: GenerateRatio;
      resolution?: string;
      count?: number;
      duration?: number;
      referenceMode?: number;
    }) => {
      setModel(patch.model);
      if (patch.ratio) setRatio(patch.ratio);
      if (patch.resolution) setResolution(patch.resolution);
      if (patch.count != null) setCount(patch.count);
      if (patch.duration != null) setDuration(patch.duration);
      if (patch.referenceMode != null) {
        setReferenceMode(patch.referenceMode);
        if (mediaKind) {
          setUploadedAssets((prev) =>
            normalizeUploadedAssetsForMode(mediaKind, patch.referenceMode, prev),
          );
        }
      }
    },
    [mediaKind],
  );

  const modelCatalog = useGenerateModelOptions(
    mediaKind ?? 'image',
    model,
    mediaKind ? ensureModel : undefined,
  );

  const ratioOptions = useMemo(
    () => ratiosForResolution(modelCatalog.currentSpec, resolution),
    [modelCatalog.currentSpec, resolution],
  );

  const maxRefs = resolveMaxReferenceImages({
    kind: mediaKind ?? 'image',
    referenceMode,
    materialLimit: modelCatalog.maxMaterialImages,
  });

  const frameSlotMode = mediaKind
    ? isFrameSlotMode(mediaKind, referenceMode)
    : false;

  const title =
    operation.type === 'create' ? '创建节点' : operation.type === 'update' ? '更新节点' : '确认生成';

  const confirmLabel =
    operation.type === 'create' ? '创建' : operation.type === 'update' ? '更新' : '确认';

  const mediaNode =
    operation.type === 'generate'
      ? operation.node
      : operation.nodes?.[0];
  const textOnlyHint =
    mediaNode &&
    mediaNode.kind !== 'text' &&
    operation.type !== 'generate' &&
    hasNonTextSegments(mediaNode.data?.content);

  const handleReferenceModeChange = (next: number) => {
    setReferenceMode(next);
    if (mediaKind) {
      setUploadedAssets((prev) => normalizeUploadedAssetsForMode(mediaKind, next, prev));
    }
  };

  const openFilePicker = (slotIndex?: number) => {
    pendingSlotRef.current = slotIndex;
    fileInputRef.current?.click();
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length || !mediaKind) return;
    const list = Array.from(files);
    const imageOnly = frameSlotMode;
    const accepted = imageOnly ? list.filter((f) => f.type.startsWith('image/')) : list;
    if (!accepted.length) {
      message.warning('当前参考模式仅支持图片');
      return;
    }
    const uploadOne = async (file: File): Promise<GenerateRefImage> => {
      const asset = await uploadGenerateMaterial(file);
      return {
        id: `ref-${asset.asset_id}`,
        assetId: asset.asset_id,
        url: asset.url,
        name: asset.filename || file.name,
        mimeType: asset.mime_type || file.type,
      };
    };
    setUploading(true);
    try {
      const targetIndex = pendingSlotRef.current;
      if (frameSlotMode && (isFirstFrameMode(mediaKind, referenceMode) || isDualFrameMode(mediaKind, referenceMode))) {
        if (isFirstFrameMode(mediaKind, referenceMode)) {
          setUploadedAssets([await uploadOne(accepted[0])]);
          return;
        }
        const slot = targetIndex === 1 ? 1 : targetIndex === 0 ? 0 : uploadedAssets[0] ? 1 : 0;
        const next = await uploadOne(accepted[0]);
        setUploadedAssets((prev) => {
          const slots: [GenerateRefImage | null, GenerateRefImage | null] = [
            prev[0] ?? null,
            prev[1] ?? null,
          ];
          slots[slot] = next;
          return slots;
        });
        return;
      }
      const current = filledRefs(uploadedAssets);
      const room = maxRefs - current.length;
      const selected = accepted.slice(0, Math.max(room, 0));
      const uploaded = await Promise.all(selected.map(uploadOne));
      setUploadedAssets((prev) => [...filledRefs(prev), ...uploaded].slice(0, maxRefs));
    } catch {
      message.error('参考素材上传失败');
    } finally {
      setUploading(false);
      pendingSlotRef.current = undefined;
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const collectRefAssetIds = (): number[] | null => {
    if (!mediaKind) return [];
    if (isDualFrameMode(mediaKind, referenceMode)) {
      const first = uploadedAssets[0];
      const last = uploadedAssets[1];
      if (!first?.assetId || !last?.assetId) {
        message.warning(first ? '请上传尾帧参考图' : '请上传首帧参考图');
        return null;
      }
      return [first.assetId, last.assetId];
    }
    if (isFirstFrameMode(mediaKind, referenceMode)) {
      const first = uploadedAssets[0] ?? filledRefs(uploadedAssets)[0];
      if (!first?.assetId) {
        message.warning('请上传首帧参考图');
        return null;
      }
      return [first.assetId];
    }
    return filledRefs(uploadedAssets)
      .map((item) => item.assetId)
      .filter((id): id is number => typeof id === 'number' && Number.isFinite(id));
  };

  const buildEdited = (): ToolPendingOperation | null => {
    if (operation.type === 'generate') {
      const refIds = collectRefAssetIds();
      if (refIds == null) return null;
      const node = structuredClone(operation.node);
      const data = { ...(node.data ?? {}) };
      const config = { ...(data.config ?? {}) };
      const submitArgs = { ...operation.submit_args };
      // generate 仅媒体；确认卡只改 prompt / config / submit_args，不写 content 正文
      data.prompt = bodyText;
      submitArgs.prompt = bodyText;
      if (model) {
        data.model = model;
        config.model = model;
        submitArgs.model_id = model;
      }
      if (ratio) {
        config.ratio = ratio;
        submitArgs.ratio = ratio;
      }
      if (resolution) {
        config.resolution = resolution;
        submitArgs.resolution = resolution;
      }
      if (duration != null) {
        config.duration_sec = duration;
        config.duration = String(duration);
        submitArgs.duration = duration;
      }
      if (voiceId) {
        config.voice_id = voiceId;
        submitArgs.voice_id = voiceId;
      }
      if (referenceMode != null) {
        config.reference_mode = referenceMode;
        submitArgs.reference_mode = referenceMode as 1 | 2 | 3 | 4;
      }
      if (generateKind === 'image') {
        config.img_num = count;
        submitArgs.count = count;
      }
      if (mediaKind) {
        submitArgs.ref_asset_ids = refIds;
      }
      data.config = config;
      node.data = data;
      return {
        type: 'generate',
        node,
        submit_args: submitArgs,
      };
    }
    const nodes = structuredClone(operation.nodes ?? []);
    const node = nodes[0];
    if (node) {
      const data = { ...(node.data ?? {}) };
      if (node.kind === 'text') {
        // text 确认卡编辑生成输入：写 prompt + prompt_content，不碰正文 content
        data.prompt = bodyText;
        data.prompt_content = bodyText.trim()
          ? [{ type: 'text' as const, text: bodyText.trim() }]
          : [];
      } else {
        data.prompt = bodyText;
        const existingContent = Array.isArray(data.content) ? [...data.content] : [];
        const nonText = existingContent.filter(
          (seg) => seg && typeof seg === 'object' && (seg as { type?: string }).type !== 'text',
        );
        data.content = bodyText
          ? [{ type: 'text' as const, text: bodyText }, ...nonText]
          : nonText.length
            ? nonText
            : null;
      }
      node.data = data;
      nodes[0] = node;
    }
    return { type: operation.type, nodes, edges: operation.edges ?? [] };
  };

  return (
    <div className={`workflow-canvas-agent-panel__pending-card ${styles.card}`}>
      <p className="workflow-canvas-agent-panel__text">
        <strong>{title}</strong>
        {summary ? ` · ${summary}` : null}
      </p>
      <label className={styles.field}>
        <span className={styles.label}>
          {operation.type === 'generate'
            ? '提示词'
            : mediaNode?.kind === 'text'
              ? '生成输入（不改正文）'
              : '提示词 / 正文'}
        </span>
        <Input.TextArea
          value={bodyText}
          onChange={(e) => setBodyText(e.target.value)}
          rows={4}
          disabled={loading}
          aria-label="提示词或正文"
        />
      </label>
      {textOnlyHint ? (
        <p className={styles.hint} role="note">
          仅编辑文本段；图片/视频/音频引用段确认后仍保留，无法在此卡修改
        </p>
      ) : null}
      {operation.type === 'generate' && mediaKind ? (
        <div className={styles.generateCore}>
          <label className={styles.field}>
            <span className={styles.label}>模型</span>
            <Select
              disabled={loading || modelCatalog.loading}
              aria-label="模型"
              value={model || undefined}
              onChange={(v) => {
                setModel(v);
                const spec = modelCatalog.models.find((m) => m.model_id === v);
                const opts = spec?.param_options;
                if (opts?.ratios?.[0]) setRatio(opts.ratios[0]);
                if (opts?.resolutions?.[0]) setResolution(opts.resolutions[0]);
                if (opts?.counts?.[0] != null) setCount(opts.counts[0]);
                if (opts?.durations?.[0] != null) setDuration(opts.durations[0]);
                if (opts?.reference_modes?.[0]?.value != null) {
                  handleReferenceModeChange(opts.reference_modes[0].value);
                }
              }}
              options={modelCatalog.modelOptions}
              className={styles.modelSelect}
            />
          </label>

          <div className={styles.refBlock}>
            <span className={styles.label}>参考素材</span>
            <GenerationRefRail
              kind={mediaKind}
              referenceMode={referenceMode}
              assets={uploadedAssets}
              maxOmniAssets={maxRefs}
              uploading={uploading}
              onAdd={(slot) => openFilePicker(slot)}
              onRemove={(id) =>
                setUploadedAssets((prev) => prev.filter((item) => item && item.id !== id))
              }
              onRemoveSlot={(index) => {
                setUploadedAssets((prev) => {
                  if (isDualFrameMode(mediaKind, referenceMode)) {
                    const slots: [GenerateRefImage | null, GenerateRefImage | null] = [
                      prev[0] ?? null,
                      prev[1] ?? null,
                    ];
                    slots[index] = null;
                    return slots;
                  }
                  return [];
                });
              }}
              onSwapFrames={() => {
                setUploadedAssets((prev) => [prev[1] ?? null, prev[0] ?? null]);
              }}
            />
            <input
              ref={fileInputRef}
              type="file"
              hidden
              accept={frameSlotMode ? 'image/*' : 'image/*,video/*'}
              multiple={!frameSlotMode}
              onChange={(e) => void handleFiles(e.target.files)}
            />
          </div>

          <div className={styles.paramsBlock}>
            <GenerationParamsPanel
              kind={mediaKind}
              ratio={ratio}
              resolution={resolution}
              count={count}
              duration={duration}
              referenceMode={referenceMode}
              ratioOptions={ratioOptions}
              resolutionOptions={modelCatalog.resolutionOptions}
              countOptions={modelCatalog.countOptions}
              durationOptions={modelCatalog.durationOptions}
              referenceModeOptions={modelCatalog.referenceModeOptions}
              onRatioChange={setRatio}
              onResolutionChange={(v) => {
                setResolution(v);
                const nextRatios = ratiosForResolution(modelCatalog.currentSpec, v);
                if (nextRatios.length && !nextRatios.some((r) => r.value === ratio)) {
                  setRatio(nextRatios[0].value);
                }
              }}
              onCountChange={setCount}
              onDurationChange={setDuration}
              onReferenceModeChange={handleReferenceModeChange}
            />
          </div>
        </div>
      ) : null}
      {operation.type === 'generate' && generateKind === 'audio' ? (
        <div className={styles.fields}>
          <label className={styles.field}>
            <span className={styles.label}>模型</span>
            <Input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={loading}
              aria-label="模型"
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>音色</span>
            <Input
              value={voiceId}
              onChange={(e) => setVoiceId(e.target.value)}
              disabled={loading}
              aria-label="音色"
            />
          </label>
        </div>
      ) : null}
      <div className={`workflow-canvas-agent-panel__gate ${styles.actions}`}>
        <Button
          size="small"
          type="primary"
          loading={loading}
          onClick={() => {
            const edited = buildEdited();
            if (edited) onConfirm(edited);
          }}
        >
          {confirmLabel}
        </Button>
        <Button size="small" disabled={loading} onClick={onReject}>
          拒绝
        </Button>
      </div>
    </div>
  );
}
