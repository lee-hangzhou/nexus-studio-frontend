import type { ReactNode } from 'react';

export function PageScaffold(props: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  /** 沉浸式：不显示页头，内容占满工作区 */
  immersive?: boolean;
  className?: string;
}) {
  const { title, description, actions, children, immersive, className } = props;

  if (immersive) {
    return <div className={`studio-page studio-page--immersive ${className ?? ''}`}>{children}</div>;
  }

  return (
    <div className={`studio-page ${className ?? ''}`}>
      {(title || actions || description) && (
        <header className="studio-page__head">
          <div className="studio-page__head-text">
            {title ? <h1 className="studio-page__title">{title}</h1> : null}
            {description ? <p className="studio-page__desc">{description}</p> : null}
          </div>
          {actions ? <div className="studio-page__actions">{actions}</div> : null}
        </header>
      )}

      <div className="studio-page__body">{children}</div>
    </div>
  );
}
