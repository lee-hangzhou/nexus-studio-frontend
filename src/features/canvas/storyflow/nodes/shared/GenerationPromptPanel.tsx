import { ArrowUpOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import { useNodesData, useStore } from '@xyflow/react';
import { useCallback, useEffect, useState } from 'react';
import { useCanvasActions } from '../../context/CanvasActionsContext';
import { NodeFloatPromptPanel } from '../../components/NodeFloatPromptPanel';
import { DEFAULT_NODE_SIZE } from '../../constants';
import { useWorkflowSingleNodeSelected } from '../../hooks/useWorkflowSingleNodeSelected';
import type { CanvasNodeData } from '../../../schema/canvasSchema';

export function GenerationPromptPanel({
  nodeId,
  kind,
  onGenerate,
  selected,
  dragging,
}: {
  nodeId: string;
  kind: 'image' | 'video';
  onGenerate: (nodeId: string) => Promise<void>;
  selected: boolean;
  dragging: boolean;
}) {
  const nodeRow = useNodesData(nodeId);
  const { onNodeChange } = useCanvasActions();
  const isSole = useWorkflowSingleNodeSelected(nodeId, selected);
  const visible = isSole && !dragging;
  const data = (nodeRow?.data ?? {}) as CanvasNodeData;
  const [submitting, setSubmitting] = useState(false);
  const [draftPrompt, setDraftPrompt] = useState(data.input_prompt ?? '');

  useEffect(() => {
    setDraftPrompt(data.input_prompt ?? '');
  }, [nodeId, data.input_prompt]);
  const defaultSize = DEFAULT_NODE_SIZE[kind];
  const nodeWidth = useStore((s) => s.nodeLookup.get(nodeId)?.width);
  const panelWidth =
    typeof nodeWidth === 'number' && nodeWidth > 0 ? nodeWidth : defaultSize.width;

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    try {
      await onGenerate(nodeId);
    } finally {
      setSubmitting(false);
    }
  }, [nodeId, onGenerate]);

  if (!visible) return null;

  const bottomStartSlot = (
    <div className="workflow-image-gen-bar">
      <Button className="workflow-image-gen-bar__model-chip" type="text">
        <input
          className="workflow-image-gen-bar__inline-field"
          aria-label="模型"
          value={data.model_id ?? ''}
          placeholder="模型"
          onChange={(e) => onNodeChange({ nodeId, patch: { model_id: e.target.value } })}
        />
      </Button>
      <span className="workflow-image-gen-bar__divider" aria-hidden />
      <Button className="workflow-image-gen-bar__model-chip" type="text">
        <input
          className="workflow-image-gen-bar__inline-field workflow-image-gen-bar__inline-field--short"
          aria-label="比例"
          value={data.ratio ?? ''}
          placeholder="比例"
          onChange={(e) => onNodeChange({ nodeId, patch: { ratio: e.target.value } })}
        />
      </Button>
    </div>
  );

  const bottomEndSlot = (
    <button
      type="button"
      className="workflow-image-gen-bar__submit-btn"
      aria-label="生成"
      disabled={submitting}
      onClick={() => void handleSubmit()}
    >
      <ArrowUpOutlined />
    </button>
  );

  return (
    <NodeFloatPromptPanel
      visible
      width={panelWidth}
      bottomStartSlot={bottomStartSlot}
      bottomEndSlot={bottomEndSlot}
    >
      <textarea
        className="canvas-prompt-editor composer-input-area nodrag nowheel"
        value={draftPrompt}
        placeholder={kind === 'image' ? '描述任何你想要生成的内容' : '描述任何你想要生成的视频'}
        rows={3}
        onChange={(e) => setDraftPrompt(e.target.value)}
      />
    </NodeFloatPromptPanel>
  );
}
