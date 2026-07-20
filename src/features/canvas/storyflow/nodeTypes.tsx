import {
  AudioOutlined,
  FileTextOutlined,
  PictureOutlined,
  PlaySquareOutlined,
} from '@ant-design/icons';
import { createWorkflowNode } from './components/CanvasNodeShell';
import { AudioNodeContent } from './nodes/AudioNode';
import { ImageNodeContent } from './nodes/ImageNode';
import { TextNodeContent } from './nodes/TextNode';
import { ConnectPreviewNode } from './nodes/ConnectPreviewNode';
import { VideoNodeContent } from './nodes/VideoNode';
import { CONNECT_PREVIEW_NODE_TYPE } from './constants';
import type { WorkflowNodeType } from './types';

export interface NodeShellConfig {
  icon: React.ReactNode;
  variant?: 'default' | 'light';
  resizable?: boolean;
  allowBodyOverflow?: boolean;
}

export const NODE_SHELL_CONFIG: Record<WorkflowNodeType, NodeShellConfig> = {
  text: { icon: <FileTextOutlined />, resizable: true, allowBodyOverflow: true },
  image: { icon: <PictureOutlined />, allowBodyOverflow: true },
  video: { icon: <PlaySquareOutlined />, allowBodyOverflow: true },
  audio: { icon: <AudioOutlined />, allowBodyOverflow: true },
};

export const workflowNodeTypes = {
  text: createWorkflowNode(TextNodeContent, NODE_SHELL_CONFIG.text),
  image: createWorkflowNode(ImageNodeContent, NODE_SHELL_CONFIG.image),
  video: createWorkflowNode(VideoNodeContent, NODE_SHELL_CONFIG.video),
  audio: createWorkflowNode(AudioNodeContent, NODE_SHELL_CONFIG.audio),
  [CONNECT_PREVIEW_NODE_TYPE]: ConnectPreviewNode,
};
