import { CloseOutlined, PlusOutlined } from '@ant-design/icons';
import { message, Select } from 'antd';
import type { CSSProperties } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { listAssets } from '../../../api/assets';
import { listGenerateModels, uploadGenerateMaterial } from '../../../api/generate';
import type { GenerateModelItem } from '../../../api/generate';
import { ComposerSendButton } from '../../../shared/ui/ComposerSendButton';
import { ComposerShell } from '../../../shared/ui/ComposerShell';
import type { GenerateKind, GenerateRatio, GenerateRefImage, GenerateResolution } from '../types';
import { DEFAULT_GENERATE_MAX_REFERENCE_IMAGES } from '../constants';
import { MentionEditor, type MentionEditorHandle } from './MentionEditor';

// ── 常量 / 静态选项 ──────────────────────────────────────────────────────────

const TASK_TYPE_OPTIONS = [
  { value: 'image', label: '图片生成' },
  { value: 'video', label: '视频生成' },
];

const PREFERRED_IMAGE_RATIO: GenerateRatio = '4:3';

function pickImageRatio(options: GenerateRatio[] | undefined): GenerateRatio | undefined {
  if (!options?.length) return undefined;
  return options.includes(PREFERRED_IMAGE_RATIO) ? PREFERRED_IMAGE_RATIO : options[0];
}

function resolutionLabel(r: GenerateResolution) {
  const normalized = r.toLowerCase();
  if (normalized === '4k') return '超清 4K';
  if (normalized === '3k') return '高清 3K';
  if (normalized === '2k') return '高清 2K';
  if (normalized === '1k') return '标准 1K';
  if (normalized === '0.5k') return '轻量 0.5K';
  return r;
}

function ratioShape(value: string) {
  const [wRaw, hRaw] = value.split(':');
  const w = Number(wRaw);
  const h = Number(hRaw);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
    return { w: 1, h: 1 };
  }
  return { w, h };
}

function normalizeRatioOptions(values?: string[]) {
  if (!values?.length) return [];
  return values.map((value) => ({ value, ...ratioShape(value) }));
}

function referenceModeLabel(value?: number, options?: { value: number; label: string }[]) {
  if (value === undefined) return '';
  return options?.find((opt) => opt.value === value)?.label ?? '';
}

// ── 参数弹出面板 ─────────────────────────────────────────────────────────────

interface ParamsPanelProps {
  ratio: GenerateRatio;
  resolution: GenerateResolution;
  count: number;
  duration?: number;
  referenceMode?: number;
  kind: GenerateKind;
  ratioOptions: { value: GenerateRatio; w: number; h: number }[];
  resolutionOptions: GenerateResolution[];
  countOptions: number[];
  durationOptions: number[];
  referenceModeOptions: { value: number; label: string }[];
  onRatioChange: (v: GenerateRatio) => void;
  onResolutionChange: (v: GenerateResolution) => void;
  onCountChange: (v: number) => void;
  onDurationChange: (v: number) => void;
  onReferenceModeChange: (v: number) => void;
  onClose: () => void;
}

function ParamsPanel({
  ratio,
  resolution,
  count,
  duration,
  referenceMode,
  kind,
  ratioOptions,
  resolutionOptions,
  countOptions,
  durationOptions,
  referenceModeOptions,
  onRatioChange,
  onResolutionChange,
  onCountChange,
  onDurationChange,
  onReferenceModeChange,
}: ParamsPanelProps) {
  return (
    <>
        <div className="studio-create__params-section">
          <div className="studio-create__params-label">选择比例</div>
        <div
          className="studio-create__ratio-grid"
          style={{ gridTemplateColumns: `repeat(${Math.min(ratioOptions.length, 8)}, minmax(0, 1fr))` }}
        >
          {ratioOptions.map((opt) => {
            const scale = 20;
            const w = Math.round((opt.w / Math.max(opt.w, opt.h)) * scale);
            const h = Math.round((opt.h / Math.max(opt.w, opt.h)) * scale);
            return (
              <button
                key={opt.value}
                type="button"
                className={`studio-create__ratio-btn${ratio === opt.value ? ' studio-create__ratio-btn--active' : ''}`}
                onClick={() => onRatioChange(opt.value)}
              >
                <span
                  className="studio-create__ratio-icon"
                  style={{ width: w, height: h }}
                  aria-hidden
                />
                <span className="studio-create__ratio-label">{opt.value}</span>
              </button>
            );
          })}
        </div>
      </div>

        <div className="studio-create__params-section">
          <div className="studio-create__params-label">选择分辨率</div>
        <div
          className="studio-create__pill-row"
          style={{ gridTemplateColumns: `repeat(${Math.max(resolutionOptions.length, 1)}, minmax(0, 1fr))` }}
        >
          {resolutionOptions.map((value) => (
            <button
              key={value}
              type="button"
              className={`studio-create__option-pill${resolution === value ? ' studio-create__option-pill--active' : ''}`}
              onClick={() => onResolutionChange(value)}
            >
              {resolutionLabel(value)}
            </button>
          ))}
        </div>
      </div>

      {kind === 'image' && (
        <div className="studio-create__params-section">
          <div className="studio-create__params-label">选择图片数量</div>
          <div
            className="studio-create__pill-row"
            style={{ gridTemplateColumns: `repeat(${Math.min(countOptions.length, 8)}, minmax(0, 1fr))` }}
          >
            {countOptions.map((n) => (
              <button
                key={n}
                type="button"
                className={`studio-create__option-pill${count === n ? ' studio-create__option-pill--active' : ''}`}
                onClick={() => onCountChange(n)}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}

      {kind === 'video' && referenceModeOptions.length > 0 && (
        <div className="studio-create__params-section">
          <div className="studio-create__params-label">选择参考模式</div>
          <div
            className="studio-create__pill-row"
            style={{ gridTemplateColumns: `repeat(${Math.min(referenceModeOptions.length, 4)}, minmax(0, 1fr))` }}
          >
            {referenceModeOptions.map((mode) => (
              <button
                key={mode.value}
                type="button"
                className={`studio-create__option-pill${referenceMode === mode.value ? ' studio-create__option-pill--active' : ''}`}
                onClick={() => onReferenceModeChange(mode.value)}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {kind === 'video' && durationOptions.length > 0 && (
        <div className="studio-create__params-section">
          <div className="studio-create__params-label">选择视频时长</div>
          <div
            className="studio-create__pill-row"
            style={{ gridTemplateColumns: `repeat(${Math.min(durationOptions.length, 8)}, minmax(0, 1fr))` }}
          >
            {durationOptions.map((n) => (
              <button
                key={n}
                type="button"
                className={`studio-create__option-pill${duration === n ? ' studio-create__option-pill--active' : ''}`}
                onClick={() => onDurationChange(n)}
              >
                {n}s
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// ── 参考图缩略图 ─────────────────────────────────────────────────────────────

function RefImageThumb({ img, onRemove }: { img: RefImage; onRemove: () => void }) {
  const isImage = img.mimeType.startsWith('image/');
  return (
    <div className="studio-create__ref-thumb">
      {isImage ? (
        <img src={img.url} alt={img.name} />
      ) : (
        <div className="studio-create__ref-file" title={img.name}>
          <span className="studio-create__ref-file-mark">@</span>
          <span className="studio-create__ref-file-name">{img.name}</span>
        </div>
      )}
      <button
        type="button"
        className="studio-create__ref-thumb-del"
        aria-label="移除参考图"
        onClick={onRemove}
      >
        <CloseOutlined />
      </button>
    </div>
  );
}

// ── 主组件 ────────────────────────────────────────────────────────────────────

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
  const [refImages, setRefImages] = useState<RefImage[]>([]);
  const [showParams, setShowParams] = useState(false);
  const [paramsPopupStyle, setParamsPopupStyle] = useState<CSSProperties | null>(null);
  const [modelOptions, setModelOptions] = useState<{ value: string; label: string }[]>([]);
  const [modelSpecs, setModelSpecs] = useState<GenerateModelItem[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [materialsUploading, setMaterialsUploading] = useState(false);
  const [favoriteMaterials, setFavoriteMaterials] = useState<RefImage[]>([]);
  const composerRef = useRef<HTMLDivElement>(null);
  const paramsCapsuleRef = useRef<HTMLButtonElement>(null);
  const paramsPopupRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<MentionEditorHandle>(null);

  const currentModel = params.model || modelOptions[0]?.value || '';
  const currentModelSpec = modelSpecs.find((m) => m.model_id === currentModel);
  const paramOptions = currentModelSpec?.param_options;
  const resolutionOptions = paramOptions?.resolutions ?? [];
  const countOptions = paramOptions?.counts ?? [];
  const durationOptions = paramOptions?.durations ?? [];
  const referenceModeOptions = paramOptions?.reference_modes ?? [];
  const ratiosByResolution = paramOptions?.ratios_by_resolution ?? {};
  const ratioValues = ratiosByResolution[params.resolution] ?? paramOptions?.ratios;
  const ratioOptions = normalizeRatioOptions(ratioValues);
  const capsRefImages = paramOptions?.material_limits?.images;
  const maxReferenceImages =
    typeof capsRefImages === 'number' && capsRefImages > 0
      ? capsRefImages
      : DEFAULT_GENERATE_MAX_REFERENCE_IMAGES;
  const paramsReady = Boolean(
    currentModelSpec
    && (
      kind === 'image'
        ? resolutionOptions.length > 0 && ratioOptions.length > 0 && countOptions.length > 0
        : ratioOptions.length > 0 && durationOptions.length > 0 && referenceModeOptions.length > 0
    ),
  );
  const mentionMaterials = [...refImages, ...favoriteMaterials.filter(
    (asset) => !refImages.some((item) => item.assetId != null && item.assetId === asset.assetId),
  )];

  const loadModels = useCallback(
    async (k: GenerateKind) => {
      setModelsLoading(true);
      try {
        const res = await listGenerateModels(k);
        const items = res.items ?? [];
        const opts = items.map((m) => ({ value: m.model_id, label: m.label }));
        setModelSpecs(items);
        setModelOptions(opts);
        if (opts.length === 0) {
          message.warning('暂无可用生成模型');
          return;
        }
        if (!params.model || !opts.find((o) => o.value === params.model)) {
          const nextSpec = items[0];
          const nextOptions = nextSpec?.param_options;
          const nextRatios = nextOptions?.ratios as GenerateRatio[] | undefined;
          const nextRatio =
            k === 'image' ? pickImageRatio(nextRatios) : nextRatios?.[0];
          onParamsChange({
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
      } catch {
        message.error('模型列表加载失败');
        setModelSpecs([]);
        setModelOptions([]);
      } finally {
        setModelsLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    void loadModels(kind);
  }, [kind, loadModels]);

  useEffect(() => {
    let cancelled = false;
    void listAssets({ page: 1, page_size: 80, favorites_only: true })
      .then((res) => {
        if (cancelled) return;
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
        if (!cancelled) setFavoriteMaterials([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!draft) return;
    const refs = draft.refImages ?? [];
    setRefImages(refs);
    // 用素材列表把 prompt 里的 @素材名 还原成富 chip（缩略图 + hover 预览）
    editorRef.current?.setContent(draft.prompt, refs);
  }, [draft]);

  useEffect(() => {
    if (!currentModelSpec) return;
    const next: Partial<CreateComposerParams> = {};
    const nextResolutions = currentModelSpec.param_options?.resolutions ?? [];
    const nextCounts = currentModelSpec.param_options?.counts ?? [];
    const nextDurations = currentModelSpec.param_options?.durations ?? [];
    const nextReferenceModes = currentModelSpec.param_options?.reference_modes ?? [];
    const nextRatioValues =
      currentModelSpec.param_options?.ratios_by_resolution?.[params.resolution]
      ?? currentModelSpec.param_options?.ratios
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
  }, [currentModelSpec, kind, onParamsChange, params.count, params.duration, params.ratio, params.referenceMode, params.resolution]);

  const updateParamsPopupPosition = useCallback(() => {
    const composerEl = composerRef.current;
    const capsuleEl = paramsCapsuleRef.current;
    if (!composerEl || !capsuleEl) return;

    const composerRect = composerEl.getBoundingClientRect();
    const capsuleRect = capsuleEl.getBoundingClientRect();
    const margin = 8;
    const viewportPadding = 12;
    const width = Math.min(520, composerRect.width, window.innerWidth - viewportPadding * 2);
    const left = capsuleRect.left + capsuleRect.width / 2 - width / 2;

    setParamsPopupStyle({
      position: 'fixed',
      top: Math.max(viewportPadding, capsuleRect.top - margin),
      left: Math.max(viewportPadding, Math.min(left, window.innerWidth - width - viewportPadding)),
      width,
      transform: 'translateY(-100%)',
    });
  }, []);

  useEffect(() => {
    if (!showParams) return;

    updateParamsPopupPosition();
    window.addEventListener('resize', updateParamsPopupPosition);
    window.addEventListener('scroll', updateParamsPopupPosition, true);
    return () => {
      window.removeEventListener('resize', updateParamsPopupPosition);
      window.removeEventListener('scroll', updateParamsPopupPosition, true);
    };
  }, [showParams, updateParamsPopupPosition]);

  // 点击外部关闭参数面板
  useEffect(() => {
    if (!showParams) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        paramsPopupRef.current &&
        !paramsPopupRef.current.contains(target) &&
        paramsCapsuleRef.current &&
        !paramsCapsuleRef.current.contains(target)
      ) {
        setShowParams(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showParams]);

  const handleAddRef = () => {
    fileInputRef.current?.click();
  };

  const handleRefFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;

    const remaining = maxReferenceImages - refImages.length;
    if (remaining <= 0) {
      message.warning(`最多添加 ${maxReferenceImages} 张参考图`);
      return;
    }
    const selected = files.slice(0, remaining);
    if (selected.length < files.length) {
      message.warning(`最多添加 ${maxReferenceImages} 张参考图`);
    }

    setMaterialsUploading(true);
    try {
      const uploaded = await Promise.all(selected.map(async (file) => {
        const material = await uploadGenerateMaterial(file);
        return {
          id: `ref-${material.material_id}`,
          materialId: material.material_id,
          assetId: material.asset_id ?? undefined,
          url: material.url,
          name: material.filename || file.name,
          mimeType: material.mime_type || file.type,
        };
      }));
      setRefImages((prev) => [...prev, ...uploaded].slice(0, maxReferenceImages));
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
    if (!paramsReady) {
      message.warning('模型参数不可用，请刷新后重试');
      return;
    }
    onSubmit({ kind, prompt: text, params, refImages });
    editorRef.current?.clear();
  };

  const handleMentionMaterialSelect = useCallback((material: RefImage) => {
    setRefImages((prev) => {
      if (material.assetId != null && prev.some((item) => item.assetId === material.assetId)) return prev;
      if (material.materialId != null && prev.some((item) => item.materialId === material.materialId)) return prev;
      return [...prev, material];
    });
  }, []);

  const capLabel = kind === 'image'
    ? `${params.ratio}  ${resolutionLabel(params.resolution)}  ${params.count}张图片`
    : [
      referenceModeLabel(params.referenceMode, referenceModeOptions),
      params.ratio,
      resolutionLabel(params.resolution),
      `${params.duration ?? durationOptions[0] ?? ''}秒`,
    ].filter(Boolean).join('  ');

  return (
    <footer className="studio-create__composer-v2 studio-create__composer">
      <ComposerShell
        boxRef={composerRef}
        className="studio-create__composer-box"
        top={
          <div className="studio-create__refs">
            {refImages.map((img) => (
              <RefImageThumb
                key={img.id}
                img={img}
                onRemove={() => setRefImages((prev) => prev.filter((x) => x.id !== img.id))}
              />
            ))}
            <button
              type="button"
              className="studio-create__ref-add"
              onClick={handleAddRef}
              title="添加参考素材（可选）"
            >
              <PlusOutlined />
            </button>
            {refImages.length === 0 ? (
              <span className="studio-create__ref-hint">
                {materialsUploading ? '素材上传中...' : '参考素材（可选）'}
              </span>
            ) : null}
          </div>
        }
        input={
          <MentionEditor
            ref={editorRef}
            className="studio-composer-box__textarea"
            materials={mentionMaterials}
            placeholder="结合参考、输入文字或 @ 引用参考素材，描述你想如何调整图片。"
            onChange={setPrompt}
            onEnterSubmit={submit}
            onMaterialSelect={handleMentionMaterialSelect}
          />
        }
        footerLeft={
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
            <button
              ref={paramsCapsuleRef}
              type="button"
              className={`studio-create__params-capsule${showParams ? ' studio-create__params-capsule--active' : ''}`}
              onClick={() => {
                updateParamsPopupPosition();
                setShowParams((v) => !v);
              }}
              title="展开参数配置"
            >
              <span className="studio-create__params-ratio-ico" aria-hidden />
              {capLabel}
            </button>
            <button
              type="button"
              className="studio-create__at-btn"
              title="引用参考素材"
              onClick={() => editorRef.current?.openMention()}
            >
              @
            </button>
          </>
        }
        footerRight={
          <ComposerSendButton
            disabled={!prompt.trim() || materialsUploading || !paramsReady || modelsLoading}
            onSend={submit}
            title="生成 (Enter)"
          />
        }
      />

      {showParams && paramsPopupStyle
        ? createPortal(
            <div
              ref={paramsPopupRef}
              className="studio-create__params-popup"
              style={paramsPopupStyle}
            >
              <ParamsPanel
                ratio={params.ratio}
                resolution={params.resolution}
                count={params.count}
                duration={params.duration}
                referenceMode={params.referenceMode}
                kind={kind}
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
                onClose={() => setShowParams(false)}
              />
            </div>,
            document.body,
          )
        : null}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*,audio/*"
        multiple
        className="studio-create__file-input"
        onChange={handleRefFileChange}
      />
    </footer>
  );
}
