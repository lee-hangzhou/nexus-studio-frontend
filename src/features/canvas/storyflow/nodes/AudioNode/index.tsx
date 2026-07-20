import { AudioOutlined } from '@ant-design/icons';
import type { NodeProps } from '@xyflow/react';
import { memo } from 'react';
import { useWorkflowSingleNodeSelected } from '../../hooks/useWorkflowSingleNodeSelected';
import type { CanvasFlowNode } from '../../../schema/canvasSchema';
import { workflowNodePropsAreEqual } from '../../utils/nodePropsEqual';
import AudioNodePrompt from './audioPrompt';
import './AudioNode.less';

export const AudioNodeContent = memo(function AudioNodeContent({
  id,
  data,
  selected,
  dragging,
}: NodeProps<CanvasFlowNode>) {
  const isSoleSelection = useWorkflowSingleNodeSelected(id, !!selected);
  const showPrompt = isSoleSelection && !dragging;

  return (
    <div className="workflow-image-node workflow-audio-node">
      <div className="workflow-audio-node__placeholder">
        <AudioOutlined className="workflow-audio-node__placeholder-icon" />
        {data.output_asset_urls?.[0] ? (
          <audio controls src={data.output_asset_urls[0]} className="workflow-audio-node__player" />
        ) : (
          <span>{data.status === 'running' ? '合成中…' : '音频节点'}</span>
        )}
      </div>
      {showPrompt ? <AudioNodePrompt id={id} /> : null}
    </div>
  );
}, workflowNodePropsAreEqual);
