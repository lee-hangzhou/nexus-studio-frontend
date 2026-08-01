import { Button, Result, Spin, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getCreditBalance } from '../../../api/billing';

type SuccessView =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'confirmed'; balance: number };

export function BillingSuccessPage() {
  const [view, setView] = useState<SuccessView>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        // 支付确认可能滞后于跳转；短暂轮询余额供用户观察
        let latest = 0;
        for (let i = 0; i < 5; i += 1) {
          const res = await getCreditBalance();
          if (cancelled) return;
          latest = res.balance;
          if (i < 4) {
            await new Promise((r) => setTimeout(r, 1200));
          }
        }
        if (!cancelled) {
          setView({ kind: 'confirmed', balance: latest });
        }
      } catch (err) {
        if (!cancelled) {
          setView({
            kind: 'error',
            message: err instanceof Error ? err.message : '暂时无法读取余额',
          });
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  if (view.kind === 'loading') {
    return (
      <div className="billing-page billing-page--loading">
        <Spin tip="支付结果确认中…" />
      </div>
    );
  }

  if (view.kind === 'error') {
    return (
      <Result
        status="warning"
        title="支付结果确认中"
        subTitle={`${view.message}。请稍后在购买页查看；到账通常需要几分钟。`}
        extra={
          <Link to="/billing">
            <Button type="primary">返回购买页</Button>
          </Link>
        }
      />
    );
  }

  return (
    <Result
      status="info"
      title="支付结果确认中"
      subTitle={
        <Typography.Text>
          当前余额：<strong>{view.balance}</strong> 积分。到账可能有短暂延迟，可返回购买页稍后查看或刷新本页。
        </Typography.Text>
      }
      extra={
        <Link to="/billing">
          <Button type="primary">返回购买页</Button>
        </Link>
      }
    />
  );
}
