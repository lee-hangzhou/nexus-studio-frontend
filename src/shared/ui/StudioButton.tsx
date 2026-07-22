import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type StudioButtonVariant = 'primary' | 'ghost' | 'text';
export type StudioButtonSize = 'sm' | 'md' | 'lg';

export type StudioButtonProps = {
  children: ReactNode;
  variant?: StudioButtonVariant;
  size?: StudioButtonSize;
  icon?: ReactNode;
  className?: string;
  block?: boolean;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'className'>;

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/** 统一动作按钮：primary 琥珀实心 / ghost 描边 / text 文字链。 */
export function StudioButton({
  children,
  variant = 'ghost',
  size = 'md',
  icon,
  className,
  block = false,
  type = 'button',
  ...rest
}: StudioButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        'studio-btn',
        `studio-btn--${variant}`,
        `studio-btn--${size}`,
        block && 'studio-btn--block',
        className,
      )}
      {...rest}
    >
      {icon ? <span className="studio-btn__icon">{icon}</span> : null}
      {children}
    </button>
  );
}
