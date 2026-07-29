/** Prompt 富文本段（创作页 / 画布节点共用） */
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
