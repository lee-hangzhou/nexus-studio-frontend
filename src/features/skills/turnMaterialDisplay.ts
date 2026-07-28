import type { TurnMaterialBlock } from './types';

/** 素材块展示文案（消息芯片与画布芯片共用） */
export function turnMaterialLabel(block: TurnMaterialBlock): string {
  if (block.type === 'node') {
    return `节点 ${block.nodeId}`;
  }
  const name = typeof block.name === 'string' ? block.name.trim() : '';
  if (name) {
    return `${block.type} · ${name}`;
  }
  return `${block.type} #${block.assetId}`;
}

/** 素材块稳定身份键；不含列表下标 */
export function materialStableKey(block: TurnMaterialBlock): string {
  if (block.type === 'node') {
    return `node:${block.nodeId}`;
  }
  return `${block.type}:${block.assetId}`;
}

/** 为同列表内重复身份追加出现序，仍不使用数组下标 */
export function materialListKeys(
  blocks: readonly TurnMaterialBlock[],
  prefix: string,
): string[] {
  const seen = new Map<string, number>();
  return blocks.map((block) => {
    const base = `${prefix}:${materialStableKey(block)}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base}~${n}`;
  });
}
