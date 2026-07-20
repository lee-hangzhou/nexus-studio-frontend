import { ArrowUpOutlined } from '@ant-design/icons';
import { Button, Dropdown, message } from 'antd';
import { useStore } from '@xyflow/react';
import { useCallback, useRef, useState } from 'react';
import { CanvasPromptEditor } from '../../components/CanvasPromptEditor';
import { ConnectedRefRail } from '../../components/ConnectedRefRail';
import { useCanvasGenerate } from '../../../context/CanvasGenerateContext';
import { NodeFloatPromptPanel } from '../../components/NodeFloatPromptPanel';
import { useConnectedPredecessorRefs } from '../../hooks/useConnectedPredecessorRefs';
import { useCanvasChatModels } from '../../hooks/useCanvasChatModels';
import type { WorkflowPromptContent } from '../../types';
import { buildPlainSubmitPrompt } from '../../utils/buildPromptSubmit';
import { canvasDropdownProps } from '../../constants/canvasDropdown';
import { GenerationRunningLabel } from '../shared/GenerationRunningLabel';
import { resolveFloatPromptWidth } from '../shared/promptPanelWidth';
import type { CanvasNodeData } from '../../../schema/canvasSchema';
import '../shared/ImagePrompt.less';
import './textPrompt.less';

type TextNodePromptProps = {
  id: string;
  panelWidth?: number;
};

/** 文本节点底部 Prompt：@ 已连接节点 + 提交合并上游文本。 */
export default function TextNodePrompt({ id: nodeId, panelWidth }: TextNodePromptProps) {
  const { onNodeGenerate } = useCanvasGenerate();
  const { modelLabel, modelMenuItems, modelReady } = useCanvasChatModels(nodeId);
  const { mentionProvider, previewMediaRefs, previewTextRefs, connectedPromptTexts } =
    useConnectedPredecessorRefs(nodeId, true, {
      allowedTypes: ['image', 'video', 'audio'],
    });
  const promptContentRef = useRef<WorkflowPromptContent>([]);
  const [submitting, setSubmitting] = useState(false);
  const data = useStore(
    useCallback(
      (s) => (s.nodeLookup.get(nodeId)?.data ?? {}) as CanvasNodeData,
      [nodeId],
    ),
  );
  const nodeWidth = useStore((s) => s.nodeLookup.get(nodeId)?.width);
  const width =
    typeof panelWidth === 'number' ? panelWidth : resolveFloatPromptWidth(nodeWidth, 'text');
  const prompt = data.input_prompt ?? '';
  const promptDraftRef = useRef(prompt);
  const isRequestInFlight = submitting || data.generatePending === true;
  const submitDisabled = isRequestInFlight;

  const handlePromptChange = useCallback((payload: { prompt: string; content: WorkflowPromptContent }) => {
    promptContentRef.current = payload.content;
    promptDraftRef.current = payload.prompt;
  }, []);

  const handleSubmit = useCallback(async () => {
    if (submitting || submitDisabled) return;
    if (!modelReady) {
      message.warning('对话模型不可用，请稍后重试');
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
  }, [
    connectedPromptTexts,
    mentionProvider,
    nodeId,
    onNodeGenerate,
    submitDisabled,
    submitting,
    modelReady,
  ]);

  const bottomStartSlot = (
    <div className="workflow-image-gen-bar">
      <GenerationRunningLabel visible={isRequestInFlight} />
      <Dropdown {...canvasDropdownProps({ items: modelMenuItems })} trigger={['click']} placement="topLeft" disabled={!modelReady || isRequestInFlight}>
        <Button className="workflow-image-gen-bar__model-chip" type="text" disabled={!modelReady}>
          <span>{modelLabel}</span>
        </Button>
      </Dropdown>
    </div>
  );

  const bottomEndSlot = (
    <button
      type="button"
      className="workflow-image-gen-bar__submit-btn"
      aria-label="生成"
      aria-busy={isRequestInFlight}
      disabled={submitDisabled}
      onClick={() => void handleSubmit()}
    >
      <ArrowUpOutlined />
    </button>
  );

  const topSlot =
    previewTextRefs.length > 0 || previewMediaRefs.length > 0 ? (
      <ConnectedRefRail items={[...previewTextRefs, ...previewMediaRefs]} />
    ) : null;

  return (
    <NodeFloatPromptPanel
      visible
      width={width}
      topSlot={topSlot}
      bottomStartSlot={bottomStartSlot}
      bottomEndSlot={bottomEndSlot}
    >
      <CanvasPromptEditor
        prompt={prompt}
        placeholder="描述要生成的文本内容，输入 @ 引用已连接节点"
        mentionProvider={mentionProvider}
        readOnly={isRequestInFlight}
        onChange={handlePromptChange}
      />
    </NodeFloatPromptPanel>
  );
}
