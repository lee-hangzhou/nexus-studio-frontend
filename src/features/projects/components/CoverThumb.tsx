import { useEffect, useState } from 'react';
import type { CoverView } from '../../../api/projects';
import { projectAccentIndex } from '../projectAccent';
import styles from './CoverThumb.module.css';

type Props = {
  id: number;
  cover?: CoverView | null;
  className: string;
};

/** Decorative thumb; callers must provide a visible title nearby for a11y. */
export function CoverThumb({ id, cover, className }: Props) {
  const [failed, setFailed] = useState(false);
  const coverKey = cover?.url ?? cover?.asset_id ?? null;

  useEffect(() => {
    setFailed(false);
  }, [coverKey]);

  const showCover = cover?.url && !failed;
  const accentIndex = projectAccentIndex(id);

  if (showCover && cover.asset_type === 'video') {
    return (
      <span className={className} aria-hidden="true">
        <video
          className={styles.media}
          src={cover.url}
          muted
          playsInline
          preload="metadata"
          onError={() => setFailed(true)}
        />
      </span>
    );
  }

  if (showCover) {
    return (
      <span className={className} aria-hidden="true">
        <img className={styles.media} src={cover.url} alt="" loading="lazy" onError={() => setFailed(true)} />
      </span>
    );
  }

  return <span className={`${className} ${styles.root}`} data-accent={accentIndex} aria-hidden="true" />;
}
