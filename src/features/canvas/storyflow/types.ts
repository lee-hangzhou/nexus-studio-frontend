import type { CanvasNodeKind } from '../api/canvasTypes';

export type WorkflowNodeType = CanvasNodeKind;

export type CanvasTaskStatus =
  | ''
  | 'idle'
  | 'waiting_inputs'
  | 'ready'
  | 'running'
  | 'success'
  | 'failed'
  | 'cancelled';

export type NodeChangeInput = {
  nodeId: string;
  patch: Record<string, unknown>;
  /** 默认仅改本地图；title / output_text 等 blur 提交用 immediate */
  persist?: 'immediate';
};

export type PaneAddNodeMenuState = {
  screenX: number;
  screenY: number;
  flowX?: number;
  flowY?: number;
  anchorNodeId?: string;
  handleSide?: 'left' | 'right';
};

export type ConnectDropMenuState = {
  screenX: number;
  screenY: number;
  flowX?: number;
  flowY?: number;
  anchorNodeId: string;
  handleSide: 'left' | 'right';
};

export type SpawnTargetType = WorkflowNodeType;

export type WorkflowPromptMediaContentSegment = {
  type: 'image_url' | 'video_url' | 'audio_url';
  asset_id?: number;
  url: string;
};

export type WorkflowPromptTextRefContentSegment = {
  type: 'text_ref';
  text: string;
};

export type WorkflowPromptContentSegment =
  | { type: 'text'; text: string }
  | WorkflowPromptMediaContentSegment
  | WorkflowPromptTextRefContentSegment;

export type WorkflowPromptContent = WorkflowPromptContentSegment[];
