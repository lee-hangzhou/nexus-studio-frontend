import type {
  AdsReportDiagnosis,
  AdsStrategyBrief,
  CampaignPlanDoc,
  ChartArtifact,
  CreativeBrief,
  EmailSequenceDraft,
  GenerationAssetRef,
  ListingCopyVersion,
  MarketCompetitorBrief,
  MetricAvailability,
  MetricsSnapshot,
  PublishDiff,
  PublishReceipt,
  ShopConnectionPublic,
} from '../../api/generated/ecommerce';
import type {
  WorkshopCreateTaskProposalView,
  WorkshopProjectView,
  WorkshopRosterExpertView,
  WorkshopTaskView,
  WorkshopToolCapability,
} from '../../api/generated/workshop';

export type {
  WorkshopCreateTaskProposalView,
  WorkshopProjectView,
  WorkshopRosterExpertView,
  WorkshopTaskView,
  WorkshopToolCapability,
  MarketCompetitorBrief,
  ListingCopyVersion,
  PublishDiff,
  PublishReceipt,
  MetricsSnapshot,
  MetricAvailability,
  ShopConnectionPublic,
  CampaignPlanDoc,
  AdsStrategyBrief,
  AdsReportDiagnosis,
  CreativeBrief,
  GenerationAssetRef,
  EmailSequenceDraft,
  ChartArtifact,
};

export type WorkshopExpertKind = 'advisor' | 'executor';

export interface WorkshopCreateProjectRequest {
  name: string;
  group_chat_id: number;
  initial_expert_keys?: string[];
}

export type EcommerceArtifactType =
  | 'MarketCompetitorBrief'
  | 'ListingCopyVersion'
  | 'PublishDiff'
  | 'PublishReceipt'
  | 'MetricsSnapshot'
  | 'CampaignPlanDoc'
  | 'AdsStrategyBrief'
  | 'AdsReportDiagnosis';

export interface EcommerceArtifactEnvelope {
  type: EcommerceArtifactType;
  payload:
    | MarketCompetitorBrief
    | ListingCopyVersion
    | PublishDiff
    | PublishReceipt
    | MetricsSnapshot
    | CampaignPlanDoc
    | AdsStrategyBrief
    | AdsReportDiagnosis;
}

export const HOST_AUTH_SCOPES = [
  'TAOBAO_STORE_WRITE',
  'BROWSER_WRITE',
  'GENERATION_SUBMIT',
  'CREATE_SCHEDULE',
] as const;

export type HostAuthScope = (typeof HOST_AUTH_SCOPES)[number];

export const HOST_SCOPE_TO_CAPABILITY: Record<HostAuthScope, WorkshopToolCapability> = {
  TAOBAO_STORE_WRITE: 'taobao_store_write',
  BROWSER_WRITE: 'browser_write',
  GENERATION_SUBMIT: 'generation_submit',
  CREATE_SCHEDULE: 'create_schedule',
};

export const UNSUPPORTED_REPORT_TEMPLATE = 'UNSUPPORTED_REPORT_TEMPLATE';

export interface ImportRowError {
  row_index: number;
  code: string;
  message: string;
}

export interface TaskTimelineEntry {
  task_id: string;
  title: string;
  status: string;
  speaker_role: string;
  expert_id: string | null;
}
