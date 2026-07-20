import type { ReactNode } from 'react';

export function StudioSurface(props: {
  children: ReactNode;
  className?: string;
  padding?: 'none' | 'md' | 'lg';
}) {
  const { children, className, padding = 'md' } = props;
  return (
    <div className={`studio-surface studio-surface--pad-${padding} ${className ?? ''}`}>{children}</div>
  );
}
