import type { TurnContentBlock, TurnSkillBlock, TurnTextBlock, TurnUserInput } from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isTextBlock(value: unknown): value is TurnTextBlock {
  return isRecord(value) && value.type === 'text' && typeof value.text === 'string';
}

function isSkillBlock(value: unknown): value is TurnSkillBlock {
  return isRecord(value) && value.type === 'skill' && typeof value.path === 'string' && value.path.length > 0;
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

export function buildTurnUserInput(text: string, skillPaths: string[]): TurnUserInput {
  return {
    content: buildTurnContentBlocks(text, skillPaths),
    materials: [],
  };
}

/** 解析持久化的 input 快照；无效时返回 null */
export function parseUserInputSnapshot(raw: unknown): TurnUserInput | null {
  if (!isRecord(raw)) return null;
  const contentRaw = raw.content;
  if (!Array.isArray(contentRaw) || contentRaw.length === 0) return null;
  const content: TurnContentBlock[] = [];
  for (const block of contentRaw) {
    if (isTextBlock(block)) {
      content.push({ type: 'text', text: block.text });
    } else if (isSkillBlock(block)) {
      content.push({ type: 'skill', path: block.path });
    } else {
      return null;
    }
  }
  const materials = raw.materials;
  if (Array.isArray(materials) && materials.length > 0) return null;
  return { content, materials: [] };
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
    } else {
      parts.push(`[skill:${block.path}]`);
    }
  }
  return parts.join('\n');
}
