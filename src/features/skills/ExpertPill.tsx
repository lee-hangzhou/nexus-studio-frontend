import { CloseOutlined } from '@ant-design/icons';

import styles from './ExpertPill.module.css';

export type ExpertPillProps = {
  name: string;
  avatarUrl: string;
  prefix?: string;
  onRemove?: () => void;
  readOnly?: boolean;
};

export function ExpertPill({ name, avatarUrl, prefix, onRemove, readOnly = false }: ExpertPillProps) {
  return (
    <span className={styles.pill} title={prefix ? `${prefix}${name}` : name}>
      {prefix ? <span className={styles.prefix}>{prefix}</span> : null}
      <img className={styles.avatar} src={avatarUrl} alt="" aria-hidden />
      <span className={styles.label}>{name}</span>
      {!readOnly && onRemove ? (
        <button
          type="button"
          className={styles.remove}
          onClick={onRemove}
          aria-label={`移除专家 ${name}`}
        >
          <CloseOutlined aria-hidden />
        </button>
      ) : null}
    </span>
  );
}
