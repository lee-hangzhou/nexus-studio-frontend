import { ShopOutlined } from '@ant-design/icons';
import { Alert, Avatar, Button, Typography } from 'antd';

import type { WorkshopConnectorEntry, WorkshopDataSourcesView } from '../../../api/workshop';
import { shopConnectionStatusLabel } from '../utils/displayLabels';
import styles from './DataSourcesPanel.module.css';
import panelStyles from './WorkshopSidePanel.module.css';

const CONNECTED_STATUSES = new Set([
  'connected',
  'authorizing',
  'syncing',
  'incomplete',
  'sync_failed',
  'permission_denied',
]);

function isConnectedStatus(status: string): boolean {
  return CONNECTED_STATUSES.has(status);
}

function shopStatusFromDataSources(dataSources: WorkshopDataSourcesView | null): string {
  return dataSources?.shop?.status ?? 'disconnected';
}

export function DataSourcesPanel(props: {
  dataSources: WorkshopDataSourcesView | null;
  connectors?: WorkshopConnectorEntry[];
  onBeginShopAuth: () => void;
  onRefresh: () => void;
  authBusy?: boolean;
}) {
  const { dataSources, connectors, onBeginShopAuth, authBusy } = props;

  const shopFromConnectors = connectors?.find((item) => item.key === 'taobao_shop');
  const shopStatus = shopFromConnectors?.status ?? shopStatusFromDataSources(dataSources);
  const shopName = shopFromConnectors?.name ?? '淘宝店铺';
  const connected = isConnectedStatus(shopStatus);
  const needsReconnect =
    shopStatus === 'reauth_required' || shopStatus === 'REAUTH_REQUIRED';
  const unsupported = shopStatus === 'unsupported';

  return (
    <div className={panelStyles.sections}>
      <section className={panelStyles.section}>
        <Typography.Text strong className={panelStyles.sectionTitle}>
          已连接
        </Typography.Text>
        {connected ? (
          <ul className={panelStyles.resourceList}>
            <li className={panelStyles.resourceRow}>
              <div className={panelStyles.resourceMain}>
                <Avatar size={28} icon={<ShopOutlined />} alt={shopName} />
                <div>
                  <span className={panelStyles.resourceName}>{shopName}</span>
                  <div className={styles.detail}>{shopConnectionStatusLabel(shopStatus)}</div>
                </div>
              </div>
              {needsReconnect ? (
                <Button
                  size="small"
                  type="link"
                  loading={authBusy}
                  onClick={onBeginShopAuth}
                >
                  重新授权
                </Button>
              ) : null}
            </li>
          </ul>
        ) : (
          <Typography.Text type="secondary">暂无连接</Typography.Text>
        )}
      </section>

      <section className={panelStyles.section}>
        <Typography.Text strong className={panelStyles.sectionTitle}>
          可选连接
        </Typography.Text>
        {connected ? (
          <Typography.Text type="secondary">暂无更多连接</Typography.Text>
        ) : (
          <ul className={panelStyles.resourceList}>
            <li className={panelStyles.resourceRow}>
              <div className={panelStyles.resourceMain}>
                <Avatar size={28} icon={<ShopOutlined />} alt={shopName} />
                <div>
                  <span className={panelStyles.resourceName}>{shopName}</span>
                  <div className={styles.detail}>
                    {unsupported
                      ? '当前环境未配置淘宝应用'
                      : shopConnectionStatusLabel(shopStatus)}
                  </div>
                </div>
              </div>
              {unsupported ? null : (
                <Button
                  size="small"
                  type="link"
                  loading={authBusy}
                  onClick={onBeginShopAuth}
                >
                  {needsReconnect ? '重新授权' : '连接'}
                </Button>
              )}
            </li>
          </ul>
        )}
        {unsupported ? (
          <Alert
            type="warning"
            showIcon
            message="当前环境未配置淘宝应用"
            description="配置淘宝开放平台应用后即可连接店铺"
          />
        ) : null}
      </section>
    </div>
  );
}
