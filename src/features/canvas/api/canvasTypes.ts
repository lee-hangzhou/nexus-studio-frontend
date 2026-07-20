import type { StreamFrame } from '../../../api/chat';
import type {
  CanvasEdgeView,
  CanvasNodeKind,
  CanvasNodeStatus,
  CanvasNodeView,
  CanvasPatchRequest as GeneratedCanvasPatchRequest,
  CanvasPatchResponse,
  CreateNodeOp,
  UpdateNodeOp,
  DeleteNodeOp,
  ConnectNodesOp,
  DisconnectNodesOp,
} from '../../../api/generated/canvas';

export type { CanvasNodeKind, CanvasNodeStatus };

export type CanvasNodeRecord = CanvasNodeView & {
  title: string;
  input_prompt: string;
  output_text: string;
  status: CanvasNodeStatus;
  voice_id?: string | null;
};

export type CanvasEdgeRecord = CanvasEdgeView;

export interface CanvasSnapshot {
  revision: number;
  nodes: CanvasNodeRecord[];
  edges: CanvasEdgeRecord[];
}

export type CanvasPatchOp =
  | CreateNodeOp
  | UpdateNodeOp
  | DeleteNodeOp
  | ConnectNodesOp
  | DisconnectNodesOp;

export type CanvasPatchRequest = Omit<GeneratedCanvasPatchRequest, 'ops'> & {
  ops: CanvasPatchOp[];
};

export type CanvasPatchResult = Omit<CanvasPatchResponse, 'nodes' | 'edges'> & {
  nodes: CanvasNodeRecord[];
  edges: CanvasEdgeRecord[];
};

export interface CanvasMessageRecord {
  id: number;
  role: number;
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface CanvasTurnBody {
  content: string;
  model_key?: string;
  client_turn_id?: string;
  mode?: 'auto' | 'manual';
  enable_tools?: boolean;
}

export interface CanvasResumeBody {
  tool_call_id: string;
  action: 'confirm' | 'reject';
  client_turn_id?: string;
}

export type CanvasPatchEvent = Omit<CanvasPatchResponse, 'nodes' | 'edges'> & {
  nodes?: CanvasNodeRecord[];
  edges?: CanvasEdgeRecord[];
};

export type CanvasStreamFrame = StreamFrame;

export type SubmitManualRef = {
  asset_id?: number;
  material_id?: number;
};

export interface NodeGenerateBody {
  node_id: string;
  kind: 'text' | 'image' | 'video' | 'audio';
  prompt: string;
  model_key?: string;
  model_id?: string;
  voice_id?: string;
  ratio?: string;
  resolution?: string;
  count?: number;
  duration?: number;
  reference_mode?: number;
  ref_attachment_ids?: number[];
  ref_asset_ids?: number[];
  submit_content?: import('../storyflow/types').WorkflowPromptContent;
  manual_refs?: SubmitManualRef[];
  preview_media_asset_ids?: number[];
}

export interface CanvasNodeGenerateResponse {
  node_id: string;
  kind: 'text' | 'image' | 'video' | 'audio';
  status: CanvasNodeStatus;
  task_id?: number | null;
  revision: number;
  node: CanvasNodeRecord;
  error_message?: string | null;
}
