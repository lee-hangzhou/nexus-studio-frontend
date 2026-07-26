/** 画布/项目占位封面色板索引；样式由 CoverThumb.module.css token 承载。 */
export function projectAccentIndex(id: number): number {
  return ((id % 4) + 4) % 4;
}
