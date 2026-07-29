import type { ReactNode } from 'react';

interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  links?: ReactNode;
}

export function AuthLayout({ title, subtitle, children, links }: AuthLayoutProps) {
  return (
    <div className="auth-page">
      <aside className="auth-hero" aria-hidden="true">
        <img className="auth-hero__image" src="/auth-hero.png" alt="" />
        <div className="auth-hero__veil" />
        <div className="auth-hero__copy">
          <div className="auth-hero__brand">
            <img src="/logo.png" alt="" className="auth-hero__mark" />
            <span>Nexus Studio</span>
          </div>
          <h1 className="auth-hero__title">点亮你的想法</h1>
          <p className="auth-hero__lead">从灵感到现实，AI 与你一起创造无限可能</p>
        </div>
      </aside>

      <div className="auth-panel">
        <div className="auth-card">
          <header className="auth-form-header">
            <h2>{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </header>
          <div className="auth-form-body">{children}</div>
          {links ? <div className="auth-links">{links}</div> : null}
        </div>
      </div>
    </div>
  );
}
