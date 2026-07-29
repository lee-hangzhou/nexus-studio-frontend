import { ArrowUpOutlined } from '@ant-design/icons';
import { Button, Dropdown, message } from 'antd';
import { useStore } from '@xyflow/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { uploadGenerateMaterial } from '../../../../../api/generate';
import type { GenerateRefImage } from '../../../../generate/types';
import {
  buildParamsCapsuleLabel,
  filledRefs,
  GenerationParamsCapsule,
  GenerationRefRail,
  normalizeRatioOptions,
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
import { IMAGE_PROMPT_PLACEHOLDER } from '../shared/canvasPromptCopy';
import { GenerationRunningLabel } from '../shared/GenerationRunningLabel';
import { resolveFloatPromptWidth } from '../shared/promptPanelWidth';
import '../shared/GenerationPromptEditor.less';
import '../shared/ImagePrompt.less';

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
  const {
    mentionProvider,
    previewMediaRefs,
    previewTextRefs,
    connectedAssetIds,
    connectedPromptTexts,
  } = useConnectedPredecessorRefs(nodeId, visible, {
    allowedTypes: ['image'],
    maxReferenceCount: maxRefs,
  });
  const handleRemoveConnectedRef = useDisconnectConnectedRef(nodeId);
  const promptContentRef = useRef<WorkflowPromptContent>([]);
  const promptDraftRef = useRef(data.input_prompt ?? '');
  const [uploadedAssets, setUploadedAssets] = useState<(GenerateRefImage | null)[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [count, setCount] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ratio = data.ratio ?? ratioOptions[0] ?? '16:9';
  const resolution = data.resolution ?? resolutionOptions[0] ?? '2k';
  const isGenerating = data.status === 'running';
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

  const handleAddRef = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleRefFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!files.length) return;
    const images = files.filter((f) => f.type.startsWith('image/'));
    if (!images.length) {
      message.warning('图片节点仅支持图片参考');
      return;
    }
    const room = maxRefs - filledRefs(uploadedAssets).length;
    try {
      const uploaded = await Promise.all(
        images.slice(0, Math.max(room, 0)).map(async (file) => {
          const asset = await uploadGenerateMaterial(file);
          return {
            id: `ref-${asset.asset_id}`,
            assetId: asset.asset_id,
            url: asset.url,
            name: asset.filename || file.name,
            mimeType: asset.mime_type || file.type,
          } satisfies GenerateRefImage;
        }),
      );
      setUploadedAssets((prev) => [...filledRefs(prev), ...uploaded].slice(0, maxRefs));
    } catch {
      message.error('参考图上传失败');
    }
  };

  const handlePromptChange = useCallback((payload: { prompt: string; content: WorkflowPromptContent }) => {
    promptContentRef.current = payload.content;
    promptDraftRef.current = payload.prompt;
  }, []);

  const handleSubmit = useCallback(async () => {
    if (submitting || isGenerating) return;
    const manualRefs = filledRefs(uploadedAssets)
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
            assets={uploadedAssets}
            maxOmniAssets={maxRefs}
            leadingSlot={leadingSlot}
            onAdd={handleAddRef}
            onRemove={(id) => {
              setUploadedAssets((prev) => filledRefs(prev).filter((x) => x.id !== id));
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
          placeholder={IMAGE_PROMPT_PLACEHOLDER}
          mentionProvider={mentionProvider}
          readOnly={isGenerating}
          onChange={handlePromptChange}
        />
      </NodeFloatPromptPanel>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => void handleRefFileChange(e)}
      />
    </>
  );
}
