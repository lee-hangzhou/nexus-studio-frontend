import { Button, Result, Spin } from 'antd';
import type { ReactNode } from 'react';

export type StateKind = 'loading' | 'empty' | 'error' | 'forbidden';

export function StateView(props: {
  kind: StateKind;
  title?: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  const { kind, title, subtitle, action } = props;

  if (kind === 'loading') {
    return (
      <div style={{ padding: 24, display: 'flex', justifyContent: 'center' }}>
        <Spin />
      </div>
    );
  }

  if (kind === 'empty') {
    return (
      <Result
        status="info"
        title={title ?? '暂无内容'}
        subTitle={subtitle}
        extra={action ?? <Button type="primary">创建</Button>}
      />
    );
  }

  if (kind === 'forbidden') {
    return <Result status="403" title={title ?? '无权限'} subTitle={subtitle} extra={action} />;
  }

  return <Result status="error" title={title ?? '出错了'} subTitle={subtitle} extra={action} />;
}

