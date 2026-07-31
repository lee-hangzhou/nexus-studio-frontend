import { ApiOutlined, SearchOutlined, ThunderboltOutlined, UserOutlined } from '@ant-design/icons';
import { Alert, Avatar, Button, Input, Segmented, Spin, Tabs, Tag, Typography } from 'antd';
import { useMemo, useState } from 'react';

import type { ExpertDirectoryEntry, WorkshopConnectorEntry } from '../../../api/workshop';
import { expertDirectoryViewState, filterExpertDirectory } from '../utils/expertDirectory';
import styles from './WorkshopResourceCenter.module.css';

type ScopeFilter = 'platform' | 'mine';

export function WorkshopResourceCenter(props: {
  experts: ExpertDirectoryEntry[];
  connectors: WorkshopConnectorEntry[];
  skills?: Array<{ name: string; path: string; scope: string }>;
  loading?: boolean;
  error?: string | null;
  /** 专家卡片主操作文案：使用 / 邀请 */
  expertActionLabel?: string;
  onUseExpert?: (key: string) => void;
  onUseSkill?: (path: string) => void;
  onOpenConnector?: (key: string) => void;
  sessionResources?: React.ReactNode;
}) {
  const {
    experts,
    connectors,
    skills = [],
    loading = false,
    error = null,
    expertActionLabel = '使用',
    onUseExpert,
    onUseSkill,
    onOpenConnector,
    sessionResources,
  } = props;

  const [scope, setScope] = useState<ScopeFilter>('platform');
  const [query, setQuery] = useState('');

  const filteredExperts = useMemo(
    () => filterExpertDirectory({ items: experts, scope, query }),
    [experts, query, scope],
  );
  const directoryState = expertDirectoryViewState({
    loading,
    error,
    items: filteredExperts,
  });

  const filters = (
    <div className={styles.filters}>
      <Input
        allowClear
        prefix={<SearchOutlined aria-hidden />}
        placeholder="搜索名称、标签或适用任务"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <Segmented
        size="small"
        value={scope}
        onChange={(value) => setScope(value as ScopeFilter)}
        options={[
          { label: '平台', value: 'platform' },
          { label: '我的', value: 'mine' },
        ]}
      />
    </div>
  );

  const expertCards =
    directoryState.status === 'loading' ? (
      <Spin />
    ) : directoryState.status === 'error' ? (
      <Alert type="error" showIcon message={directoryState.message} />
    ) : directoryState.status === 'empty' ? (
      <Typography.Text type="secondary">暂无匹配专家</Typography.Text>
    ) : (
      <div className={styles.grid}>
        {directoryState.items.map((expert) => (
          <article key={expert.key} className={styles.card}>
            <div className={styles.cardHead}>
              <Avatar size={36} src={expert.avatar_url} alt="">
                {expert.name.slice(0, 1)}
              </Avatar>
              <div>
                <Typography.Text strong>{expert.name}</Typography.Text>
                <Typography.Paragraph type="secondary" className={styles.role}>
                  {expert.role_phrase}
                </Typography.Paragraph>
              </div>
            </div>
            <div className={styles.tags}>
              {expert.tags.slice(0, 3).map((tag) => (
                <Tag key={tag}>{tag}</Tag>
              ))}
            </div>
            <Button type="primary" size="small" onClick={() => onUseExpert?.(expert.key)}>
              {expertActionLabel}
            </Button>
          </article>
        ))}
      </div>
    );

  const skillCards = (
    <div className={styles.list}>
      {skills.length === 0 ? (
        <Typography.Text type="secondary">还没有可选技能，可在「管理技能」中启用</Typography.Text>
      ) : (
        skills.map((skill) => (
          <div key={`${skill.scope}:${skill.path}`} className={styles.listRow}>
            <div>
              <Typography.Text strong>{skill.name}</Typography.Text>
              <Typography.Paragraph type="secondary" className={styles.role}>
                {skill.path}
              </Typography.Paragraph>
            </div>
            <Button size="small" onClick={() => onUseSkill?.(skill.path)}>
              使用
            </Button>
          </div>
        ))
      )}
    </div>
  );

  const connectorCards = (
    <div className={styles.list}>
      {connectors.length === 0 ? (
        <Typography.Text type="secondary">暂无连接器</Typography.Text>
      ) : (
        connectors.map((connector) => (
          <div key={connector.key} className={styles.listRow}>
            <div>
              <Typography.Text strong>{connector.name}</Typography.Text>
              <Typography.Paragraph type="secondary" className={styles.role}>
                {connector.description}
              </Typography.Paragraph>
            </div>
            <Button size="small" onClick={() => onOpenConnector?.(connector.key)}>
              配置
            </Button>
          </div>
        ))
      )}
    </div>
  );

  return (
    <div className={styles.root}>
      <Tabs
        size="small"
        items={[
          ...(sessionResources
            ? [{ key: 'session', label: '会话资源', children: sessionResources }]
            : []),
          {
            key: 'experts',
            label: (
              <span>
                <UserOutlined aria-hidden /> 专家
              </span>
            ),
            children: (
              <>
                {filters}
                {expertCards}
              </>
            ),
          },
          {
            key: 'skills',
            label: (
              <span>
                <ThunderboltOutlined aria-hidden /> 技能
              </span>
            ),
            children: skillCards,
          },
          {
            key: 'connectors',
            label: (
              <span>
                <ApiOutlined aria-hidden /> 连接器
              </span>
            ),
            children: connectorCards,
          },
        ]}
      />
    </div>
  );
}
