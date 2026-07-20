import { ArrowUpOutlined } from '@ant-design/icons';
import { Button, Dropdown, message } from 'antd';
import { useStore } from '@xyflow/react';
import { useCallback, useRef, useState } from 'react';
import { CanvasPromptEditor } from '../../components/CanvasPromptEditor';
import { useCanvasGenerate } from '../../../context/CanvasGenerateContext';
import { NodeFloatPromptPanel } from '../../components/NodeFloatPromptPanel';
import { useConnectedPredecessorRefs } from '../../hooks/useConnectedPredecessorRefs';
import { useCanvasTTSModels } from '../../hooks/useCanvasTTSModels';
import type { WorkflowPromptContent } from '../../types';
import { buildPlainSubmitPrompt } from '../../utils/buildPromptSubmit';
import { canvasDropdownProps } from '../../constants/canvasDropdown';
import { GenerationRunningLabel } from '../shared/GenerationRunningLabel';
import { resolveFloatPromptWidth } from '../shared/promptPanelWidth';
import type { CanvasNodeData } from '../../../schema/canvasSchema';
import '../shared/GenerationPromptEditor.less';
import '../shared/ImagePrompt.less';
import './AudioPrompt.less';

type AudioPromptProps = {
  id: string;
};

/** 音频节点：TTS + @ 已连接文本节点引用。 */
export default function AudioNodePrompt({ id: nodeId }: AudioPromptProps) {
  const { onNodeGenerate } = useCanvasGenerate();
  const {
    modelLabel,
    modelMenuItems,
    voiceLabel,
    voiceMenuItems,
    modelReady,
  } = useCanvasTTSModels(nodeId);
  const { mentionProvider, connectedPromptTexts } = useConnectedPredecessorRefs(nodeId, true);
  const promptContentRef = useRef<WorkflowPromptContent>([]);
  const [submitting, setSubmitting] = useState(false);
  const data = useStore(
    useCallback(
      (s) => (s.nodeLookup.get(nodeId)?.data ?? {}) as CanvasNodeData,
      [nodeId],
    ),
  );
  const nodeWidth = useStore((s) => s.nodeLookup.get(nodeId)?.width);
  const width = resolveFloatPromptWidth(nodeWidth, 'audio');
  const prompt = data.input_prompt ?? '';
  const promptDraftRef = useRef(prompt);
  const isGenerating = data.status === 'running';
  const submitDisabled = isGenerating;

  const handlePromptChange = useCallback((payload: { prompt: string; content: WorkflowPromptContent }) => {
    promptContentRef.current = payload.content;
    promptDraftRef.current = payload.prompt;
  }, []);

  const handleSubmit = useCallback(async () => {
    if (submitting || submitDisabled) return;
    if (!modelReady) {
      message.warning('TTS 模型或音色不可用，请稍后重试');
      return;
    }
    setSubmitting(true);
    try {
      const submitPrompt = buildPlainSubmitPrompt({
        content: promptContentRef.current,
        storedPrompt: promptDraftRef.current,
        referenceAssets: mentionProvider.getReferenceAssets(),
        connectedPromptTexts,
      });
      await onNodeGenerate(nodeId, {
        prompt: submitPrompt,
        input_prompt: promptDraftRef.current,
      });
    } finally {
      setSubmitting(false);
    }
  }, [connectedPromptTexts, mentionProvider, nodeId, onNodeGenerate, submitDisabled, submitting, modelReady]);

  const bottomStartSlot = (
    <div className="workflow-image-gen-bar">
      <GenerationRunningLabel visible={isGenerating} />
      <Dropdown {...canvasDropdownProps({ items: modelMenuItems })} trigger={['click']} placement="topLeft" disabled={!modelReady || isGenerating}>
        <Button className="workflow-image-gen-bar__model-chip" type="text">
          <span>{modelLabel}</span>
        </Button>
      </Dropdown>
      <Dropdown {...canvasDropdownProps({ items: voiceMenuItems })} trigger={['click']} placement="topLeft" disabled={!modelReady || isGenerating}>
        <Button className="workflow-audio-prompt__voice-chip" type="text">
          <span>{voiceLabel}</span>
        </Button>
      </Dropdown>
    </div>
  );

  const bottomEndSlot = (
    <button
      type="button"
      className={`workflow-image-gen-bar__submit-btn${submitting ? ' workflow-image-gen-bar__submit-btn--busy' : ''}`}
      aria-label="生成"
      aria-busy={submitting}
      disabled={submitDisabled}
      onClick={() => void handleSubmit()}
    >
      <ArrowUpOutlined />
    </button>
  );

  return (
    <NodeFloatPromptPanel visible width={width} bottomStartSlot={bottomStartSlot} bottomEndSlot={bottomEndSlot}>
      <CanvasPromptEditor
        prompt={prompt}
        placeholder="输入要合成的语音文案，输入 @ 引用已连接节点"
        mentionProvider={mentionProvider}
        readOnly={isGenerating}
        onChange={handlePromptChange}
      />
    </NodeFloatPromptPanel>
  );
}
