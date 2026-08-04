import { CloseOutlined, ShopOutlined } from '@ant-design/icons';
import { Avatar, Button, Tabs, Tag, Typography } from 'antd';
import { useMemo, useState } from 'react';

import type { ChatMessageView } from '../../../api/chat';
import type { WorkshopConnectorEntry, WorkshopProjectView } from '../../../api/workshop';
import { WorkshopSidePanel } from '../../workshop/components/WorkshopSidePanel';
import type { ExpertDirectoryEntry } from '../../workshop/utils/expertDirectory';
import { buildInviteCandidates } from '../../workshop/utils/turnRouting';
import workshopStyles from '../../workshop/components/WorkshopSidePanel.module.css';
import { SessionResourcesBody } from './SessionResourcesBody';

export type UnifiedSidePanelTab = 'overview' | 'resources' | 'members' | 'connect';

const CONNECTED_STATUSES = new Set([
  'connected',
  'authorizing',
  'syncing',
  'incomplete',
  'sync_failed',
  'permission_denied',
]);

export function UnifiedChatSidePanel(props: {
  title: string;
  project: WorkshopProjectView | null;
  messages: ChatMessageView[];
  expertDirectory: ExpertDirectoryEntry[];
  connectors?: WorkshopConnectorEntry[];
  onClose: () => void;
  onInviteExpert: (expertKey: string) => void;
  onBeginShopAuth: () => void;
  onProjectUpdated?: () => void;
  activeTab?: UnifiedSidePanelTab;
  onTabChange?: (tab: UnifiedSidePanelTab) => void;
  pendingShopAuth?: boolean;
  onPendingShopAuthHandled?: () => void;
  shopAuthBusy?: boolean;
}) {
  const {
    title,
    project,
    messages,
    expertDirectory,
    connectors = [],
    onClose,
    onInviteExpert,
    onBeginShopAuth,
    onProjectUpdated,
    activeTab,
    onTabChange,
    pendingShopAuth,
    onPendingShopAuthHandled,
    shopAuthBusy = false,
  } = props;

  const [internalTab, setInternalTab] = useState<UnifiedSidePanelTab>('overview');
  const resolvedTab = activeTab ?? internalTab;
  const setResolvedTab = (tab: string) => {
    const next = tab as UnifiedSidePanelTab;
    if (onTabChange) onTabChange(next);
    else setInternalTab(next);
  };

  const inviteCandidates = useMemo(
    () =>
      buildInviteCandidates({
        directory: expertDirectory.filter((item) => item.key !== 'host'),
        roomMembers: [],
      }),
    [expertDirectory],
  );

  const shopConnector =
    connectors.find((item) => item.key === 'taobao_shop') ??
    ({
      key: 'taobao_shop',
      name: '淘宝店铺',
      description: '',
      status: 'disconnected',
    } as WorkshopConnectorEntry);
  const shopConnected =
    shopConnector.status != null && CONNECTED_STATUSES.has(shopConnector.status);

  if (project) {
    return (
      <WorkshopSidePanel
        project={project}
        expertDirectory={expertDirectory}
        sessionResources={<SessionResourcesBody messages={messages} />}
        onClose={onClose}
        onProjectUpdated={onProjectUpdated}
        activeTab={resolvedTab}
        onTabChange={setResolvedTab}
        pendingShopAuth={pendingShopAuth}
        onPendingShopAuthHandled={onPendingShopAuthHandled}
      />
    );
  }

  return (
    <aside className={workshopStyles.root} aria-label="详情面板" id="studio-chat-side-panel">
      <header className={workshopStyles.head}>
        <div>
          <Typography.Text strong>{title || '新会话'}</Typography.Text>
          <div className={workshopStyles.meta}>
            <Tag>对话</Tag>
          </div>
        </div>
        <Button
          type="text"
          size="small"
          icon={<CloseOutlined />}
          aria-label="关闭"
          onClick={onClose}
        />
      </header>

      <Tabs
        className={workshopStyles.tabs}
        activeKey={resolvedTab}
        onChange={setResolvedTab}
        items={[
          {
            key: 'overview',
            label: '概览',
            children: (
              <div className={workshopStyles.sections}>
                <section className={workshopStyles.section}>
                  <Typography.Text strong className={workshopStyles.sectionTitle}>
                    当前工作
                  </Typography.Text>
                  <Typography.Text type="secondary">
                    升级为工坊项目，在项目里推进任务
                  </Typography.Text>
                </section>
              </div>
            ),
          },
          {
            key: 'resources',
            label: '资源',
            children: <SessionResourcesBody messages={messages} />,
          },
          {
            key: 'members',
            label: '成员',
            children: (
              <div className={workshopStyles.sections}>
                <section className={workshopStyles.section}>
                  <Typography.Text strong className={workshopStyles.sectionTitle}>
                    当前专家
                  </Typography.Text>
                  <ul className={workshopStyles.resourceList}>
                    <li className={workshopStyles.resourceRow}>
                      <div className={workshopStyles.resourceMain}>
                        <Avatar size={28} src="/avatars/experts/host.png" alt="项目助手">
                          助
                        </Avatar>
                        <span className={workshopStyles.resourceName}>项目助手</span>
                      </div>
                    </li>
                  </ul>
                </section>
                <section className={workshopStyles.section}>
                  <Typography.Text strong className={workshopStyles.sectionTitle}>
                    更多专家
                  </Typography.Text>
                  {inviteCandidates.length === 0 ? (
                    <Typography.Text type="secondary">没有更多可邀请的专家</Typography.Text>
                  ) : (
                    <ul className={workshopStyles.resourceList}>
                      {inviteCandidates.map((candidate) => (
                        <li key={candidate.key} className={workshopStyles.resourceRow}>
                          <div className={workshopStyles.resourceMain}>
                            <Avatar size={28} src={candidate.avatar_url} alt={candidate.name}>
                              {candidate.name.slice(0, 1)}
                            </Avatar>
                            <span className={workshopStyles.resourceName}>{candidate.name}</span>
                          </div>
                          <Button
                            size="small"
                            type="link"
                            onClick={() => onInviteExpert(candidate.key)}
                          >
                            邀请
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            ),
          },
          {
            key: 'connect',
            label: '连接',
            children: (
              <div className={workshopStyles.sections}>
                <section className={workshopStyles.section}>
                  <Typography.Text strong className={workshopStyles.sectionTitle}>
                    已连接
                  </Typography.Text>
                  {shopConnected ? (
                    <ul className={workshopStyles.resourceList}>
                      <li className={workshopStyles.resourceRow}>
                        <div className={workshopStyles.resourceMain}>
                          <Avatar size={28} icon={<ShopOutlined />} alt={shopConnector.name} />
                          <span className={workshopStyles.resourceName}>{shopConnector.name}</span>
                        </div>
                      </li>
                    </ul>
                  ) : (
                    <Typography.Text type="secondary">暂无连接</Typography.Text>
                  )}
                </section>
                <section className={workshopStyles.section}>
                  <Typography.Text strong className={workshopStyles.sectionTitle}>
                    可选连接
                  </Typography.Text>
                  {shopConnected ? (
                    <Typography.Text type="secondary">暂无更多连接</Typography.Text>
                  ) : (
                    <ul className={workshopStyles.resourceList}>
                      <li className={workshopStyles.resourceRow}>
                        <div className={workshopStyles.resourceMain}>
                          <Avatar size={28} icon={<ShopOutlined />} alt={shopConnector.name} />
                          <span className={workshopStyles.resourceName}>{shopConnector.name}</span>
                        </div>
                        <Button
                          size="small"
                          type="link"
                          loading={shopAuthBusy}
                          onClick={onBeginShopAuth}
                        >
                          连接
                        </Button>
                      </li>
                    </ul>
                  )}
                </section>
              </div>
            ),
          },
        ]}
      />
    </aside>
  );
}
