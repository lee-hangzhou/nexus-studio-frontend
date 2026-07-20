export const WORKFLOW_EDGE_TYPE = 'workflowCanvas' as const;
export const WORKFLOW_EDGE_CLASSNAME = 'workflow-canvas-edge';
export const CONNECT_PREVIEW_NODE_ID = '__workflow_connect_preview__';
export const CONNECT_PREVIEW_EDGE_ID = '__workflow_connect_preview_edge__';
export const CONNECT_PREVIEW_NODE_TYPE = 'connectPreview' as const;

export const IMAGE_PROMPT_MAX_REFERENCE_IMAGES = 12;

export const DEFAULT_NODE_SIZE: Record<string, { width: number; height: number }> = {
  text: { width: 200, height: 200 },
  image: { width: 170, height: 170 },
  video: { width: 300, height: 170 },
  audio: { width: 300, height: 170 },
};

export const NODE_MIN_SIZE = { width: 200, height: 120 };
