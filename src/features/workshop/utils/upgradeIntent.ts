const UPGRADE_INTENT =
  /每天|每周|每月|定时|长期|持续跟进|工作流|多专家|协作项目|工坊|定时任务|自动跑|cron|schedule/i;

const IDLE_CHAT_INTENT =
  /只是聊|随便聊聊|不要开工|先别开工|不用立任务|不要创建任务|纯闲聊|就问问/i;

export function shouldProposeWorkshopUpgrade(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || IDLE_CHAT_INTENT.test(trimmed)) return false;
  return UPGRADE_INTENT.test(trimmed);
}

export function isIdleChatIntent(text: string): boolean {
  return IDLE_CHAT_INTENT.test(text.trim());
}
