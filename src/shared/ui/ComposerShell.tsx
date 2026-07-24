import type { ReactNode, Ref } from 'react';

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export type ComposerShellProps = {
  top?: ReactNode;
  notice?: ReactNode;
  input: ReactNode;
  footerLeft?: ReactNode;
  footerRight?: ReactNode;
  className?: string;
  boxRef?: Ref<HTMLDivElement>;
};

/**
 * 统一输入壳：顶栏 / 输入 / 底栏。
 * 创作、超级工坊、画布 Agent 共用，禁止各页再画一套外框。
 */
export function ComposerShell({
  top,
  notice,
  input,
  footerLeft,
  footerRight,
  className,
  boxRef,
}: ComposerShellProps) {
  const hasFooter = footerLeft != null || footerRight != null;

  return (
    <div ref={boxRef} className={cx('studio-composer-box', className)}>
      {notice ?? null}
      {top ?? null}
      <div className="studio-composer-box__input">{input}</div>
      {hasFooter ? (
        <div className="studio-composer-box__footer">
          <div className="studio-composer-box__footer-left">{footerLeft}</div>
          {footerRight != null ? (
            <div className="studio-composer-box__footer-right">{footerRight}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
