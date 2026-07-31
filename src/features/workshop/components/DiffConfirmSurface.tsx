import { Alert, Button, Checkbox, List, Space, Typography, message } from 'antd';
import { useEffect, useState } from 'react';
import { summarizePublishChanges } from '../utils/diffConfirm';
import { publishOperationLabel } from '../utils/displayLabels';
import type { PublishDiff, PublishReceipt } from '../types';
import styles from './DiffConfirmSurface.module.css';

export function DiffConfirmSurface(props: {
  diff: PublishDiff;
  proposingExpertName?: string | null;
  hostReviewNote?: string | null;
  onConfirm?: (payloadHash: string) => void | Promise<void>;
  confirmBusy?: boolean;
}) {
  const { diff, proposingExpertName, hostReviewNote, onConfirm, confirmBusy } = props;
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const changes = summarizePublishChanges(diff);

  useEffect(() => {
    setConfirmed(false);
  }, [diff.payload_hash]);

  const handleConfirm = async () => {
    if (!confirmed || !onConfirm) return;
    setBusy(true);
    try {
      await onConfirm(diff.payload_hash);
      message.success('已确认，操作可以执行');
    } catch (err) {
      message.error(err instanceof Error ? err.message : '确认失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={styles.root} aria-label="写操作确认">
      <Typography.Title level={5}>确认店铺操作</Typography.Title>
      <Typography.Paragraph type="secondary">
        即将{publishOperationLabel(diff.operation)}
      </Typography.Paragraph>
      {proposingExpertName ? (
        <Typography.Paragraph type="secondary">负责执行：{proposingExpertName}</Typography.Paragraph>
      ) : null}
      {hostReviewNote ? (
        <Typography.Paragraph type="secondary">{hostReviewNote}</Typography.Paragraph>
      ) : null}

      <List
        size="small"
        bordered
        dataSource={changes}
        renderItem={(change) => (
          <List.Item>
            <Space direction="vertical" size={0}>
              <Typography.Text strong>{change.path}</Typography.Text>
              <Typography.Text type="secondary">原内容：{change.before}</Typography.Text>
              <Typography.Text>新内容：{change.after}</Typography.Text>
            </Space>
          </List.Item>
        )}
      />

      {(diff.warnings?.length ?? 0) > 0 ? (
        <Alert type="warning" showIcon message={(diff.warnings ?? []).join('；')} />
      ) : null}

      <div className={styles.confirmRow}>
        <Checkbox checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)}>
          我已核对以上变更
        </Checkbox>
        <Button
          type="primary"
          size="small"
          disabled={!confirmed}
          loading={busy || confirmBusy}
          className={styles.confirmBtn}
          onClick={() => void handleConfirm()}
        >
          确认执行
        </Button>
      </div>
    </section>
  );
}

export function DiffConfirmEmpty() {
  return <Typography.Text type="secondary">暂无待确认操作</Typography.Text>;
}

export function PublishReceiptList(props: { receipts: PublishReceipt[] }) {
  if (props.receipts.length === 0) return null;
  return (
    <section className={styles.root} aria-label="店铺操作记录">
      <Typography.Title level={5}>店铺操作记录</Typography.Title>
      <List
        size="small"
        bordered
        dataSource={props.receipts}
        renderItem={(receipt) => (
          <List.Item>
            商品 {receipt.platform_item_id}：
            {receipt.status === 'success'
              ? '执行成功'
              : receipt.status === 'failed'
                ? '执行失败'
                : '已记录'}
          </List.Item>
        )}
      />
    </section>
  );
}
