/** Single source for workspace primary nav (labels + routes). Icons live in AppShell. */
export const WORKSPACE_NAV_ITEMS: ReadonlyArray<{
  key: string;
  to: string;
  label: string;
  end?: boolean;
}> = [
  { key: 'home', to: '/', label: '首页', end: true },
  { key: 'chat', to: '/chat', label: '超级工坊' },
  { key: 'generate', to: '/generate', label: '创作' },
  { key: 'projects', to: '/projects', label: '画布' },
  { key: 'assets', to: '/assets', label: '资源' },
];
