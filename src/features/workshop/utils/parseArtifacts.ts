import type { WorkshopArtifactView } from '../../../api/workshop';
import type {
  AdsReportDiagnosis,
  AdsStrategyBrief,
  CampaignPlanDoc,
  EcommerceArtifactEnvelope,
  ListingCopyVersion,
  MarketCompetitorBrief,
  MetricsSnapshot,
  PublishDiff,
  PublishReceipt,
} from '../types';
import { deliverableTypeLabel } from './displayLabels';

const KNOWN_TYPES = new Set([
  'MarketCompetitorBrief',
  'ListingCopyVersion',
  'PublishDiff',
  'PublishReceipt',
  'MetricsSnapshot',
  'CampaignPlanDoc',
  'AdsStrategyBrief',
  'AdsReportDiagnosis',
  'CreativeBrief',
  'GenerationAssetRef',
  'EmailSequenceDraft',
  'DailyOrWeeklyReview',
  'AnomalyList',
  'ChartArtifact',
]);

export interface ParsedWorkshopArtifact {
  id: string;
  taskId: string | null;
  typeName: string;
  typeLabel: string;
  createdAt: string;
  updatedAt: string;
  envelope: EcommerceArtifactEnvelope | null;
  rawContent: string | null;
  parseError: string | null;
}

function tryParseJson(content: string | null | undefined): unknown | null {
  if (!content || !content.trim()) return null;
  try {
    return JSON.parse(content) as unknown;
  } catch {
    return null;
  }
}

function asEnvelope(typeName: string, payload: unknown): EcommerceArtifactEnvelope | null {
  if (!payload || typeof payload !== 'object') return null;
  switch (typeName) {
    case 'MarketCompetitorBrief':
      return { type: 'MarketCompetitorBrief', payload: payload as MarketCompetitorBrief };
    case 'ListingCopyVersion':
      return { type: 'ListingCopyVersion', payload: payload as ListingCopyVersion };
    case 'PublishDiff':
      return { type: 'PublishDiff', payload: payload as PublishDiff };
    case 'PublishReceipt':
      return { type: 'PublishReceipt', payload: payload as PublishReceipt };
    case 'MetricsSnapshot':
      return { type: 'MetricsSnapshot', payload: payload as MetricsSnapshot };
    case 'CampaignPlanDoc':
      return { type: 'CampaignPlanDoc', payload: payload as CampaignPlanDoc };
    case 'AdsStrategyBrief':
      return { type: 'AdsStrategyBrief', payload: payload as AdsStrategyBrief };
    case 'AdsReportDiagnosis':
      return { type: 'AdsReportDiagnosis', payload: payload as AdsReportDiagnosis };
    default:
      return null;
  }
}

export function parseWorkshopArtifacts(rows: WorkshopArtifactView[]): ParsedWorkshopArtifact[] {
  return rows.map((row) => {
    const typeName = KNOWN_TYPES.has(row.name) ? row.name : row.name;
    const parsed = tryParseJson(row.content ?? null);
    const envelope = asEnvelope(typeName, parsed);
    return {
      id: row.id,
      taskId: row.task_id,
      typeName,
      typeLabel: deliverableTypeLabel(typeName),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      envelope,
      rawContent: row.content ?? null,
      parseError:
        row.storage_type === 'db' && row.content && !envelope && parsed == null
          ? '交付物内容无法解析'
          : row.storage_type === 'db' && !row.content
            ? '交付物内容为空'
            : null,
    };
  });
}

export function findPublishDiffs(artifacts: ParsedWorkshopArtifact[]): PublishDiff[] {
  return artifacts
    .filter((item) => item.envelope?.type === 'PublishDiff')
    .map((item) => item.envelope!.payload as PublishDiff);
}

export function findPublishReceipts(artifacts: ParsedWorkshopArtifact[]): PublishReceipt[] {
  return artifacts
    .filter((item) => item.envelope?.type === 'PublishReceipt')
    .map((item) => item.envelope!.payload as PublishReceipt);
}
