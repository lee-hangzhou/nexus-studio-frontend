import type {
  TurnContentBlock,
  TurnMaterialBlock,
  TurnMediaBlock,
  TurnMediaOrigin,
  TurnMediaType,
  TurnNodeBlock,
  TurnSkillBlock,
  TurnTextBlock,
  TurnUserInput,
} from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

const MEDIA_TYPES = new Set<TurnMediaType>(['image', 'video', 'audio', 'file']);
const MEDIA_ORIGINS = new Set<TurnMediaOrigin>(['library', 'upload']);

function isMediaType(value: unknown): value is TurnMediaType {
  return typeof value === 'string' && MEDIA_TYPES.has(value as TurnMediaType);
}

function isMediaOrigin(value: unknown): value is TurnMediaOrigin {
  return typeof value === 'string' && MEDIA_ORIGINS.has(value as TurnMediaOrigin);
}

function isTextBlock(value: unknown): value is TurnTextBlock {
  return isRecord(value) && value.type === 'text' && typeof value.text === 'string';
}

function isSkillBlock(value: unknown): value is TurnSkillBlock {
  return isRecord(value) && value.type === 'skill' && typeof value.path === 'string' && value.path.length > 0;
}

function readAssetId(value: Record<string, unknown>): number | null {
  const assetId = value.assetId ?? value.asset_id;
  if (typeof assetId !== 'number' || !Number.isFinite(assetId) || assetId < 1) {
    return null;
  }
  return assetId;
}

function readNodeId(value: Record<string, unknown>): string | null {
  const nodeId = value.nodeId ?? value.node_id;
  if (typeof nodeId !== 'string' || nodeId.length === 0) {
    return null;
  }
  return nodeId;
}

function isMediaBlock(value: unknown): value is TurnMediaBlock {
  if (!isRecord(value)) return false;
  if (!isMediaType(value.type)) return false;
  if (!isMediaOrigin(value.origin)) return false;
  if (readAssetId(value) == null) return false;
  if (value.mediaType != null && !isMediaType(value.mediaType)) return false;
  if (value.name != null && (typeof value.name !== 'string' || value.name.length === 0)) return false;
  if (value.url != null && (typeof value.url !== 'string' || value.url.length === 0)) return false;
  const previewUrl = value.previewUrl ?? value.preview_url;
  if (previewUrl != null) {
    if (value.type !== 'video') return false;
    if (typeof previewUrl !== 'string' || previewUrl.length === 0) return false;
  }
  return true;
}

function isNodeBlock(value: unknown): value is TurnNodeBlock {
  if (!isRecord(value)) return false;
  if (value.type != null && value.type !== 'node') return false;
  return readNodeId(value) != null;
}

function normalizeMediaBlock(value: Record<string, unknown>): TurnMediaBlock {
  const assetId = readAssetId(value);
  const previewUrl = value.previewUrl ?? value.preview_url;
  if (assetId == null || !isMediaType(value.type) || !isMediaOrigin(value.origin)) {
    throw new Error('normalizeMediaBlock called with invalid media block');
  }
  const block: TurnMediaBlock = {
    type: value.type,
    origin: value.origin,
    assetId,
  };
  if (isMediaType(value.mediaType) || value.mediaType === null) {
    block.mediaType = value.mediaType;
  }
  if (typeof value.name === 'string') {
    block.name = value.name;
  } else if (value.name === null) {
    block.name = null;
  }
  if (typeof value.url === 'string') {
    block.url = value.url;
  } else if (value.url === null) {
    block.url = null;
  }
  if (typeof previewUrl === 'string') {
    block.previewUrl = previewUrl;
  } else if (previewUrl === null) {
    block.previewUrl = null;
  }
  return block;
}

function normalizeNodeBlock(value: Record<string, unknown>): TurnNodeBlock {
  const nodeId = readNodeId(value);
  if (nodeId == null) {
    throw new Error('normalizeNodeBlock called with invalid node block');
  }
  return {
    type: 'node',
    nodeId,
  };
}

function parseContentBlock(value: unknown): TurnContentBlock | null {
  if (isTextBlock(value)) {
    return { type: 'text', text: value.text };
  }
  if (isSkillBlock(value)) {
    return { type: 'skill', path: value.path };
  }
  if (!isRecord(value)) return null;
  if (isMediaBlock(value)) {
    return normalizeMediaBlock(value);
  }
  if (isNodeBlock(value)) {
    return normalizeNodeBlock(value);
  }
  return null;
}

function parseMaterialBlock(value: unknown): TurnMaterialBlock | null {
  if (!isRecord(value)) return null;
  if (isMediaBlock(value)) {
    return normalizeMediaBlock(value);
  }
  if (isNodeBlock(value)) {
    return normalizeNodeBlock(value);
  }
  return null;
}

/** 从 composer 文本与选中技能路径构造 turn content blocks（技能在前、文本在后） */
export function buildTurnContentBlocks(text: string, skillPaths: string[]): TurnContentBlock[] {
  const trimmed = text.trim();
  const blocks: TurnContentBlock[] = [];
  const seen = new Set<string>();
  for (const path of skillPaths) {
    const normalized = path.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    blocks.push({ type: 'skill', path: normalized });
  }
  if (trimmed) {
    blocks.push({ type: 'text', text: trimmed });
  }
  return blocks;
}

export function buildTurnUserInput(
  text: string,
  skillPaths: string[],
  materials: TurnMaterialBlock[] = [],
): TurnUserInput {
  return {
    content: buildTurnContentBlocks(text, skillPaths),
    materials,
  };
}

/** 解析持久化的 input 快照；无效时返回 null */
export function parseUserInputSnapshot(raw: unknown): TurnUserInput | null {
  if (!isRecord(raw)) return null;
  const contentRaw = raw.content;
  if (!Array.isArray(contentRaw) || contentRaw.length === 0) return null;
  const content: TurnContentBlock[] = [];
  for (const block of contentRaw) {
    const parsed = parseContentBlock(block);
    if (!parsed) return null;
    content.push(parsed);
  }
  const materialsRaw = raw.materials;
  if (materialsRaw == null) {
    return { content, materials: [] };
  }
  if (!Array.isArray(materialsRaw)) return null;
  const materials: TurnMaterialBlock[] = [];
  for (const block of materialsRaw) {
    const parsed = parseMaterialBlock(block);
    if (!parsed) return null;
    materials.push(parsed);
  }
  return { content, materials };
}

/** 从 input 或 plain string 提取用于展示的文本 */
export function displayTextFromUserMessage(input: TurnUserInput | null | undefined, fallbackContent: string): string {
  if (input?.content?.length) {
    const textParts = input.content
      .filter((block): block is TurnTextBlock => block.type === 'text')
      .map((block) => block.text)
      .filter(Boolean);
    if (textParts.length > 0) return textParts.join('\n');
  }
  return fallbackContent;
}

/** 从 input 提取技能路径（保持顺序、去重） */
export function extractSkillPathsFromInput(input: TurnUserInput | null | undefined): string[] {
  if (!input?.content?.length) return [];
  const seen = new Set<string>();
  const paths: string[] = [];
  for (const block of input.content) {
    if (block.type !== 'skill') continue;
    if (seen.has(block.path)) continue;
    seen.add(block.path);
    paths.push(block.path);
  }
  return paths;
}

/** 将 blocks 编译为人类可读文本（与后端 compile_human_text 对齐） */
export function compileHumanTextFromBlocks(blocks: TurnContentBlock[]): string {
  const parts: string[] = [];
  for (const block of blocks) {
    if (block.type === 'text') {
      parts.push(block.text);
    } else if (block.type === 'skill') {
      parts.push(`[skill:${block.path}]`);
    } else if (block.type === 'node') {
      parts.push(`[node:${block.nodeId}]`);
    } else {
      parts.push(`[${block.type}:asset_id=${block.assetId}]`);
    }
  }
  return parts.join('\n');
}
