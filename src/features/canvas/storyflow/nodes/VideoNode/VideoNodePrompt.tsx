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
import { VIDEO_PROMPT_PLACEHOLDER } from '../shared/canvasPromptCopy';
import { GenerationRunningLabel } from '../shared/GenerationRunningLabel';
import { resolveFloatPromptWidth } from '../shared/promptPanelWidth';
import '../shared/GenerationPromptEditor.less';
import '../shared/ImagePrompt.less';
import './VideoPrompt.less';

type RefThumb = {
  id: string;
  materialId: number;
  assetId: number | null;
  url: string;
  type: 'image' | 'video' | 'audio';
};

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
    durationOptions,
    referenceModeOptions,
  } = useCanvasGenerateModels(nodeId, 'video');
  const {
    mentionProvider,
    previewMediaRefs,
    previewTextRefs,
    connectedAssetIds,
    connectedPromptTexts,
  } = useConnectedPredecessorRefs(nodeId, visible, {
    allowedTypes: ['image', 'video', 'audio'],
    maxReferenceCount: IMAGE_PROMPT_MAX_REFERENCE_IMAGES,
  });
  const handleRemoveConnectedRef = useDisconnectConnectedRef(nodeId);
  const promptContentRef = useRef<WorkflowPromptContent>([]);
  const promptDraftRef = useRef(data.input_prompt ?? '');
  const [referenceMode, setReferenceMode] = useState(3);
  const [refs, setRefs] = useState<RefThumb[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const isGenerating = data.status === 'running';

  const referenceModeLabel =
    referenceModeOptions.find((o) => o.value === referenceMode)?.label ?? referenceModeOptions[0]?.label ?? '参考模式';
  const ratio = data.ratio ?? ratioOptions[0] ?? '16:9';
  const resolution = data.resolution ?? resolutionOptions[0] ?? '2k';
  const duration = data.duration_sec ?? durationOptions[0] ?? 15;

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

  const handleAddRef = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,video/*,audio/*';
    input.multiple = true;
    input.onchange = () => {
      const files = input.files;
      if (!files?.length) return;
      void (async () => {
        for (const file of Array.from(files).slice(0, 12 - refs.length)) {
          try {
            const asset = await uploadGenerateMaterial(file);
            const type = file.type.startsWith('video')
              ? 'video'
              : file.type.startsWith('audio')
                ? 'audio'
                : 'image';
            setRefs((prev) => [
              ...prev,
              {
                id: String(asset.material_id),
                materialId: asset.material_id,
                assetId: asset.asset_id ?? null,
                url: asset.url,
                type,
              },
            ]);
          } catch {
            message.error('参考素材上传失败');
          }
        }
      })();
    };
    input.click();
  }, [refs.length]);

  const handlePromptChange = useCallback((payload: { prompt: string; content: WorkflowPromptContent }) => {
    promptContentRef.current = payload.content;
    promptDraftRef.current = payload.prompt;
  }, []);

  const handleSubmit = useCallback(async () => {
    if (submitting || isGenerating) return;
    const manualRefs = refs.map((item) => ({
      materialId: item.materialId,
      assetId: item.assetId ?? undefined,
    }));
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
    connectedPromptTexts,
    refs,
    modelReady,
    nodeId,
    onNodeGenerate,
    previewMediaRefs,
    referenceMode,
    ratio,
    resolution,
    duration,
    submitting,
  ]);

  if (!visible) return null;

  const addRefBtn = (
    <button
      type="button"
      className="node-float-prompt__icon-btn"
      aria-label="添加参考"
      disabled={refs.length >= 12}
      onClick={handleAddRef}
    >
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
      {refs.map((item) => (
        <div key={item.id} className="workflow-image-prompt-ref-rail__thumb" title={item.type}>
          {item.type === 'image' ? <img src={item.url} alt="" /> : null}
          {item.type === 'video' ? <video src={item.url} muted playsInline /> : null}
          {item.type === 'audio' ? <span>{item.type}</span> : null}
          <button
            type="button"
            className="workflow-image-prompt-ref-rail__thumb-remove"
            aria-label="移除参考"
            onClick={() => setRefs((prev) => prev.filter((x) => x.id !== item.id))}
          >
            <CloseOutlined aria-hidden />
          </button>
        </div>
      ))}
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
          items: referenceModeOptions.map((opt) => ({
            key: opt.value,
            label: opt.label,
            onClick: () => setReferenceMode(opt.value),
          })),
        })}
        trigger={['click']}
        placement="topLeft"
      >
        <Button className="workflow-image-gen-bar__model-chip" type="text">
          <span>{referenceModeLabel}</span>
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
      <span className="workflow-image-gen-bar__divider" aria-hidden />
      <Dropdown
        {...canvasDropdownProps({
          items: durationOptions.map((d) => ({
            key: d,
            label: `${d}s`,
            onClick: () => onNodeChange({ nodeId, patch: { duration_sec: d } }),
          })),
        })}
        trigger={['click']}
        placement="topLeft"
      >
        <Button className="workflow-image-gen-bar__model-chip" type="text">
          <span>{duration}s</span>
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
        placeholder={VIDEO_PROMPT_PLACEHOLDER}
        mentionProvider={mentionProvider}
        readOnly={isGenerating}
        onChange={handlePromptChange}
      />
    </NodeFloatPromptPanel>
  );
}
