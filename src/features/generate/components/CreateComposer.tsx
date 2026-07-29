import { message, Select } from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { listAssets } from '../../../api/assets';
import { uploadGenerateMaterial } from '../../../api/generate';
import { ComposerSendButton } from '../../../shared/ui/ComposerSendButton';
import { ComposerShell } from '../../../shared/ui/ComposerShell';
import { isAuthenticated } from '../../../shared/utils/authGate';
import type { GenerateKind, GenerateRatio, GenerateRefImage, GenerateResolution } from '../types';
import {
  buildParamsCapsuleLabel,
  createMentionProvider,
  editorPlaceholderForMode,
  filledRefs,
  GenerationParamsCapsule,
  GenerationPromptEditor,
  GenerationRefRail,
  isDualFrameMode,
  isFirstFrameMode,
  isFrameSlotMode,
  normalizeUploadedAssetsForMode,
  pickImageRatio,
  ratiosForResolution,
  refsToMentionItems,
  resolveMaxReferenceImages,
  useGenerateModelOptions,
  type CanvasPromptEditorPayload,
} from '../composer';

const TASK_TYPE_OPTIONS = [
  { value: 'image', label: '图片生成' },
  { value: 'video', label: '视频生成' },
];

export interface CreateComposerParams {
  ratio: GenerateRatio;
  resolution: GenerateResolution;
  count: number;
  duration?: number;
  referenceMode?: number;
  model: string;
}

export type RefImage = GenerateRefImage;

export interface CreateComposerSubmitPayload {
  kind: GenerateKind;
  prompt: string;
  params: CreateComposerParams;
  refImages: RefImage[];
}

interface CreateComposerProps {
  kind: GenerateKind;
  params: CreateComposerParams;
  draft?: { key: string; prompt: string; refImages?: RefImage[] } | null;
  onKindChange: (kind: GenerateKind) => void;
  onParamsChange: (params: Partial<CreateComposerParams>) => void;
  onSubmit: (payload: CreateComposerSubmitPayload) => void;
}

export function CreateComposer({
  kind,
  params,
  draft,
  onKindChange,
  onParamsChange,
  onSubmit,
}: CreateComposerProps) {
  const [prompt, setPrompt] = useState('');
  const [promptKey, setPromptKey] = useState(0);
  const [uploadedAssets, setUploadedAssets] = useState<(RefImage | null)[]>([]);
  const [materialsUploading, setMaterialsUploading] = useState(false);
  const [favoriteMaterials, setFavoriteMaterials] = useState<RefImage[]>([]);
  const composerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetIndexRef = useRef<number | null>(null);
  const promptDraftRef = useRef('');

  const ensureModel = useCallback(
    (patch: {
      model: string;
      ratio?: GenerateRatio;
      resolution?: string;
      count?: number;
      duration?: number;
      referenceMode?: number;
    }) => {
      onParamsChange(patch);
    },
    [onParamsChange],
  );

  const {
    modelOptions,
    loading: modelsLoading,
    currentSpec,
    resolutionOptions,
    countOptions,
    durationOptions,
    referenceModeOptions,
    maxMaterialImages,
  } = useGenerateModelOptions(kind, params.model, ensureModel);

  const currentModel = params.model || modelOptions[0]?.value || '';
  const ratioOptions = ratiosForResolution(currentSpec, params.resolution);
  const isFirst = isFirstFrameMode(kind, params.referenceMode);
  const isDual = isDualFrameMode(kind, params.referenceMode);
  const frameSlotMode = isFrameSlotMode(kind, params.referenceMode);
  const maxReferenceImages = resolveMaxReferenceImages({
    kind,
    referenceMode: params.referenceMode,
    materialLimit: maxMaterialImages,
  });
  const refImages = filledRefs(uploadedAssets);
  const dualSlots: [RefImage | null, RefImage | null] = isDual
    ? [uploadedAssets[0] ?? null, uploadedAssets[1] ?? null]
    : [null, null];
  const paramsReady = Boolean(
    currentSpec
    && (
      kind === 'image'
        ? resolutionOptions.length > 0 && ratioOptions.length > 0 && countOptions.length > 0
        : ratioOptions.length > 0 && durationOptions.length > 0 && referenceModeOptions.length > 0
    ),
  );

  const mentionMaterials = useMemo(
    () => [
      ...refImages,
      ...favoriteMaterials.filter(
        (asset) => !refImages.some((item) => item.assetId != null && item.assetId === asset.assetId),
      ),
    ],
    [favoriteMaterials, refImages],
  );

  const mentionProvider = useMemo(
    () => createMentionProvider(refsToMentionItems(frameSlotMode ? [] : mentionMaterials)),
    [frameSlotMode, mentionMaterials],
  );

  const loadFavoriteMaterials = useCallback(() => {
    if (!isAuthenticated()) {
      setFavoriteMaterials([]);
      return;
    }
    void listAssets({ page: 1, page_size: 80, favorites_only: true })
      .then((res) => {
        setFavoriteMaterials(
          res.items
            .filter((asset) => asset.kind === 'image' || asset.kind === 'video')
            .map((asset) => ({
              id: `asset-${asset.id}`,
              assetId: Number(asset.id),
              url: asset.previewUrl ?? '',
              name: asset.filename || asset.title,
              mimeType: asset.mimeType || (asset.kind === 'video' ? 'video/mp4' : 'image/png'),
            }))
            .filter((asset) => asset.url),
        );
      })
      .catch(() => {
        setFavoriteMaterials([]);
      });
  }, []);

  useEffect(() => {
    loadFavoriteMaterials();
  }, [loadFavoriteMaterials]);

  useEffect(() => {
    if (!draft) return;
    const refs = draft.refImages ?? [];
    setUploadedAssets(refs);
    setPrompt(draft.prompt);
    promptDraftRef.current = draft.prompt;
    setPromptKey((k) => k + 1);
  }, [draft]);

  useEffect(() => {
    setUploadedAssets((prev) =>
      normalizeUploadedAssetsForMode(kind, params.referenceMode, prev),
    );
  }, [kind, params.referenceMode]);

  useEffect(() => {
    if (!currentSpec) return;
    const next: Partial<CreateComposerParams> = {};
    const nextResolutions = currentSpec.param_options?.resolutions ?? [];
    const nextCounts = currentSpec.param_options?.counts ?? [];
    const nextDurations = currentSpec.param_options?.durations ?? [];
    const nextReferenceModes = currentSpec.param_options?.reference_modes ?? [];
    const nextRatioValues =
      currentSpec.param_options?.ratios_by_resolution?.[params.resolution]
      ?? currentSpec.param_options?.ratios
      ?? [];

    if (nextResolutions.length > 0 && !nextResolutions.includes(params.resolution)) {
      next.resolution = nextResolutions[0];
    }
    if (nextRatioValues.length > 0 && !nextRatioValues.includes(params.ratio)) {
      const picked =
        kind === 'image'
          ? pickImageRatio(nextRatioValues as GenerateRatio[])
          : nextRatioValues[0];
      if (picked) next.ratio = picked;
    }
    if (kind === 'image' && nextCounts.length > 0 && !nextCounts.includes(params.count)) {
      next.count = nextCounts[0];
    }
    if (kind === 'video' && nextDurations.length > 0 && !nextDurations.includes(params.duration ?? 0)) {
      next.duration = nextDurations[0];
    }
    if (
      kind === 'video'
      && nextReferenceModes.length > 0
      && !nextReferenceModes.some((mode) => mode.value === params.referenceMode)
    ) {
      next.referenceMode = nextReferenceModes[0].value;
    }
    if (Object.keys(next).length > 0) {
      onParamsChange(next);
    }
  }, [
    currentSpec,
    kind,
    onParamsChange,
    params.count,
    params.duration,
    params.ratio,
    params.referenceMode,
    params.resolution,
  ]);

  const handleAddRef = (slotIndex?: number) => {
    uploadTargetIndexRef.current = slotIndex ?? null;
    fileInputRef.current?.click();
  };

  const handleRefFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;

    const targetIndex = uploadTargetIndexRef.current;
    uploadTargetIndexRef.current = null;

    const imageOnly = frameSlotMode;
    const accepted = imageOnly
      ? files.filter((file) => file.type.startsWith('image/'))
      : files;
    if (imageOnly && accepted.length < files.length) {
      message.warning('当前参考模式仅支持图片');
    }
    if (accepted.length === 0) return;

    const uploadOne = async (file: File): Promise<RefImage> => {
      const material = await uploadGenerateMaterial(file);
      return {
        id: `ref-${material.asset_id}`,
        assetId: material.asset_id,
        url: material.url,
        name: material.filename || file.name,
        mimeType: material.mime_type || file.type,
      };
    };

    setMaterialsUploading(true);
    try {
      if (isDual) {
        const slot = targetIndex === 1 ? 1 : targetIndex === 0 ? 0 : dualSlots[0] ? 1 : 0;
        const next = await uploadOne(accepted[0]);
        setUploadedAssets((prev) => {
          const slots: [RefImage | null, RefImage | null] = [prev[0] ?? null, prev[1] ?? null];
          slots[slot] = next;
          return slots;
        });
        return;
      }
      if (isFirst) {
        setUploadedAssets([await uploadOne(accepted[0])]);
        return;
      }
      const remaining = maxReferenceImages - refImages.length;
      if (remaining <= 0) {
        message.warning(`最多添加 ${maxReferenceImages} 张参考图`);
        return;
      }
      const selected = accepted.slice(0, remaining);
      if (selected.length < accepted.length) {
        message.warning(`最多添加 ${maxReferenceImages} 张参考图`);
      }
      const uploaded = await Promise.all(selected.map(uploadOne));
      setUploadedAssets((prev) => [...filledRefs(prev), ...uploaded].slice(0, maxReferenceImages));
    } catch (err) {
      const msg = err instanceof Error ? err.message : '素材上传失败';
      message.error(msg);
    } finally {
      setMaterialsUploading(false);
    }
  };

  const submit = () => {
    const text = prompt.trim();
    if (!text || materialsUploading) return;
    if (!isAuthenticated()) {
      onSubmit({
        kind,
        prompt: text,
        params,
        refImages: filledRefs(uploadedAssets),
      });
      return;
    }
    if (!paramsReady) {
      message.warning('模型参数不可用，请刷新后重试');
      return;
    }
    if (isFirst && refImages.length !== 1) {
      message.warning('请上传首帧参考图');
      return;
    }
    if (isDual && (!dualSlots[0] || !dualSlots[1])) {
      message.warning(dualSlots[0] ? '请上传尾帧参考图' : '请上传首帧参考图');
      return;
    }
    const submitRefs = isDual ? [dualSlots[0]!, dualSlots[1]!] : refImages;
    onSubmit({ kind, prompt: text, params, refImages: submitRefs });
    setPrompt('');
    promptDraftRef.current = '';
    setPromptKey((k) => k + 1);
    setUploadedAssets(isDual ? [null, null] : []);
  };

  const handlePromptChange = useCallback((payload: CanvasPromptEditorPayload) => {
    promptDraftRef.current = payload.prompt;
    setPrompt(payload.prompt);
  }, []);

  const capLabel = buildParamsCapsuleLabel({
    kind,
    ratio: params.ratio,
    resolution: params.resolution,
    count: params.count,
    duration: params.duration,
    referenceMode: params.referenceMode,
    referenceModeOptions,
    durationFallback: durationOptions[0],
  });

  return (
    <footer className="studio-create__composer-v2 studio-create__composer">
      <ComposerShell
        boxRef={composerRef}
        className="studio-create__composer-box"
        top={(
          <GenerationRefRail
            kind={kind}
            referenceMode={params.referenceMode}
            assets={uploadedAssets}
            maxOmniAssets={maxReferenceImages}
            uploading={materialsUploading}
            onAdd={handleAddRef}
            onRemove={(id) => {
              setUploadedAssets((prev) => filledRefs(prev).filter((x) => x.id !== id));
            }}
            onRemoveSlot={(index) => {
              setUploadedAssets((prev) => {
                const slots: [RefImage | null, RefImage | null] = [
                  prev[0] ?? null,
                  prev[1] ?? null,
                ];
                slots[index] = null;
                return slots;
              });
            }}
            onSwapFrames={() => {
              setUploadedAssets((prev) => [prev[1] ?? null, prev[0] ?? null]);
            }}
          />
        )}
        input={(
          <GenerationPromptEditor
            key={promptKey}
            prompt={prompt}
            placeholder={editorPlaceholderForMode(kind, params.referenceMode)}
            enableMention={!frameSlotMode}
            mentionProvider={mentionProvider}
            onChange={handlePromptChange}
            onEnterSubmit={submit}
            className="studio-composer-box__textarea"
          />
        )}
        footerLeft={(
          <>
            <Select
              className="studio-create__task-select"
              value={kind}
              options={TASK_TYPE_OPTIONS}
              onChange={(v) => {
                onKindChange(v as GenerateKind);
              }}
              size="small"
              variant="outlined"
              style={{ minWidth: 108 }}
            />
            <Select
              className="studio-create__model-select"
              value={currentModel || undefined}
              options={modelOptions}
              onChange={(v) => onParamsChange({ model: v })}
              loading={modelsLoading}
              size="small"
              variant="outlined"
              style={{ minWidth: 130 }}
            />
            <GenerationParamsCapsule
              kind={kind}
              label={capLabel}
              ratio={params.ratio}
              resolution={params.resolution}
              count={params.count}
              duration={params.duration}
              referenceMode={params.referenceMode}
              ratioOptions={ratioOptions}
              resolutionOptions={resolutionOptions}
              countOptions={countOptions}
              durationOptions={durationOptions}
              referenceModeOptions={referenceModeOptions}
              onRatioChange={(v) => onParamsChange({ ratio: v })}
              onResolutionChange={(v) => onParamsChange({ resolution: v })}
              onCountChange={(v) => onParamsChange({ count: v })}
              onDurationChange={(v) => onParamsChange({ duration: v })}
              onReferenceModeChange={(v) => onParamsChange({ referenceMode: v })}
            />
            <button
              type="button"
              className="studio-create__at-btn"
              title={frameSlotMode ? '当前参考模式请使用上方帧槽上传' : '引用参考素材'}
              disabled={frameSlotMode}
              onClick={() => {
                loadFavoriteMaterials();
              }}
            >
              @
            </button>
          </>
        )}
        footerRight={(
          <ComposerSendButton
            disabled={
              !prompt.trim()
              || materialsUploading
              || (isAuthenticated() && (modelsLoading || !paramsReady))
            }
            onSend={submit}
            title="生成 (Enter)"
          />
        )}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept={frameSlotMode ? 'image/*' : 'image/*,video/*,audio/*'}
        multiple={!frameSlotMode}
        className="studio-create__file-input"
        onChange={(e) => void handleRefFileChange(e)}
      />
    </footer>
  );
}
