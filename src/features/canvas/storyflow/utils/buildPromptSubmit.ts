import type { WorkflowMentionItem } from '../../../generate/composer/promptEditor/types';
import {
  parsePromptToDoc,
  serializeDocToContent,
} from '../../../generate/composer/promptEditor/utils/promptSerialize';
import type { WorkflowPromptContent } from '../types';
import { mergeConnectedTextIntoSubmitContent } from './mergePredecessorTextForSubmit';

export type ManualMaterialRef = {
  assetId: number;
};

export type SubmitMaterialRefs = {
  ref_asset_ids: number[];
};

/** API 提交用纯文本：展开 text / text_ref，不发 @文本1 token */
export function contentToPlainSubmitPrompt(content: WorkflowPromptContent | undefined): string {
  if (!content?.length) {
    return '';
  }
  const parts: string[] = [];
  for (const seg of content) {
    if (seg.type === 'text' || seg.type === 'text_ref') {
      const text = seg.text.trim();
      if (text) {
        parts.push(text);
      }
    }
  }
  return parts.join('\n\n');
}

export function resolveEditorContentForSubmit(
  content: WorkflowPromptContent | undefined,
  storedPrompt: string,
  referenceAssets: WorkflowMentionItem[],
): WorkflowPromptContent {
  if (content && content.length > 0) {
    return content;
  }
  const trimmed = storedPrompt.trim();
  if (!trimmed) {
    return [];
  }
  return serializeDocToContent(parsePromptToDoc(trimmed, referenceAssets), referenceAssets);
}

/** 合并连线文本 + 编辑器内容，输出给后端的纯文本 prompt */
export function buildPlainSubmitPrompt(params: {
  content: WorkflowPromptContent | undefined;
  storedPrompt: string;
  referenceAssets: WorkflowMentionItem[];
  connectedPromptTexts?: string[];
}): string {
  const base = resolveEditorContentForSubmit(
    params.content,
    params.storedPrompt,
    params.referenceAssets,
  );
  const merged = mergeConnectedTextIntoSubmitContent(base, params.connectedPromptTexts ?? []);
  return contentToPlainSubmitPrompt(merged);
}

export function collectAssetIdsFromContent(content: WorkflowPromptContent): number[] {
  const ids: number[] = [];
  const seen = new Set<number>();
  for (const seg of content) {
    if (seg.type !== 'image_url' && seg.type !== 'video_url' && seg.type !== 'audio_url') {
      continue;
    }
    const assetId = seg.asset_id;
    if (typeof assetId !== 'number' || assetId <= 0 || seen.has(assetId)) {
      continue;
    }
    seen.add(assetId);
    ids.push(assetId);
  }
  return ids;
}

export function collectAssetIdsFromMentionItems(items: WorkflowMentionItem[]): number[] {
  const ids: number[] = [];
  const seen = new Set<number>();
  for (const item of items) {
    if (item.type === 'text') {
      continue;
    }
    const assetId = item.assetId;
    if (typeof assetId !== 'number' || assetId <= 0 || seen.has(assetId)) {
      continue;
    }
    seen.add(assetId);
    ids.push(assetId);
  }
  return ids;
}

function pushUniqueId(target: number[], seen: Set<number>, value: number) {
  if (value <= 0 || seen.has(value)) {
    return;
  }
  seen.add(value);
  target.push(value);
}

/** 与创作页 submitGenerate 一致：只收集 ref_asset_ids */
export function collectSubmitMaterialRefs(params: {
  content: WorkflowPromptContent;
  connectedAssetIds: number[];
  manualRefs?: ManualMaterialRef[];
  previewMediaRefs?: WorkflowMentionItem[];
  selfLibraryRefs?: number[];
}): SubmitMaterialRefs {
  const ref_asset_ids: number[] = [];
  const seenAssets = new Set<number>();

  for (const id of params.connectedAssetIds) {
    pushUniqueId(ref_asset_ids, seenAssets, id);
  }
  for (const id of collectAssetIdsFromContent(params.content)) {
    pushUniqueId(ref_asset_ids, seenAssets, id);
  }
  for (const id of collectAssetIdsFromMentionItems(params.previewMediaRefs ?? [])) {
    pushUniqueId(ref_asset_ids, seenAssets, id);
  }
  for (const ref of params.manualRefs ?? []) {
    if (typeof ref.assetId !== 'number' || ref.assetId < 1) {
      throw new Error('manualRefs 每项必须带有效 assetId');
    }
    pushUniqueId(ref_asset_ids, seenAssets, ref.assetId);
  }
  for (const id of params.selfLibraryRefs ?? []) {
    pushUniqueId(ref_asset_ids, seenAssets, id);
  }

  return { ref_asset_ids };
}

export function buildSubmitPromptAndRefs(params: {
  content: WorkflowPromptContent;
  storedPrompt: string;
  referenceAssets: WorkflowMentionItem[];
  connectedPromptTexts?: string[];
  connectedAssetIds: number[];
  manualRefs?: ManualMaterialRef[];
  /** @deprecated 用 manualRefs */
  manualAssetIds?: number[];
  previewMediaRefs?: WorkflowMentionItem[];
  selfLibraryRefs?: number[];
}): { prompt: string; ref_asset_ids: number[] } {
  const prompt = buildPlainSubmitPrompt({
    content: params.content,
    storedPrompt: params.storedPrompt,
    referenceAssets: params.referenceAssets,
    connectedPromptTexts: params.connectedPromptTexts,
  });

  const manualRefs =
    params.manualRefs ??
    (params.manualAssetIds?.map((assetId) => ({ assetId })) ?? []);

  const refs = collectSubmitMaterialRefs({
    content: params.content,
    connectedAssetIds: params.connectedAssetIds,
    manualRefs,
    previewMediaRefs: params.previewMediaRefs,
    selfLibraryRefs: params.selfLibraryRefs,
  });

  return { prompt, ...refs };
}

/** 手动提交 refs 校验：与后端 prepare_node_submit(mode=manual) 对齐 */
export function buildSubmitRefValidationPayload(params: {
  content: WorkflowPromptContent;
  manualRefs?: ManualMaterialRef[];
  previewMediaRefs?: WorkflowMentionItem[];
}): {
  submit_content: WorkflowPromptContent;
  manual_refs: { asset_id: number }[];
  preview_media_asset_ids: number[];
} {
  return {
    submit_content: params.content,
    manual_refs: (params.manualRefs ?? []).map((ref) => {
      if (typeof ref.assetId !== 'number' || ref.assetId < 1) {
        throw new Error('manualRefs 每项必须带有效 assetId');
      }
      return { asset_id: ref.assetId };
    }),
    preview_media_asset_ids: (params.previewMediaRefs ?? [])
      .map((item) => item.assetId)
      .filter((id): id is number => typeof id === 'number' && id > 0),
  };
}
