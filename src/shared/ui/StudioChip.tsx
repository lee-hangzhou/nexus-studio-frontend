import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type StudioChipSize = 'sm' | 'md';

export type StudioChipProps = {
  children: ReactNode;
  active?: boolean;
  size?: StudioChipSize;
  icon?: ReactNode;
  className?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'className'>;

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/** 统一筛选 / 开关 chip：暗底描边，选中琥珀。 */
export function StudioChip({
  children,
  active = false,
  size = 'md',
  icon,
  className,
  type = 'button',
  ...rest
}: StudioChipProps) {
  return (
    <button
      type={type}
      className={cx(
        'studio-chip',
        size === 'sm' && 'studio-chip--sm',
        active && 'studio-chip--active',
        className,
      )}
      aria-pressed={rest['aria-pressed'] ?? active}
      {...rest}
    >
      {icon ? <span className="studio-chip__icon">{icon}</span> : null}
      {children}
    </button>
  );
}
