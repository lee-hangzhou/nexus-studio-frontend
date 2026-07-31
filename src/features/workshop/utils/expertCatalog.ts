import type { WorkshopRosterExpertView, WorkshopToolCapability } from '../types';

export interface ExpertDisplayProfile {
  /** 产品展示标题 */
  title: string;
  responsibility: string;
  readableData: string;
  outputs: string;
  canExternalExecute: boolean;
}

const BY_PRESET: Record<string, ExpertDisplayProfile> = {
  ecom_market_competitor_advisor: {
    title: '市场与竞品研究',
    responsibility: '基于公开信息与上传材料输出有来源的竞品与市场判断',
    readableData: '公开网页、上传报告、项目文件',
    outputs: '竞品研究简报',
    canExternalExecute: false,
  },
  ecom_listing_planner_executor: {
    title: '商品策划与文案',
    responsibility: '策划标题、卖点与合规文案，并协调创意图文生成',
    readableData: 'SKU 资料、类目规则、上传素材',
    outputs: '商品文案、创意需求、图片与视频',
    canExternalExecute: true,
  },
  ecom_campaign_planner_executor: {
    title: '营销活动策划',
    responsibility: '制定活动日历、预算与站外触达方案，默认不自动改价',
    readableData: '经营目标、历史活动材料、上传报表',
    outputs: '营销方案、站外邮件序列草稿',
    canExternalExecute: false,
  },
  ecom_ads_strategy_analyzer_executor: {
    title: '广告策略与分析',
    responsibility: '诊断投放效果并给出策略建议，不会直接修改广告账户',
    readableData: '广告报表导入、投放原始导出',
    outputs: '广告策略简报、广告诊断',
    canExternalExecute: false,
  },
  ecom_ops_analytics_executor: {
    title: '经营分析与复盘',
    responsibility: '汇总经营指标、异常与复盘结论',
    readableData: '订单/退款同步、生意参谋导出、成本数据',
    outputs: '指标快照、复盘、图表、异常清单',
    canExternalExecute: false,
  },
  ecom_taobao_store_ops_executor: {
    title: '淘天店铺运营',
    responsibility: '准备商品变更，并在你逐项确认后执行店铺操作',
    readableData: '店铺连接、商品草稿、类目与发布规则',
    outputs: '待确认变更、店铺操作结果',
    canExternalExecute: true,
  },
};

export function expertDisplayProfile(expert: WorkshopRosterExpertView): ExpertDisplayProfile {
  const preset = expert.preset_key ?? expert.source_preset_key;
  if (preset && BY_PRESET[preset]) {
    return BY_PRESET[preset];
  }
  return {
    title: expert.display_name?.trim() || expert.name,
    responsibility: '按当前任务协助完成工作',
    readableData: '项目内可读数据',
    outputs: '任务交付物',
    canExternalExecute: (expert.capability_allowlist ?? []).some(isExternalExecuteCapability),
  };
}

export function isExternalExecuteCapability(capability: WorkshopToolCapability): boolean {
  return (
    capability === 'taobao_store_write' ||
    capability === 'browser_write' ||
    capability === 'generation_submit'
  );
}

export function expertStatusLabel(input: {
  assigned: boolean;
  taskTitle?: string | null;
  taskStatus?: string | null;
}): string {
  if (!input.assigned) return '待命';
  if (input.taskStatus === 'executing') return '进行中';
  if (input.taskStatus === 'blocked') return '需要处理';
  if (input.taskStatus === 'reviewing') return '等你验收';
  if (input.taskStatus === 'done') return '已交付';
  return '已分配';
}
