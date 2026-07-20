/** 节点生成中状态标签，用于 prompt 底栏 */
export function GenerationRunningLabel({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return <span className="workflow-image-gen-bar__generating-label">生成中</span>;
}
