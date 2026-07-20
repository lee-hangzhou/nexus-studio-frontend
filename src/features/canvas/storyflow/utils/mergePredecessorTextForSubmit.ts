import type { DirectPredecessor } from '../hooks/useDirectPredecessors';
import type { WorkflowPromptContent } from '../types';

/** 前置文本节点正文（去重、保持连线顺序） */
export function pickPredecessorTextContents(predecessors: DirectPredecessor[]): string[] {
  const texts: string[] = [];
  const seen = new Set<string>();

  for (const pred of predecessors) {
    if (pred.type !== 'text') {
      continue;
    }
    const text = pred.data.output_text?.trim() ?? '';
    if (!text || seen.has(text)) {
      continue;
    }
    seen.add(text);
    texts.push(text);
  }

  return texts;
}

/** 连线 prompt_input 边注入的文本（output_text → prompt_input） */
export function pickConnectedPromptInputTexts(
  nodeId: string,
  nodes: ReadonlyArray<{ id: string; data: { output_text?: string } }>,
  edges: ReadonlyArray<{
    source: string;
    target: string;
    data?: { source_port?: string; target_port?: string };
  }>,
): string[] {
  const texts: string[] = [];
  const seen = new Set<string>();

  for (const edge of edges) {
    if (edge.target !== nodeId) {
      continue;
    }
    if (edge.data?.target_port !== 'prompt_input' || edge.data?.source_port !== 'output_text') {
      continue;
    }
    const source = nodes.find((node) => node.id === edge.source);
    const text = source?.data.output_text?.trim() ?? '';
    if (!text || seen.has(text)) {
      continue;
    }
    seen.add(text);
    texts.push(text);
  }

  return texts;
}

/** 提交专用：将前置文本拼到 prompt 前，不写回节点 data。 */
export function mergePredecessorTextForPlainPrompt(
  prompt: string,
  predecessors: DirectPredecessor[],
): string {
  const prefixTexts = pickPredecessorTextContents(predecessors);
  if (prefixTexts.length === 0) {
    return prompt;
  }
  const user = prompt.trim();
  const mergedPrefix = prefixTexts.join('\n\n');
  if (!user) {
    return mergedPrefix;
  }
  if (prefixTexts.some((text) => user.includes(text))) {
    return user;
  }
  return `${mergedPrefix}\n\n${user}`;
}

/** @deprecated 用 pickConnectedReferenceAssetIds，按边端口与终态过滤 */
export function pickPredecessorAssetIds(predecessors: DirectPredecessor[]): number[] {
  const ids: number[] = [];
  const seen = new Set<number>();

  for (const pred of predecessors) {
    if (pred.type === 'text') {
      continue;
    }
    const assetId = pred.data.output_asset_ids?.[0];
    if (typeof assetId !== 'number' || assetId <= 0 || seen.has(assetId)) {
      continue;
    }
    seen.add(assetId);
    ids.push(assetId);
  }

  return ids;
}

/** 连线参考素材：仅 REFERENCE_ASSET 边 + 源节点 SUCCESS + output_asset */
export function pickConnectedReferenceAssetIds(
  nodeId: string,
  nodes: ReadonlyArray<{ id: string; data: { status?: string; output_asset_ids?: number[] } }>,
  edges: ReadonlyArray<{
    source: string;
    target: string;
    data?: { source_port?: string; target_port?: string };
  }>,
): number[] {
  const ids: number[] = [];
  const seen = new Set<number>();

  for (const edge of edges) {
    if (edge.target !== nodeId) {
      continue;
    }
    if (edge.data?.target_port !== 'reference_asset' || edge.data?.source_port !== 'output_asset') {
      continue;
    }
    const source = nodes.find((node) => node.id === edge.source);
    if (!source || source.data.status !== 'success') {
      continue;
    }
    const rawIds = source.data.output_asset_ids ?? [];
    for (const assetId of rawIds) {
      if (typeof assetId !== 'number' || assetId <= 0 || seen.has(assetId)) {
        continue;
      }
      seen.add(assetId);
      ids.push(assetId);
    }
  }

  return ids;
}

function collectExistingTextRefSnapshots(content: WorkflowPromptContent): Set<string> {
  const seen = new Set<string>();
  for (const seg of content) {
    if (seg.type === 'text_ref') {
      const text = seg.text.trim();
      if (text) {
        seen.add(text);
      }
    }
  }
  return seen;
}

/** 提交专用：仅合并 prompt_input 连线文本；编辑器内 @ 引用不在此重复注入。 */
export function mergeConnectedTextIntoSubmitContent(
  content: WorkflowPromptContent | undefined,
  connectedTexts: string[],
): WorkflowPromptContent {
  const base = content ?? [];
  const seen = collectExistingTextRefSnapshots(base);
  const prefix: WorkflowPromptContent = [];

  for (const text of connectedTexts) {
    if (!text || seen.has(text)) {
      continue;
    }
    seen.add(text);
    prefix.push({ type: 'text_ref', text });
  }

  return [...prefix, ...base];
}

/** @deprecated 用 mergeConnectedTextIntoSubmitContent + pickConnectedPromptInputTexts */
export function mergePredecessorTextIntoSubmitContent(
  content: WorkflowPromptContent | undefined,
  predecessors: DirectPredecessor[],
): WorkflowPromptContent {
  return mergeConnectedTextIntoSubmitContent(content, pickPredecessorTextContents(predecessors));
}

export function mergeAssetIdsForSubmit(connectedIds: number[], manualIds: number[]): number[] {
  const merged: number[] = [];
  const seen = new Set<number>();
  for (const id of [...connectedIds, ...manualIds]) {
    if (id <= 0 || seen.has(id)) {
      continue;
    }
    seen.add(id);
    merged.push(id);
  }
  return merged;
}
