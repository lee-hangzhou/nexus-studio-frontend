import { PlaySquareOutlined } from '@ant-design/icons';
import type { NodeProps } from '@xyflow/react';
import { memo } from 'react';
import { CanvasNodeTaskOverlay } from '../../components/CanvasNodeTaskOverlay';
import { useWorkflowSingleNodeSelected } from '../../hooks/useWorkflowSingleNodeSelected';
import { workflowNodePropsAreEqual } from '../../utils/nodePropsEqual';
import type { CanvasFlowNode } from '../../../schema/canvasSchema';
import { NodeMediaPreview } from '../../components/NodeMediaPreview';
import { VideoNodePrompt } from './VideoNodePrompt';
import '../ImageNode/ImageNode.less';
import './VideoNode.less';

export const VideoNodeContent = memo(function VideoNodeContent({
  id,
  data,
  selected,
  dragging,
}: NodeProps<CanvasFlowNode>) {
  const d = data;
  const status = d.status ?? 'idle';
  const hasPreview =
    status === 'success' || Boolean(d.output_asset_urls?.length) || (status === 'running' && d.task_id);
  const isSoleSelection = useWorkflowSingleNodeSelected(id, !!selected);
  const showPrompt = isSoleSelection && !dragging;
  return (
    <div className="workflow-image-node workflow-video-node">
      <div className={`workflow-image-node__preview${hasPreview ? ' workflow-image-node__preview--filled' : ''}`}>
        <NodeMediaPreview
          kind="video"
          status={status}
          taskId={d.task_id}
          assetUrls={d.output_asset_urls}
          assetIds={d.output_asset_ids}
        />
        {!hasPreview ? <PlaySquareOutlined /> : null}
        <CanvasNodeTaskOverlay status={status} runningLabel="正在生成视频…" failedTitle="生视频失败" />
      </div>
      {showPrompt ? <VideoNodePrompt nodeId={id} selected={!!selected} dragging={!!dragging} /> : null}
    </div>
  );
}, workflowNodePropsAreEqual);
