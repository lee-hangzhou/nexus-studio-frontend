import { App as AntdApp, ConfigProvider, theme } from 'antd';
import { UserProvider } from './contexts/UserContext';
import { AppRouter } from './router';

export default function App() {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#1D4EDB',
          borderRadius: 12,
          fontFamily:
            "'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', -apple-system, BlinkMacSystemFont, sans-serif",
          colorBgContainer: '#ffffff',
          colorText: '#0f172a',
          colorTextSecondary: '#64748b',
          controlHeight: 40,
        },
        components: {
          Card: {
            borderRadiusLG: 16,
            paddingLG: 20,
          },
          Button: {
            borderRadius: 999,
            controlHeight: 40,
          },
          Input: {
            borderRadius: 12,
          },
          Checkbox: {
            borderRadiusSM: 4,
            controlInteractiveSize: 16,
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
