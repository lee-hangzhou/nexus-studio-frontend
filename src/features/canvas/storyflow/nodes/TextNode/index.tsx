import type { NodeProps } from '@xyflow/react';
import { memo, useCallback } from 'react';
import { CanvasNodeTaskOverlay } from '../../components/CanvasNodeTaskOverlay';
import { WorkflowTextBody } from '../../components/WorkflowTextBody';
import { useCanvasActions } from '../../context/CanvasActionsContext';
import { useWorkflowSingleNodeSelected } from '../../hooks/useWorkflowSingleNodeSelected';
import type { CanvasFlowNode } from '../../../schema/canvasSchema';
import { workflowNodePropsAreEqual } from '../../utils/nodePropsEqual';
import TextNodePrompt from './textPrompt';
import './TextNode.less';

export const TextNodeContent = memo(function TextNodeContent({
  id,
  data,
  selected,
  dragging,
}: NodeProps<CanvasFlowNode>) {
  const { onNodeChange } = useCanvasActions();
  const isSoleSelection = useWorkflowSingleNodeSelected(id, !!selected);
  const showPrompt = isSoleSelection && !dragging;
  const bodyText = data.output_text;
  const status = data.status ?? 'idle';
  const isRequestInFlight = data.generatePending === true;

  const handleChange = useCallback(
    (value: string) => {
      onNodeChange({ nodeId: id, patch: { output_text: value }, persist: 'immediate' });
    },
    [id, onNodeChange],
  );

  return (
    <div className={`workflow-text-node${isRequestInFlight ? ' workflow-text-node--generating' : ''}`}>
      <div className="workflow-text-node__content">
        <WorkflowTextBody
          value={bodyText}
          selected={!!selected}
          placeholder="双击开始编辑"
          readOnly={isRequestInFlight}
          onChange={handleChange}
        />
        {isRequestInFlight ? (
          <CanvasNodeTaskOverlay status="running" runningLabel="正在生成文本…" />
        ) : status === 'failed' ? (
          <CanvasNodeTaskOverlay
            status="failed"
            errorMessage={data.error_message ?? ''}
            failedTitle="生成失败"
          />
        ) : null}
      </div>
      {showPrompt ? <TextNodePrompt id={id} /> : null}
    </div>
  );
}, workflowNodePropsAreEqual);
