export function confirmInviteUpgradeCopy(expertName: string): {
  title: string;
  content: string;
  okText: string;
} {
  return {
    title: '升级为项目并邀请',
    content: `邀请「${expertName}」后，当前对话将保存为项目`,
    okText: '邀请',
  };
}
