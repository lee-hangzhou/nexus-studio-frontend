import type { CSSProperties } from 'react';
import type { GenerateFeedItem } from '../types';

interface CreateThumbProps {
  item: GenerateFeedItem;
  active?: boolean;
  compact?: boolean;
  onClick: () => void;
}

export function CreateThumb({ item, active = false, compact = false, onClick }: CreateThumbProps) {
  const pending = item.status === 'pending' || item.status === 'running';
  const failed = item.status === 'failed';
  const stateBg = pending
    ? 'url(/generate_pending_state.png)'
    : failed
      ? 'url(/generate_failed_state.png)'
      : undefined;

  return (
    <button
      type="button"
      className={[
        'studio-create__thumb',
        active ? 'studio-create__thumb--active' : '',
        compact ? 'studio-create__thumb--compact' : '',
        item.favorite ? 'studio-create__thumb--pinned' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={onClick}
      title={item.prompt}
      aria-label={item.prompt}
    >
      <span
        className={`studio-create__thumb-preview${stateBg ? ' studio-create__thumb-preview--state' : ''}${pending ? ' studio-create__thumb-preview--pending' : ''}`}
        data-kind={item.kind}
        style={{
          '--thumb-hue': `${item.id.charCodeAt(1) % 360}`,
          backgroundImage: stateBg,
          backgroundSize: stateBg ? 'cover' : undefined,
          backgroundPosition: stateBg ? 'center' : undefined,
        } as CSSProperties}
      />
      {item.favorite ? <span className="studio-create__thumb-pin" aria-label="已置顶" /> : null}
      {pending ? <span className="studio-create__thumb-badge studio-create__thumb-badge--live" /> : null}
      {failed ? <span className="studio-create__thumb-badge studio-create__thumb-badge--fail" /> : null}
    </button>
  );
}
