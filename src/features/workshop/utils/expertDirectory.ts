export type ExpertScope = 'platform' | 'mine';

export interface ExpertDirectoryEntry {
  key: string;
  name: string;
  role_phrase: string;
  avatar_url: string;
  tags: string[];
  applicable_tasks: string[];
  scope: ExpertScope;
  kind: 'expert';
  preset_key?: string;
}

export interface WorkshopRoomMemberView {
  expert_id: string;
  name: string;
  avatar_url: string;
  preset_key?: string | null;
  status: 'idle' | 'working' | 'blocked';
  current_task_id?: string | null;
  current_task_title?: string | null;
}

export interface WorkshopConnectorEntry {
  key: string;
  name: string;
  description: string;
  scope: ExpertScope;
  status?: 'connected' | 'disconnected' | 'authorizing';
}

export interface WorkshopRosterAttributionEntry {
  id: string;
  name: string;
  avatar_url?: string | null;
  preset_key?: string | null;
}

const AVATAR = (slug: string) => `/avatars/experts/${slug}.png`;

export const LOCAL_EXPERT_DIRECTORY: ExpertDirectoryEntry[] = [
  {
    key: 'host',
    name: '项目助手',
    role_phrase: '梳理目标并协调协作',
    avatar_url: AVATAR('host'),
    tags: ['协调', '规划'],
    applicable_tasks: ['立项', '任务拆分', '进度跟进'],
    scope: 'platform',
    kind: 'expert',
    preset_key: 'host',
  },
  {
    key: 'ecom_market_competitor_advisor',
    name: '市场与竞品研究',
    role_phrase: '输出有来源的竞品与市场判断',
    avatar_url: AVATAR('ecom-market'),
    tags: ['竞品', '市场'],
    applicable_tasks: ['竞品研究', '行业扫描'],
    scope: 'platform',
    kind: 'expert',
    preset_key: 'ecom_market_competitor_advisor',
  },
  {
    key: 'ecom_listing_planner_executor',
    name: '商品策划与文案',
    role_phrase: '策划标题卖点与合规文案',
    avatar_url: AVATAR('ecom-listing'),
    tags: ['文案', '上架'],
    applicable_tasks: ['商品文案', '创意需求'],
    scope: 'platform',
    kind: 'expert',
    preset_key: 'ecom_listing_planner_executor',
  },
  {
    key: 'ecom_campaign_planner_executor',
    name: '营销活动策划',
    role_phrase: '制定活动日历与触达方案',
    avatar_url: AVATAR('ecom-campaign'),
    tags: ['活动', '营销'],
    applicable_tasks: ['活动方案', '站外触达'],
    scope: 'platform',
    kind: 'expert',
    preset_key: 'ecom_campaign_planner_executor',
  },
  {
    key: 'ecom_ads_strategy_analyzer_executor',
    name: '广告策略与分析',
    role_phrase: '诊断投放效果并给出策略建议',
    avatar_url: AVATAR('ecom-ads'),
    tags: ['投放', '诊断'],
    applicable_tasks: ['广告策略', '投放复盘'],
    scope: 'platform',
    kind: 'expert',
    preset_key: 'ecom_ads_strategy_analyzer_executor',
  },
  {
    key: 'ecom_ops_analytics_executor',
    name: '经营分析与复盘',
    role_phrase: '汇总指标、异常与复盘结论',
    avatar_url: AVATAR('ecom-ops'),
    tags: ['经营', '复盘'],
    applicable_tasks: ['指标快照', '周报月报'],
    scope: 'platform',
    kind: 'expert',
    preset_key: 'ecom_ops_analytics_executor',
  },
  {
    key: 'ecom_taobao_store_ops_executor',
    name: '淘天店铺运营',
    role_phrase: '准备商品变更并在确认后执行',
    avatar_url: AVATAR('ecom-store'),
    tags: ['店铺', '运营'],
    applicable_tasks: ['商品变更', '店铺操作'],
    scope: 'platform',
    kind: 'expert',
    preset_key: 'ecom_taobao_store_ops_executor',
  },
];

export const LOCAL_WORKSHOP_CONNECTORS: WorkshopConnectorEntry[] = [
  {
    key: 'taobao_shop',
    name: '淘宝店铺',
    description: '连接店铺以读取商品并执行已确认变更',
    scope: 'platform',
    status: 'disconnected',
  },
];

export function findExpertByKey(key: string): ExpertDirectoryEntry | undefined {
  return LOCAL_EXPERT_DIRECTORY.find((item) => item.key === key);
}

export function filterExpertDirectory(input: {
  items: ExpertDirectoryEntry[];
  scope?: ExpertScope | 'all';
  query?: string;
}): ExpertDirectoryEntry[] {
  const query = input.query?.trim().toLowerCase() ?? '';
  return input.items.filter((item) => {
    if (input.scope && input.scope !== 'all' && item.scope !== input.scope) return false;
    if (!query) return true;
    const haystack = [item.name, item.role_phrase, ...item.tags, ...item.applicable_tasks]
      .join(' ')
      .toLowerCase();
    return haystack.includes(query);
  });
}

export function resolveSpeakerAttribution(input: {
  speaker_role?: string | null;
  expert_id?: string | null;
  expert_name?: string | null;
  avatar?: string | null;
  directory?: ExpertDirectoryEntry[];
  roster?: WorkshopRosterAttributionEntry[];
}): { name: string; avatar_url: string } | null {
  const expertId = input.expert_id?.trim();
  if (expertId && input.roster?.length) {
    const fromRoster = input.roster.find((item) => item.id === expertId);
    if (fromRoster) {
      return {
        name: fromRoster.name,
        avatar_url: fromRoster.avatar_url?.trim() || AVATAR('host'),
      };
    }
  }
  if (expertId) {
    const fromDirectory = input.directory?.find(
      (item) => item.key === expertId || item.preset_key === expertId,
    );
    if (fromDirectory) return { name: fromDirectory.name, avatar_url: fromDirectory.avatar_url };
    const expert = findExpertByKey(expertId);
    if (expert) return { name: expert.name, avatar_url: expert.avatar_url };
  }
  const explicitName = input.expert_name?.trim();
  const explicitAvatar = input.avatar?.trim();
  if (explicitName) {
    return {
      name: explicitName,
      avatar_url: explicitAvatar || AVATAR('host'),
    };
  }
  const role = input.speaker_role?.trim();
  if (!role) return null;
  if (role === 'host') {
    return { name: '项目助手', avatar_url: AVATAR('host') };
  }
  return null;
}

export type ExpertDirectoryLoadState =
  | { status: 'loading' }
  | { status: 'ready'; items: ExpertDirectoryEntry[] }
  | { status: 'empty' }
  | { status: 'error'; message: string };

export function expertDirectoryViewState(input: {
  loading: boolean;
  error?: string | null;
  items: ExpertDirectoryEntry[];
}): ExpertDirectoryLoadState {
  if (input.loading) return { status: 'loading' };
  if (input.error) return { status: 'error', message: input.error };
  if (input.items.length === 0) return { status: 'empty' };
  return { status: 'ready', items: input.items };
}
