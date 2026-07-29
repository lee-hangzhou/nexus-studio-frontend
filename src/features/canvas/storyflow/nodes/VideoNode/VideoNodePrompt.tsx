import { ArrowUpOutlined } from '@ant-design/icons';
import { Button, Dropdown, message } from 'antd';
import { useStore } from '@xyflow/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { uploadGenerateMaterial } from '../../../../../api/generate';
import type { GenerateRefImage } from '../../../../generate/types';
import {
  buildParamsCapsuleLabel,
  editorPlaceholderForMode,
  filledRefs,
  GenerationParamsCapsule,
  GenerationRefRail,
  isFrameSlotMode,
  normalizeRatioOptions,
  normalizeUploadedAssetsForMode,
  resolveMaxReferenceImages,
} from '../../../../generate/composer';
import { useCanvasActions } from '../../context/CanvasActionsContext';
import { useCanvasGenerate } from '../../../context/CanvasGenerateContext';
import { NodeFloatPromptPanel } from '../../components/NodeFloatPromptPanel';
import { useCanvasGenerateModels } from '../../hooks/useCanvasGenerateModels';
import { useWorkflowSingleNodeSelected } from '../../hooks/useWorkflowSingleNodeSelected';
import type { CanvasNodeData } from '../../../schema/canvasSchema';
import { CanvasPromptEditor } from '../../components/CanvasPromptEditor';
import { ConnectedRefRail } from '../../components/ConnectedRefRail';
import type { WorkflowPromptContent } from '../../types';
import { useConnectedPredecessorRefs } from '../../hooks/useConnectedPredecessorRefs';
import { useDisconnectConnectedRef } from '../../hooks/useDisconnectConnectedRef';
import { IMAGE_PROMPT_MAX_REFERENCE_IMAGES } from '../../constants';
import { canvasDropdownProps } from '../../constants/canvasDropdown';
import {
  buildSubmitPromptAndRefs,
  buildSubmitRefValidationPayload,
} from '../../utils/buildPromptSubmit';
import { GenerationRunningLabel } from '../shared/GenerationRunningLabel';
import { resolveFloatPromptWidth } from '../shared/promptPanelWidth';
import '../shared/GenerationPromptEditor.less';
import '../shared/ImagePrompt.less';
import './VideoPrompt.less';

export function VideoNodePrompt({
  nodeId,
  selected,
  dragging,
}: {
  nodeId: string;
  selected: boolean;
  dragging: boolean;
}) {
  const { onNodeChange } = useCanvasActions();
  const { onNodeGenerate } = useCanvasGenerate();
  const isSole = useWorkflowSingleNodeSelected(nodeId, selected);
  const visible = isSole && !dragging;
  const data = useStore(
    useCallback((s) => (s.nodeLookup.get(nodeId)?.data ?? {}) as CanvasNodeData, [nodeId]),
  );
  const nodeWidth = useStore((s) => s.nodeLookup.get(nodeId)?.width);
  const panelWidth = resolveFloatPromptWidth(nodeWidth, 'video');

  const {
    modelLabel,
    modelMenuItems,
    modelReady,
    ratioOptions,
    resolutionOptions,
    countOptions,
    durationOptions,
    referenceModeOptions,
    maxReferenceImages,
  } = useCanvasGenerateModels(nodeId, 'video');

  const [referenceMode, setReferenceMode] = useState(3);
  const frameSlotMode = isFrameSlotMode('video', referenceMode);
  const maxRefs = resolveMaxReferenceImages({
    kind: 'video',
    referenceMode,
    materialLimit: maxReferenceImages ?? IMAGE_PROMPT_MAX_REFERENCE_IMAGES,
  });

  const {
    mentionProvider,
    previewMediaRefs,
    previewTextRefs,
    connectedAssetIds,
    connectedPromptTexts,
  } = useConnectedPredecessorRefs(nodeId, visible, {
    allowedTypes: frameSlotMode ? ['image'] : ['image', 'video', 'audio'],
    maxReferenceCount: maxRefs,
  });
  const handleRemoveConnectedRef = useDisconnectConnectedRef(nodeId);
  const promptContentRef = useRef<WorkflowPromptContent>([]);
  const promptDraftRef = useRef(data.input_prompt ?? '');
  const [uploadedAssets, setUploadedAssets] = useState<(GenerateRefImage | null)[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetIndexRef = useRef<number | null>(null);
  const isGenerating = data.status === 'running';

  const ratio = data.ratio ?? ratioOptions[0] ?? '16:9';
  const resolution = data.resolution ?? resolutionOptions[0] ?? '2k';
  const duration = data.duration_sec ?? durationOptions[0] ?? 15;
  const ratioShapes = normalizeRatioOptions(ratioOptions);
  const capLabel = buildParamsCapsuleLabel({
    kind: 'video',
    ratio,
    resolution,
    count: 1,
    duration,
    referenceMode,
    referenceModeOptions,
    durationFallback: durationOptions[0],
  });

  useEffect(() => {
    if (!referenceModeOptions.some((o) => o.value === referenceMode)) {
      setReferenceMode(referenceModeOptions[0]?.value ?? 3);
    }
  }, [referenceModeOptions, referenceMode]);

  useEffect(() => {
    setUploadedAssets((prev) => normalizeUploadedAssetsForMode('video', referenceMode, prev));
  }, [referenceMode]);

  useEffect(() => {
    if (!ratioOptions.length) return;
    const current = data.ratio;
    if (!current || !ratioOptions.includes(current)) {
      onNodeChange({ nodeId, patch: { ratio: ratioOptions[0] } });
    }
  }, [ratioOptions, data.ratio, nodeId, onNodeChange]);

  useEffect(() => {
    if (!resolutionOptions.length) return;
    const current = data.resolution;
    if (!current || !resolutionOptions.includes(current)) {
      onNodeChange({ nodeId, patch: { resolution: resolutionOptions[0] } });
    }
  }, [resolutionOptions, data.resolution, nodeId, onNodeChange]);

  useEffect(() => {
    if (!durationOptions.length) return;
    const current = data.duration_sec;
    if (current == null || !durationOptions.includes(current)) {
      onNodeChange({ nodeId, patch: { duration_sec: durationOptions[0] } });
    }
  }, [durationOptions, data.duration_sec, nodeId, onNodeChange]);

  const handleAddRef = useCallback((slotIndex?: number) => {
    uploadTargetIndexRef.current = slotIndex ?? null;
    fileInputRef.current?.click();
  }, []);

  const handleRefFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!files.length) return;
    const targetIndex = uploadTargetIndexRef.current;
    uploadTargetIndexRef.current = null;
    const imageOnly = frameSlotMode;
    const accepted = imageOnly ? files.filter((f) => f.type.startsWith('image/')) : files;
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

    try {
      if (frameSlotMode && (referenceMode === 1 || referenceMode === 2)) {
        if (referenceMode === 1) {
          setUploadedAssets([await uploadOne(accepted[0])]);
          return;
        }
        const slotsNow = [uploadedAssets[0] ?? null, uploadedAssets[1] ?? null] as const;
        const slot = targetIndex === 1 ? 1 : targetIndex === 0 ? 0 : slotsNow[0] ? 1 : 0;
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
    }
  };

  const handlePromptChange = useCallback((payload: { prompt: string; content: WorkflowPromptContent }) => {
    promptContentRef.current = payload.content;
    promptDraftRef.current = payload.prompt;
  }, []);

  const handleSubmit = useCallback(async () => {
    if (submitting || isGenerating) return;
    const refs = filledRefs(uploadedAssets);
    if (referenceMode === 1 && refs.length !== 1) {
      message.warning('请上传首帧参考图');
      return;
    }
    if (referenceMode === 2 && (refs.length !== 2 || !uploadedAssets[0] || !uploadedAssets[1])) {
      message.warning(uploadedAssets[0] ? '请上传尾帧参考图' : '请上传首帧参考图');
      return;
    }
    const ordered =
      referenceMode === 2 && uploadedAssets[0] && uploadedAssets[1]
        ? [uploadedAssets[0], uploadedAssets[1]]
        : refs;
    const manualRefs = ordered
      .filter((item) => item.assetId != null)
      .map((item) => ({ assetId: item.assetId! }));
    const content = promptContentRef.current;
    const { prompt: submitPrompt, ref_asset_ids } = buildSubmitPromptAndRefs({
      content,
      storedPrompt: promptDraftRef.current,
      referenceAssets: mentionProvider.getReferenceAssets(),
      connectedPromptTexts,
      connectedAssetIds,
      manualRefs,
      previewMediaRefs,
    });
    const refValidation = buildSubmitRefValidationPayload({
      content,
      manualRefs,
      previewMediaRefs,
    });
    if (!submitPrompt.trim() && ref_asset_ids.length === 0) {
      message.warning('请输入描述或添加参考素材');
      return;
    }
    if (!modelReady) {
      message.warning('生成模型不可用，请稍后重试');
      return;
    }
    setSubmitting(true);
    try {
      await onNodeGenerate(nodeId, {
        prompt: submitPrompt,
        input_prompt: promptDraftRef.current,
        reference_mode: referenceMode,
        ratio,
        resolution,
        duration,
        ref_asset_ids: ref_asset_ids.length > 0 ? ref_asset_ids : undefined,
        ...refValidation,
      });
    } finally {
      setSubmitting(false);
    }
  }, [
    connectedAssetIds,
    connectedPromptTexts,
    duration,
    isGenerating,
    mentionProvider,
    modelReady,
    nodeId,
    onNodeGenerate,
    previewMediaRefs,
    ratio,
    referenceMode,
    resolution,
    submitting,
    uploadedAssets,
  ]);

  const leadingSlot = useMemo(
    () => (
      <ConnectedRefRail
        items={[...previewTextRefs, ...previewMediaRefs]}
        onRemove={handleRemoveConnectedRef}
      />
    ),
    [handleRemoveConnectedRef, previewMediaRefs, previewTextRefs],
  );

  if (!visible) return null;

  const bottomStartSlot = (
    <div className="workflow-image-gen-bar">
      <GenerationRunningLabel visible={isGenerating} />
      <Dropdown {...canvasDropdownProps({ items: modelMenuItems })} trigger={['click']} placement="topLeft" disabled={!modelReady || isGenerating}>
        <Button className="workflow-image-gen-bar__model-chip" type="text" disabled={!modelReady}>
          <span>{modelLabel}</span>
        </Button>
      </Dropdown>
      <span className="workflow-image-gen-bar__divider" aria-hidden />
      <GenerationParamsCapsule
        kind="video"
        label={capLabel}
        ratio={ratio}
        resolution={resolution}
        count={1}
        duration={duration}
        referenceMode={referenceMode}
        ratioOptions={ratioShapes}
        resolutionOptions={resolutionOptions}
        countOptions={countOptions}
        durationOptions={durationOptions}
        referenceModeOptions={referenceModeOptions}
        disabled={isGenerating}
        onRatioChange={(v) => onNodeChange({ nodeId, patch: { ratio: v } })}
        onResolutionChange={(v) => onNodeChange({ nodeId, patch: { resolution: v } })}
        onCountChange={() => undefined}
        onDurationChange={(v) => onNodeChange({ nodeId, patch: { duration_sec: v } })}
        onReferenceModeChange={setReferenceMode}
      />
    </div>
  );

  return (
    <>
      <NodeFloatPromptPanel
        visible
        width={panelWidth}
        topSlot={(
          <GenerationRefRail
            kind="video"
            referenceMode={referenceMode}
            assets={uploadedAssets}
            maxOmniAssets={maxRefs}
            leadingSlot={leadingSlot}
            onAdd={handleAddRef}
            onRemove={(id) => {
              setUploadedAssets((prev) => filledRefs(prev).filter((x) => x.id !== id));
            }}
            onRemoveSlot={(index) => {
              setUploadedAssets((prev) => {
                const slots: [GenerateRefImage | null, GenerateRefImage | null] = [
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
        bottomStartSlot={bottomStartSlot}
        bottomEndSlot={
          <button
            type="button"
            className={`workflow-image-gen-bar__submit-btn${submitting ? ' workflow-image-gen-bar__submit-btn--busy' : ''}`}
            aria-label="生成"
            aria-busy={submitting}
            disabled={isGenerating}
            onClick={() => void handleSubmit()}
          >
            <ArrowUpOutlined />
          </button>
        }
      >
        <CanvasPromptEditor
          prompt={data.input_prompt ?? ''}
          placeholder={editorPlaceholderForMode('video', referenceMode)}
          enableMention={!frameSlotMode}
          mentionProvider={mentionProvider}
          readOnly={isGenerating}
          onChange={handlePromptChange}
        />
      </NodeFloatPromptPanel>
      <input
        ref={fileInputRef}
        type="file"
        accept={frameSlotMode ? 'image/*' : 'image/*,video/*,audio/*'}
        multiple={!frameSlotMode}
        hidden
        onChange={(e) => void handleRefFileChange(e)}
      />
    </>
  );
}
