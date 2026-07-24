import { App as AntdApp, ConfigProvider, theme } from 'antd';
import { UserProvider } from './contexts/UserContext';
import { AppRouter } from './router';

export default function App() {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#F0B35B',
          colorInfo: '#75A7FF',
          colorSuccess: '#48C78E',
          colorWarning: '#F2B84B',
          colorError: '#FF6B72',
          borderRadius: 8,
          fontFamily:
            "'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', -apple-system, BlinkMacSystemFont, sans-serif",
          colorBgBase: '#0B0D10',
          colorBgContainer: '#15181D',
          colorBgElevated: '#1C2026',
          colorBorder: '#2A2E35',
          colorBorderSecondary: '#20242A',
          colorText: '#F2F3F5',
          colorTextSecondary: '#949BA6',
          controlHeight: 36,
        },
        components: {
          Card: {
            borderRadiusLG: 8,
            paddingLG: 16,
          },
          Button: {
            borderRadius: 8,
            controlHeight: 36,
          },
          Input: {
            borderRadius: 8,
          },
          Checkbox: {
            borderRadiusSM: 4,
            controlInteractiveSize: 16,
          },
          /* 与 --studio-control-* 对齐（Antd token 不吃 CSS 变量，用等价色） */
          Select: {
            optionSelectedBg: 'rgba(240, 179, 91, 0.1)',
            optionActiveBg: 'rgba(242, 243, 245, 0.06)',
          },
        },
      }}
    >
      <AntdApp>
        <UserProvider>
          <AppRouter />
        </UserProvider>
      </AntdApp>
    </ConfigProvider>
  );
}
