/** @deprecated 专家团队不是产品路径；恒为 false */
export function shouldPromptTeamUpgrade(_selectedKey: string | null | undefined): boolean {
  return false;
}

/** @deprecated 专家团队不是产品路径；恒为 false */
export function shouldPromptTeamUpgradeOnSelect(_input: {
  previousKey: string | null;
  nextKey: string;
}): boolean {
  return false;
}
