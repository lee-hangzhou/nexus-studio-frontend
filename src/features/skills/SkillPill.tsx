import { CloseOutlined } from '@ant-design/icons';

import styles from './SkillPill.module.css';

export type SkillPillProps = {
  path: string;
  onRemove?: () => void;
  readOnly?: boolean;
};

export function SkillPill({ path, onRemove, readOnly = false }: SkillPillProps) {
  const label = path.split('/').pop() || path;
  return (
    <span className={styles.pill} title={path}>
      <span className={styles.label}>{label}</span>
      {!readOnly && onRemove ? (
        <button
          type="button"
          className={styles.remove}
          onClick={onRemove}
          aria-label={`移除技能 ${label}`}
        >
          <CloseOutlined aria-hidden />
        </button>
      ) : null}
    </span>
  );
}
