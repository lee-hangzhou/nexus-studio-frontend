import type { WorkshopTaskStatus } from '../../../api/generated/workshop';
import type { HostAuthScope } from '../types';

export function taskStatusLabel(status: WorkshopTaskStatus | string): string {
  const labels: Record<string, string> = {
    aligning: '正在梳理',
    awaiting_go: '等你确认',
    authorized: '可以开始',
    executing: '进行中',
    blocked: '需要处理',
    re_aligning: '正在调整',
    reviewing: '等你验收',
    done: '已完成',
    failed: '未完成',
    cancelled: '已停止',
  };
  return labels[status] ?? '未知状态';
}

export function proposalStatusLabel(status: string): string {
  if (status === 'pending') return '待确认';
  if (status === 'confirmed') return '已确认';
  if (status === 'declined') return '已拒绝';
  return '提议';
}

export function dataSourceStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    disconnected: '未连接',
    authorizing: '授权中',
    connected: '已连接',
    reauth_required: '授权过期',
    REAUTH_REQUIRED: '授权过期',
    permission_denied: '权限不足',
    syncing: '同步中',
    sync_failed: '同步失败',
    incomplete: '数据不完整',
    unsupported: '能力暂不支持',
  };
  return labels[status] ?? '状态未知';
}

export function shopConnectionStatusLabel(status: string | null | undefined): string {
  if (!status) return '未连接';
  return dataSourceStatusLabel(status);
}

export function hostAuthScopeDisplay(scope: HostAuthScope): string {
  const labels: Record<HostAuthScope, string> = {
    TAOBAO_STORE_WRITE: '修改淘宝 / 天猫店铺内容',
    BROWSER_WRITE: '代你操作网页',
    GENERATION_SUBMIT: '提交图片或视频生成',
    CREATE_SCHEDULE: '按计划自动运行',
  };
  return labels[scope];
}

export function deliverableTypeLabel(typeName: string): string {
  const labels: Record<string, string> = {
    MarketCompetitorBrief: '竞品研究简报',
    ListingCopyVersion: '商品文案',
    CreativeBrief: '创意简报',
    GenerationAssetRef: '生成资产引用',
    CampaignPlanDoc: '营销方案',
    EmailSequenceDraft: '站外邮件序列草稿',
    AdsStrategyBrief: '广告策略简报',
    AdsReportDiagnosis: '广告诊断',
    MetricsSnapshot: '经营指标快照',
    DailyOrWeeklyReview: '经营复盘',
    AnomalyList: '异常清单',
    ChartArtifact: '指标图表',
    PublishDiff: '待确认操作',
    PublishReceipt: '执行结果',
  };
  return labels[typeName] ?? '交付物';
}

export function publishOperationLabel(operation: string): string {
  const labels: Record<string, string> = {
    publish: '发布商品',
    edit: '编辑商品',
    list: '上架',
    unlist: '下架',
    upshelf: '上架',
    downshelf: '下架',
    delete: '删除',
    ship: '发货',
  };
  return labels[operation] ?? '店铺写操作';
}

export function importErrorCodeLabel(code: string): string {
  if (code === 'UNSUPPORTED_REPORT_TEMPLATE') return '报表模板暂不支持';
  return '导入错误';
}
