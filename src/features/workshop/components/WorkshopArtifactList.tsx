import { DownloadOutlined } from '@ant-design/icons';
import { Typography } from 'antd';

import type { WorkshopArtifactView } from '../../../api/workshop';
import styles from './WorkshopArtifactList.module.css';

function formatBytes(size: number | null | undefined): string {
  if (size == null || size < 0) return '—';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function storageLabel(storageType: WorkshopArtifactView['storage_type']): string {
  if (storageType === 'oss') return '文件';
  if (storageType === 'filesystem') return '本地暂存';
  return '结构化';
}

/** 工坊产物清单：按服务端返回原样展示，不做业务类型白名单过滤 */
export function WorkshopArtifactList(props: { artifacts: WorkshopArtifactView[] }) {
  if (props.artifacts.length === 0) {
    return <Typography.Text type="secondary">暂无产物</Typography.Text>;
  }

  const items = props.artifacts
    .slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  return (
    <ul className={styles.list}>
      {items.map((artifact) => {
        const url = artifact.download_url?.trim() || null;
        return (
          <li key={artifact.id} className={styles.row}>
            <div className={styles.main}>
              <span className={styles.name} title={artifact.name}>
                {artifact.name}
              </span>
              <span className={styles.meta}>
                {storageLabel(artifact.storage_type)} · {formatBytes(artifact.size_bytes)} ·{' '}
                {formatTime(artifact.created_at)}
              </span>
            </div>
            {url ? (
              <a
                className={styles.download}
                href={url}
                target="_blank"
                rel="noreferrer"
                download={artifact.name}
                title={`下载 ${artifact.name}`}
                aria-label={`下载 ${artifact.name}`}
              >
                <DownloadOutlined />
              </a>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
