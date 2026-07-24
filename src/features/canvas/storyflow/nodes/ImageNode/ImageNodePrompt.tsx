import { ArrowUpOutlined, CloseOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Dropdown, message } from 'antd';
import { useStore } from '@xyflow/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { uploadGenerateMaterial } from '../../../../../api/generate';
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

  const { modelLabel, modelMenuItems, modelReady, ratioOptions, resolutionOptions, maxReferenceImages } =
    useCanvasGenerateModels(nodeId, 'image');
  const {
    mentionProvider,
    previewMediaRefs,
    previewTextRefs,
    connectedAssetIds,
    connectedPromptTexts,
  } = useConnectedPredecessorRefs(nodeId, visible, {
    allowedTypes: ['image'],
    maxReferenceCount: maxReferenceImages ?? IMAGE_PROMPT_MAX_REFERENCE_IMAGES,
  });
  const handleRemoveConnectedRef = useDisconnectConnectedRef(nodeId);
  const promptContentRef = useRef<WorkflowPromptContent>([]);
  const promptDraftRef = useRef(data.input_prompt ?? '');
  const [refUrl, setRefUrl] = useState<string | null>(null);
  const [refMaterialId, setRefMaterialId] = useState<number | null>(null);
  const [refAssetId, setRefAssetId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const ratio = data.ratio ?? ratioOptions[0] ?? '16:9';
  const resolution = data.resolution ?? resolutionOptions[0] ?? '2k';
  const isGenerating = data.status === 'running';

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
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      void uploadGenerateMaterial(file)
        .then((asset) => {
          setRefUrl(asset.url);
          setRefMaterialId(asset.material_id);
          setRefAssetId(asset.asset_id ?? null);
        })
        .catch(() => message.error('参考图上传失败'));
    };
    input.click();
  }, []);

  const handlePromptChange = useCallback((payload: { prompt: string; content: WorkflowPromptContent }) => {
    promptContentRef.current = payload.content;
    promptDraftRef.current = payload.prompt;
  }, []);

  const handleSubmit = useCallback(async () => {
    if (submitting || isGenerating) return;
    const manualRefs =
      refMaterialId != null || refAssetId != null
        ? [{ materialId: refMaterialId ?? undefined, assetId: refAssetId ?? undefined }]
        : [];
    const content = promptContentRef.current;
    const { prompt: submitPrompt, ref_asset_ids, ref_attachment_ids } = buildSubmitPromptAndRefs({
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
    if (!submitPrompt.trim() && ref_asset_ids.length === 0 && ref_attachment_ids.length === 0) {
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
        ref_attachment_ids: ref_attachment_ids.length > 0 ? ref_attachment_ids : undefined,
        ref_asset_ids: ref_asset_ids.length > 0 ? ref_asset_ids : undefined,
        ...refValidation,
      });
    } finally {
      setSubmitting(false);
    }
  }, [
    connectedAssetIds,
    data.input_prompt,
    isGenerating,
    mentionProvider,
    modelReady,
    nodeId,
    onNodeGenerate,
    connectedPromptTexts,
    previewMediaRefs,
    ratio,
    resolution,
    refAssetId,
    refMaterialId,
    submitting,
  ]);

  if (!visible) return null;

  const addRefBtn = (
    <button type="button" className="node-float-prompt__icon-btn" aria-label="添加参考" onClick={handleAddRef}>
      <PlusOutlined />
    </button>
  );

  const topSlot = (
    <div className="workflow-image-prompt-ref-rail">
      {addRefBtn}
      <ConnectedRefRail
        items={[...previewTextRefs, ...previewMediaRefs]}
        onRemove={handleRemoveConnectedRef}
      />
      {refUrl ? (
        <div className="workflow-image-prompt-ref-rail__thumb">
          <img src={refUrl} alt="" />
          <button
            type="button"
            className="workflow-image-prompt-ref-rail__thumb-remove"
            aria-label="移除参考图"
            onClick={() => {
              setRefUrl(null);
              setRefMaterialId(null);
              setRefAssetId(null);
            }}
          >
            <CloseOutlined aria-hidden />
          </button>
        </div>
      ) : null}
    </div>
  );

  const bottomStartSlot = (
    <div className="workflow-image-gen-bar">
      <GenerationRunningLabel visible={isGenerating} />
      <Dropdown {...canvasDropdownProps({ items: modelMenuItems })} trigger={['click']} placement="topLeft" disabled={!modelReady || isGenerating}>
        <Button className="workflow-image-gen-bar__model-chip" type="text" disabled={!modelReady}>
          <span>{modelLabel}</span>
        </Button>
      </Dropdown>
      <span className="workflow-image-gen-bar__divider" aria-hidden />
      <Dropdown
        {...canvasDropdownProps({
          items: ratioOptions.map((r) => ({
            key: r,
            label: r,
            onClick: () => onNodeChange({ nodeId, patch: { ratio: r } }),
          })),
        })}
        trigger={['click']}
        placement="topLeft"
      >
        <Button className="workflow-image-gen-bar__model-chip" type="text">
          <span>{ratio}</span>
        </Button>
      </Dropdown>
      <span className="workflow-image-gen-bar__divider" aria-hidden />
      <Dropdown
        {...canvasDropdownProps({
          items: resolutionOptions.map((r) => ({
            key: r,
            label: r.toUpperCase(),
            onClick: () => onNodeChange({ nodeId, patch: { resolution: r } }),
          })),
        })}
        trigger={['click']}
        placement="topLeft"
      >
        <Button className="workflow-image-gen-bar__model-chip" type="text">
          <span>{resolution.toUpperCase()}</span>
        </Button>
      </Dropdown>
    </div>
  );

  return (
    <NodeFloatPromptPanel
      visible
      width={panelWidth}
      topSlot={topSlot}
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
  );
}
