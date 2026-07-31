import { Alert, Empty, List, Typography } from 'antd';
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
import { formatMetricDisplay } from '../utils/metricDisplay';
import { publishOperationLabel } from '../utils/displayLabels';
import { summarizePublishChanges } from '../utils/diffConfirm';
import styles from './ArtifactCards.module.css';

function BaseMeta(props: { label: string; value: string }) {
  return (
    <div className={styles.metaRow}>
      <span className={styles.metaLabel}>{props.label}</span>
      <span>{props.value}</span>
    </div>
  );
}

function formatMoneyFen(value: number): string {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
  }).format(value / 100);
}

function formatDiagnosis(item: unknown): string {
  if (typeof item === 'string') return item;
  if (item && typeof item === 'object') {
    return Object.values(item)
      .filter((value): value is string | number => typeof value === 'string' || typeof value === 'number')
      .join('：');
  }
  return String(item);
}

export function MarketCompetitorBriefCard(props: { data: MarketCompetitorBrief }) {
  const { data } = props;
  return (
    <article className={styles.card} aria-label="竞品研究简报">
      <Typography.Title level={5}>竞品研究简报</Typography.Title>
      <BaseMeta label="问题" value={data.question} />
      <BaseMeta label="市场范围" value={data.market_scope} />
      <List
        size="small"
        header="发现"
        dataSource={data.findings}
        renderItem={(item) => <List.Item>{item}</List.Item>}
      />
      <List
        size="small"
        header="风险"
        dataSource={data.risks}
        renderItem={(item) => <List.Item>{item}</List.Item>}
      />
    </article>
  );
}

export function ListingCopyVersionCard(props: { data: ListingCopyVersion }) {
  const { data } = props;
  return (
    <article className={styles.card} aria-label="商品文案">
      <Typography.Title level={5}>商品文案（第 {data.version} 版）</Typography.Title>
      <BaseMeta label="商品规格" value={data.sku_id} />
      <BaseMeta label="标题" value={data.title} />
      <BaseMeta label="平台" value={data.platform === 'tmall' ? '天猫' : '淘宝'} />
      <List
        size="small"
        header="卖点"
        dataSource={data.selling_points}
        renderItem={(item) => <List.Item>{item}</List.Item>}
      />
    </article>
  );
}

export function CampaignPlanCard(props: { data: CampaignPlanDoc }) {
  const { data } = props;
  return (
    <article className={styles.card} aria-label="营销方案">
      <Typography.Title level={5}>营销方案</Typography.Title>
      <BaseMeta label="名称" value={data.name || '未命名方案'} />
      {data.budget_amount_fen != null ? (
        <BaseMeta label="预算" value={formatMoneyFen(data.budget_amount_fen)} />
      ) : null}
    </article>
  );
}

export function AdsStrategyCard(props: { data: AdsStrategyBrief }) {
  const { data } = props;
  return (
    <article className={styles.card} aria-label="广告策略简报">
      <Typography.Title level={5}>广告策略简报</Typography.Title>
      <BaseMeta label="目标" value={data.objective || '策略建议'} />
    </article>
  );
}

export function AdsDiagnosisCard(props: { data: AdsReportDiagnosis }) {
  const { data } = props;
  return (
    <article className={styles.card} aria-label="广告诊断">
      <Typography.Title level={5}>广告诊断</Typography.Title>
      <List
        size="small"
        header="诊断结论"
        dataSource={data.diagnoses ?? []}
        locale={{ emptyText: '暂无诊断条目' }}
        renderItem={(item) => (
          <List.Item>{formatDiagnosis(item)}</List.Item>
        )}
      />
    </article>
  );
}

export function PublishDiffCard(props: { data: PublishDiff }) {
  const { data } = props;
  const changes = summarizePublishChanges(data);
  return (
    <article className={styles.card} aria-label="待确认的店铺操作">
      <Typography.Title level={5}>{publishOperationLabel(data.operation)}</Typography.Title>
      <List
        size="small"
        header="变更"
        dataSource={changes}
        renderItem={(change) => (
          <List.Item>
            {change.path}：{change.before} → {change.after}
          </List.Item>
        )}
      />
    </article>
  );
}

export function PublishReceiptCard(props: { data: PublishReceipt }) {
  const { data } = props;
  return (
    <article className={styles.card} aria-label="店铺操作结果">
      <Typography.Title level={5}>店铺操作结果</Typography.Title>
      <BaseMeta label="状态" value={data.status === 'success' ? '执行成功' : data.status} />
      <BaseMeta label="商品 ID" value={data.platform_item_id} />
    </article>
  );
}

export function MetricsSnapshotCard(props: { data: MetricsSnapshot }) {
  const { data } = props;
  return (
    <article className={styles.card} aria-label="经营指标快照">
      <Typography.Title level={5}>经营指标 · {data.period}</Typography.Title>
      <List
        size="small"
        header="指标"
        dataSource={data.metrics}
        renderItem={(metric) => (
          <List.Item>
            {metric.name}:{' '}
            {formatMetricDisplay({
              value: metric.value,
              unit: metric.unit,
              unavailable_reason: metric.unavailable_reason,
            })}
          </List.Item>
        )}
      />
      {(data.data_quality_issues?.length ?? 0) > 0 ? (
        <Alert
          type="warning"
          showIcon
          message="数据质量问题"
          description={(data.data_quality_issues ?? []).join('；')}
        />
      ) : null}
    </article>
  );
}

export function ArtifactCards(props: { artifacts: EcommerceArtifactEnvelope[] }) {
  if (props.artifacts.length === 0) {
    return <Empty description="暂无任务交付物" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }

  return (
    <div className={styles.grid}>
      {props.artifacts.map((artifact, index) => {
        switch (artifact.type) {
          case 'MarketCompetitorBrief':
            return (
              <MarketCompetitorBriefCard
                key={`brief-${index}`}
                data={artifact.payload as MarketCompetitorBrief}
              />
            );
          case 'ListingCopyVersion':
            return (
              <ListingCopyVersionCard
                key={`listing-${index}`}
                data={artifact.payload as ListingCopyVersion}
              />
            );
          case 'CampaignPlanDoc':
            return (
              <CampaignPlanCard
                key={`campaign-${index}`}
                data={artifact.payload as CampaignPlanDoc}
              />
            );
          case 'AdsStrategyBrief':
            return (
              <AdsStrategyCard
                key={`ads-strategy-${index}`}
                data={artifact.payload as AdsStrategyBrief}
              />
            );
          case 'AdsReportDiagnosis':
            return (
              <AdsDiagnosisCard
                key={`ads-diagnosis-${index}`}
                data={artifact.payload as AdsReportDiagnosis}
              />
            );
          case 'PublishDiff':
            return (
              <PublishDiffCard
                key={`diff-${index}`}
                data={artifact.payload as PublishDiff}
              />
            );
          case 'PublishReceipt':
            return (
              <PublishReceiptCard
                key={`receipt-${index}`}
                data={artifact.payload as PublishReceipt}
              />
            );
          case 'MetricsSnapshot':
            return (
              <MetricsSnapshotCard
                key={`metrics-${index}`}
                data={artifact.payload as MetricsSnapshot}
              />
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
