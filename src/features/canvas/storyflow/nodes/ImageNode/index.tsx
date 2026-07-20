import { PictureOutlined } from '@ant-design/icons';
import type { NodeProps } from '@xyflow/react';
import { memo } from 'react';
import { CanvasNodeTaskOverlay } from '../../components/CanvasNodeTaskOverlay';
import { useWorkflowSingleNodeSelected } from '../../hooks/useWorkflowSingleNodeSelected';
import { workflowNodePropsAreEqual } from '../../utils/nodePropsEqual';
import type { CanvasFlowNode } from '../../../schema/canvasSchema';
import { NodeMediaPreview } from '../../components/NodeMediaPreview';
import { ImageNodePrompt } from './ImageNodePrompt';
import { ImageUploadEntry } from './ImageUploadEntry';
import './ImageNode.less';

/** 图片节点：预览区 + 选中时上传入口与悬浮 Prompt（对齐 storyflow ImageNodeContent） */
export const ImageNodeContent = memo(function ImageNodeContent({
  id,
  data,
  selected,
  dragging,
}: NodeProps<CanvasFlowNode>) {
  const d = data;
  const status = d.status ?? 'idle';
  const hasImage =
    status === 'success' || Boolean(d.output_asset_urls?.length) || (d.status === 'running' && d.task_id);
  const isTaskRunning = status === 'running';
  const isSoleSelection = useWorkflowSingleNodeSelected(id, !!selected);
  const showPrompt = isSoleSelection && !dragging;
  const showUploadEntry = showPrompt && !hasImage && !isTaskRunning;
  return (
    <div className="workflow-image-node">
      {showUploadEntry ? <ImageUploadEntry nodeId={id} /> : null}
      <div className={`workflow-image-node__preview${hasImage ? ' workflow-image-node__preview--filled' : ''}`}>
        <NodeMediaPreview
          kind="image"
          status={status}
          taskId={d.task_id}
          assetUrls={d.output_asset_urls}
        />
        {!hasImage ? <PictureOutlined /> : null}
        <CanvasNodeTaskOverlay status={status} runningLabel="正在生成图片…" failedTitle="生图失败" />
      </div>
      {showPrompt ? <ImageNodePrompt nodeId={id} selected={!!selected} dragging={!!dragging} /> : null}
    </div>
  );
}, workflowNodePropsAreEqual);
