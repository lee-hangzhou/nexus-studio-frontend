/** 首页展示名：邮箱取 @ 前首段并首字母大写，避免整段邮箱进标题。 */
export function foyerDisplayName(username: string | null | undefined): string | null {
  const raw = username?.trim();
  if (!raw) return null;
  const local = raw.includes('@') ? raw.slice(0, raw.indexOf('@')) : raw;
  const short = local.split(/[._+\-]/).find(Boolean) || local;
  if (!short) return null;
  return short.charAt(0).toUpperCase() + short.slice(1);
}

/** 首页问候语；按时段 + 可选展示名。 */
export function buildFoyerGreeting(username: string | null | undefined, now = new Date()): string {
  const hour = now.getHours();
  const period = hour < 12 ? '上午好' : hour < 18 ? '下午好' : '晚上好';
  const name = foyerDisplayName(username);
  return name ? `${period}，${name}` : period;
}
