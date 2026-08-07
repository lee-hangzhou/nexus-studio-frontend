import { ArrowUpOutlined } from '@ant-design/icons';
import { Button, Dropdown, message } from 'antd';
import { useStore } from '@xyflow/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AssetBase } from '../../../../../domains/asset/types';
import {
  buildParamsCapsuleLabel,
  editorPlaceholderForMode,
  GenerationParamsCapsule,
  GenerationRefRail,
  isFrameSlotMode,
  normalizeRatioOptions,
  resolveMaxReferenceImages,
} from '../../../../generate/composer';
import type { GenerateRefImage } from '../../../../generate/types';
import { useCanvasActions } from '../../context/CanvasActionsContext';
import { useCanvasGenerate } from '../../../context/CanvasGenerateContext';
import { NodeFloatPromptPanel } from '../../components/NodeFloatPromptPanel';
import { CanvasAssetPickerModal } from '../../components/CanvasAssetPickerModal';
import { useCanvasGenerateModels } from '../../hooks/useCanvasGenerateModels';
import { useLibraryRefAssets } from '../../hooks/useLibraryRefAssets';
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

type LibraryRefWrite = {
  asset_id: number;
  url: string;
  name?: string;
  thumb_url?: string;
  type?: string;
};

function assetsToLibraryRefs(assets: AssetBase[]): LibraryRefWrite[] {
  return assets.map((asset) => ({
    asset_id: Number(asset.id),
    url: asset.previewUrl || '',
    thumb_url: asset.previewUrl || undefined,
    name: asset.title || asset.filename || undefined,
    type: asset.kind === 'video' ? 'video' : 'image',
  }));
}

function refsFromRail(items: (GenerateRefImage | null)[]): LibraryRefWrite[] {
  return items
    .filter((item): item is GenerateRefImage => item != null && item.assetId != null)
    .map((item) => ({
      asset_id: item.assetId!,
      url: item.url,
      name: item.name,
      type: item.mimeType.startsWith('video/') ? 'video' : 'image',
    }));
}

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

  const { libraryAssets, libraryMentionItems, selfLibraryRefs } = useLibraryRefAssets(data);
  const {
    mentionProvider,
    previewMediaRefs,
    previewTextRefs,
    connectedAssetIds,
    connectedPromptTexts,
  } = useConnectedPredecessorRefs(nodeId, visible, {
    allowedTypes: frameSlotMode ? ['image'] : ['image', 'video', 'audio'],
    maxReferenceCount: maxRefs,
    extraReferenceItems: libraryMentionItems,
  });
  const handleRemoveConnectedRef = useDisconnectConnectedRef(nodeId);
  const promptContentRef = useRef<WorkflowPromptContent>([]);
  const promptDraftRef = useRef(data.input_prompt ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const slotTargetRef = useRef<number | null>(null);
  const isGenerating = data.status === 'running' || Boolean(data.generatePending);

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

  const railAssets = useMemo((): (GenerateRefImage | null)[] => {
    if (frameSlotMode && referenceMode === 1) {
      return libraryAssets.slice(0, 1);
    }
    if (frameSlotMode && referenceMode === 2) {
      return [libraryAssets[0] ?? null, libraryAssets[1] ?? null];
    }
    return libraryAssets;
  }, [frameSlotMode, libraryAssets, referenceMode]);

  useEffect(() => {
    if (!referenceModeOptions.some((o) => o.value === referenceMode)) {
      setReferenceMode(referenceModeOptions[0]?.value ?? 3);
    }
  }, [referenceModeOptions, referenceMode]);

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

  const persistRefs = useCallback(
    (refs: LibraryRefWrite[]) => {
      onNodeChange({
        nodeId,
        patch: { library_refs: refs },
        persist: 'immediate',
      });
    },
    [nodeId, onNodeChange],
  );

  const handlePick = useCallback(
    (assets: AssetBase[]) => {
      const mapped = assetsToLibraryRefs(assets);
      if (frameSlotMode && (referenceMode === 1 || referenceMode === 2)) {
        if (referenceMode === 1) {
          persistRefs(mapped.slice(0, 1));
          return;
        }
        const slots: [GenerateRefImage | null, GenerateRefImage | null] = [
          libraryAssets[0] ?? null,
          libraryAssets[1] ?? null,
        ];
        const slot =
          slotTargetRef.current === 1
            ? 1
            : slotTargetRef.current === 0
              ? 0
              : slots[0]
                ? 1
                : 0;
        slotTargetRef.current = null;
        const picked = mapped[0];
        if (!picked) return;
        const asRail: GenerateRefImage = {
          id: `library-${picked.asset_id}`,
          assetId: picked.asset_id,
          url: picked.url,
          name: picked.name || '',
          mimeType: 'image/*',
        };
        slots[slot] = asRail;
        persistRefs(refsFromRail(slots));
        return;
      }
      const room = Math.max(maxRefs - selfLibraryRefs.length, 0);
      const existing = (data.payload.library_refs ?? []).map((ref) => ({
        asset_id: ref.asset_id,
        url: ref.url,
        name: ref.name ?? undefined,
        thumb_url: ref.thumb_url ?? undefined,
        type: ref.type ?? undefined,
      }));
      persistRefs([...existing, ...mapped.slice(0, room)]);
    },
    [
      data.payload.library_refs,
      frameSlotMode,
      libraryAssets,
      maxRefs,
      persistRefs,
      referenceMode,
      selfLibraryRefs.length,
    ],
  );

  const handlePromptChange = useCallback((payload: { prompt: string; content: WorkflowPromptContent }) => {
    promptContentRef.current = payload.content;
    promptDraftRef.current = payload.prompt;
  }, []);

  const handleSubmit = useCallback(async () => {
    if (submitting || isGenerating) return;
    if (referenceMode === 1 && selfLibraryRefs.length !== 1) {
      message.warning('请选择首帧参考图');
      return;
    }
    if (referenceMode === 2 && selfLibraryRefs.length !== 2) {
      message.warning(selfLibraryRefs.length >= 1 ? '请选择尾帧参考图' : '请选择首帧参考图');
      return;
    }
    const content = promptContentRef.current;
    const { prompt: submitPrompt, ref_asset_ids } = buildSubmitPromptAndRefs({
      content,
      storedPrompt: promptDraftRef.current,
      referenceAssets: mentionProvider.getReferenceAssets(),
      connectedPromptTexts,
      connectedAssetIds,
      manualRefs: [],
      previewMediaRefs,
      selfLibraryRefs,
    });
    const refValidation = buildSubmitRefValidationPayload({
      content,
      manualRefs: [],
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
    selfLibraryRefs,
    submitting,
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
            assets={railAssets}
            maxOmniAssets={maxRefs}
            leadingSlot={leadingSlot}
            onAdd={(slotIndex?: number) => {
              slotTargetRef.current = slotIndex ?? null;
              setPickerOpen(true);
            }}
            onRemove={(id) => {
              persistRefs(refsFromRail(libraryAssets.filter((item) => item.id !== id)));
            }}
            onRemoveSlot={(index) => {
              const slots: [GenerateRefImage | null, GenerateRefImage | null] = [
                libraryAssets[0] ?? null,
                libraryAssets[1] ?? null,
              ];
              slots[index] = null;
              persistRefs(refsFromRail(slots));
            }}
            onSwapFrames={() => {
              persistRefs(refsFromRail([libraryAssets[1] ?? null, libraryAssets[0] ?? null]));
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
      <CanvasAssetPickerModal
        open={pickerOpen}
        onCancel={() => setPickerOpen(false)}
        allowKinds={frameSlotMode ? ['image'] : ['image', 'video']}
        maxCount={frameSlotMode ? 1 : Math.max(maxRefs - selfLibraryRefs.length, 1)}
        onSelect={(assets) => {
          handlePick(assets);
          setPickerOpen(false);
        }}
      />
    </>
  );
}
