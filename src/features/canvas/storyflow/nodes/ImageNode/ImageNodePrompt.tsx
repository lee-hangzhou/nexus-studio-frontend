import { ArrowUpOutlined } from '@ant-design/icons';
import { Button, Dropdown, message } from 'antd';
import { useStore } from '@xyflow/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AssetBase } from '../../../../../domains/asset/types';
import {
  buildParamsCapsuleLabel,
  GenerationParamsCapsule,
  GenerationRefRail,
  normalizeRatioOptions,
  resolveMaxReferenceImages,
} from '../../../../generate/composer';
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
import { IMAGE_PROMPT_PLACEHOLDER } from '../shared/canvasPromptCopy';
import { GenerationRunningLabel } from '../shared/GenerationRunningLabel';
import { resolveFloatPromptWidth } from '../shared/promptPanelWidth';
import '../shared/GenerationPromptEditor.less';
import '../shared/ImagePrompt.less';

function assetsToLibraryRefs(assets: AssetBase[]) {
  return assets.map((asset) => ({
    asset_id: Number(asset.id),
    url: asset.previewUrl || '',
    thumb_url: asset.previewUrl || undefined,
    name: asset.title || asset.filename || undefined,
    type: asset.kind === 'video' ? 'video' : 'image',
  }));
}

export function ImageNodePrompt({
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
  const panelWidth = resolveFloatPromptWidth(nodeWidth, 'image');

  const { modelLabel, modelMenuItems, modelReady, ratioOptions, resolutionOptions, countOptions, maxReferenceImages } =
    useCanvasGenerateModels(nodeId, 'image');
  const maxRefs = resolveMaxReferenceImages({
    kind: 'image',
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
    allowedTypes: ['image'],
    maxReferenceCount: maxRefs,
    extraReferenceItems: libraryMentionItems,
  });
  const handleRemoveConnectedRef = useDisconnectConnectedRef(nodeId);
  const promptContentRef = useRef<WorkflowPromptContent>([]);
  const promptDraftRef = useRef(data.input_prompt ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [count, setCount] = useState(1);

  const ratio = data.ratio ?? ratioOptions[0] ?? '16:9';
  const resolution = data.resolution ?? resolutionOptions[0] ?? '2k';
  const isGenerating = data.status === 'running' || Boolean(data.generatePending);
  const ratioShapes = normalizeRatioOptions(ratioOptions);
  const resolvedCount = countOptions.includes(count) ? count : (countOptions[0] ?? 1);
  const capLabel = buildParamsCapsuleLabel({
    kind: 'image',
    ratio,
    resolution,
    count: resolvedCount,
  });

  useEffect(() => {
    if (!countOptions.length) return;
    if (!countOptions.includes(count)) setCount(countOptions[0]);
  }, [countOptions, count]);

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

  const persistLibraryRefs = useCallback(
    (assets: AssetBase[]) => {
      const room = Math.max(maxRefs - selfLibraryRefs.length, 0);
      const next = [...(data.payload.library_refs ?? []), ...assetsToLibraryRefs(assets.slice(0, room))];
      onNodeChange({
        nodeId,
        patch: { library_refs: next },
        persist: 'immediate',
      });
    },
    [data.payload.library_refs, maxRefs, nodeId, onNodeChange, selfLibraryRefs.length],
  );

  const removeLibraryRef = useCallback(
    (railId: string) => {
      const next = libraryAssets
        .filter((item) => item.id !== railId)
        .map((item) => ({
          asset_id: item.assetId!,
          url: item.url,
          name: item.name,
          type: item.mimeType.startsWith('video/') ? 'video' : 'image',
        }));
      onNodeChange({
        nodeId,
        patch: { library_refs: next },
        persist: 'immediate',
      });
    },
    [libraryAssets, nodeId, onNodeChange],
  );

  const handlePromptChange = useCallback((payload: { prompt: string; content: WorkflowPromptContent }) => {
    promptContentRef.current = payload.content;
    promptDraftRef.current = payload.prompt;
  }, []);

  const handleSubmit = useCallback(async () => {
    if (submitting || isGenerating) return;
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
      message.warning('请输入描述或添加参考');
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
        ratio,
        resolution,
        count: resolvedCount,
        ref_asset_ids: ref_asset_ids.length > 0 ? ref_asset_ids : undefined,
        ...refValidation,
      });
    } finally {
      setSubmitting(false);
    }
  }, [
    connectedAssetIds,
    connectedPromptTexts,
    isGenerating,
    mentionProvider,
    modelReady,
    nodeId,
    onNodeGenerate,
    previewMediaRefs,
    ratio,
    resolution,
    resolvedCount,
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
        kind="image"
        label={capLabel}
        ratio={ratio}
        resolution={resolution}
        count={resolvedCount}
        ratioOptions={ratioShapes}
        resolutionOptions={resolutionOptions}
        countOptions={countOptions}
        durationOptions={[]}
        referenceModeOptions={[]}
        disabled={isGenerating}
        onRatioChange={(v) => onNodeChange({ nodeId, patch: { ratio: v } })}
        onResolutionChange={(v) => onNodeChange({ nodeId, patch: { resolution: v } })}
        onCountChange={setCount}
        onDurationChange={() => undefined}
        onReferenceModeChange={() => undefined}
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
            kind="image"
            assets={libraryAssets}
            maxOmniAssets={maxRefs}
            leadingSlot={leadingSlot}
            onAdd={() => setPickerOpen(true)}
            onRemove={removeLibraryRef}
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
          placeholder={IMAGE_PROMPT_PLACEHOLDER}
          mentionProvider={mentionProvider}
          readOnly={isGenerating}
          onChange={handlePromptChange}
        />
      </NodeFloatPromptPanel>
      <CanvasAssetPickerModal
        open={pickerOpen}
        onCancel={() => setPickerOpen(false)}
        allowKinds={['image']}
        maxCount={Math.max(maxRefs - selfLibraryRefs.length, 1)}
        onSelect={(assets) => {
          persistLibraryRefs(assets);
          setPickerOpen(false);
        }}
      />
    </>
  );
}
