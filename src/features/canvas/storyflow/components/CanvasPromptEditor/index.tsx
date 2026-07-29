/**
 * 兼容层：生成 Prompt 编辑器已收敛到 features/generate/composer。
 * 画布节点继续从此路径 import。
 */
export {
  GenerationPromptEditor,
  CanvasPromptEditor,
  type GenerationPromptEditorProps,
  type CanvasPromptEditorProps,
  type CanvasPromptEditorPayload,
  type CanvasMentionProvider,
  type WorkflowMentionItem,
  type WorkflowPromptContent,
} from '../../../../generate/composer';

export type {
  WorkflowMentionMediaType,
  WorkflowMentionSourceType,
} from '../../../../generate/composer/promptEditor/types';

export {
  resolvePlainDocInput,
  resolvePromptDocInput,
  serializeEditorJsonToPayload,
  serializeEditorJsonToPrompt,
  serializePlainEditorPayload,
  parsePromptToDoc,
  serializeDocToContent,
} from '../../../../generate/composer/promptEditor/utils/promptSerialize';
