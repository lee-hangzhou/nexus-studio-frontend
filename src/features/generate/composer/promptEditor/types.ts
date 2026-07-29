export type WorkflowMentionMediaType = 'image' | 'video' | 'audio' | 'text';

export type WorkflowMentionSourceType = 'connected' | 'project' | 'subject';

export type WorkflowMentionItem = {
  id: string;
  assetId?: number;
  type: WorkflowMentionMediaType;
  source?: WorkflowMentionSourceType;
  label: string;
  name?: string;
  previewUrl?: string;
  thumbUrl?: string;
  textContent?: string;
};

export interface CanvasMentionProvider {
  getItems(query: string): WorkflowMentionItem[];
  getReferenceAssets(): WorkflowMentionItem[];
}
