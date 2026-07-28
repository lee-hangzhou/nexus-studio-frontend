import type { StreamFrame } from '../../../api/chat';
import type { SkillWriteOperation, TurnContentBlock, TurnMaterialBlock, TurnUserInput } from '../../skills/types';
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
  project_id: number;
  episode_id: number;
  nodes: CanvasNodeRecord[];
  edges: CanvasEdgeRecord[];
}

export type CanvasPatchOp =
  | CreateNodeOp
  | UpdateNodeOp
  | DeleteNodeOp
  | ConnectNodesOp
  | DisconnectNodesOp;

/** 前端构造的 op；update/delete/disconnect 的 expected_revision 由 useCanvasPatch 注入 */
export type CanvasPatchOpInput =
  | CreateNodeOp
  | ConnectNodesOp
  | Omit<UpdateNodeOp, 'expected_revision'>
  | Omit<DeleteNodeOp, 'expected_revision'>
  | Omit<DisconnectNodesOp, 'expected_revision'>;

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
  input?: TurnUserInput | Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export type { CanvasSessionView } from '../../../api/generated/canvas';

export interface CanvasTurnBody {
  session_id: number;
  request_id: string;
  content: TurnContentBlock[];
  materials: TurnMaterialBlock[];
  model_key?: string;
  client_turn_id?: string;
  mode?: 'auto' | 'manual';
  enable_tools?: boolean;
}

export interface CanvasAgentAssetView {
  id: number;
  project_id: number | null;
  filename: string;
  mime_type: string;
  asset_type: string;
  source_type: string;
  preview_url: string;
}

export interface CanvasResumeBody {
  session_id: number;
  request_id: string;
  tool_call_id: string;
  action: 'confirm' | 'reject';
  client_turn_id?: string;
  model_key?: string;
  operation?: SkillWriteOperation | null;
}

export type CanvasPatchEvent = Omit<CanvasPatchResponse, 'nodes' | 'edges'> & {
  nodes?: CanvasNodeRecord[];
  edges?: CanvasEdgeRecord[];
};

export type CanvasStreamFrame = StreamFrame;

export type SubmitManualRef = {
  asset_id: number;
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
  node: CanvasNodeRecord;
  error_message?: string | null;
}
