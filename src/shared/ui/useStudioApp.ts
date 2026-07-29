import { App } from 'antd';

/**
 * Themed Ant Design static APIs (modal/message/notification).
 * Prefer this over `Modal.confirm` / `message.*` — those ignore ConfigProvider
 * and fall back to the light default theme.
 */
export function useStudioApp() {
  return App.useApp();
}
