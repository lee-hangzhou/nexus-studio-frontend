import { Alert, Button, Spin, Typography, message } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import {
  createCheckout,
  getCreditBalance,
  listCreditPacks,
  type CreditPack,
  type CreditPackKey,
} from '../../../api/billing';
import { useUser } from '../../../contexts/UserContext';
import { loginUrl } from '../../../shared/utils/authGate';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  formatCreditsPerUsdFootnote,
  formatPackUsd,
  isRecommendedPack,
} from '../packDisplay';

export function BillingPage() {
  const { user } = useUser();
  const location = useLocation();
  const navigate = useNavigate();
  const [packs, setPacks] = useState<CreditPack[]>([]);
  const [creditsPerUsd, setCreditsPerUsd] = useState<number | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<CreditPackKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setBalanceError(null);
    try {
      const packRes = await listCreditPacks();
      setPacks(packRes.packs);
      setCreditsPerUsd(packRes.credits_per_usd);
      if (user) {
        try {
          const bal = await getCreditBalance();
          setBalance(bal.balance);
        } catch (err) {
          setBalance(null);
          setBalanceError(err instanceof Error ? err.message : '余额加载失败');
        }
      } else {
        setBalance(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败，请稍后重试');
      setPacks([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const onBuy = async (packKey: CreditPackKey) => {
    if (!user) {
      navigate(loginUrl(`${location.pathname}${location.search}`));
      return;
    }
    setBuying(packKey);
    try {
      const session = await createCheckout(packKey);
      window.location.assign(session.checkout_url);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '无法开始支付，请稍后重试');
      setBuying(null);
    }
  };

  if (loading) {
    return (
      <div className="billing-page billing-page--loading">
        <Spin />
      </div>
    );
  }

  return (
    <div className="billing-page">
      <header className="billing-page__header">
        <Typography.Title level={1} className="billing-page__title">
          购买积分
        </Typography.Title>
        <Typography.Paragraph className="billing-page__lead">
          一次性套餐，按需补充创作额度
        </Typography.Paragraph>
        {user ? (
          <div className="billing-page__balance" aria-live="polite">
            <span className="billing-page__balance-label">当前余额</span>
            {balanceError ? (
              <div className="billing-page__balance-error">
                <span>{balanceError}</span>
                <Button type="link" size="small" onClick={() => void load()}>
                  重试
                </Button>
              </div>
            ) : (
              <span className="billing-page__balance-value">
                {balance === null ? '—' : balance}
                <span className="billing-page__balance-unit">积分</span>
              </span>
            )}
          </div>
        ) : (
          <p className="billing-page__login-hint">登录后可查看余额并购买</p>
        )}
      </header>

      {error ? (
        <Alert
          className="billing-page__error"
          type="error"
          showIcon
          message={error}
          action={
            <Button size="small" onClick={() => void load()}>
              重试
            </Button>
          }
        />
      ) : null}

      {!error && packs.length === 0 ? (
        <div className="billing-page__empty">
          <p>暂无可用套餐</p>
          <Button onClick={() => void load()}>刷新</Button>
        </div>
      ) : null}

      {packs.length > 0 ? (
        <div className="billing-page__grid">
          {packs.map((pack) => {
            const recommended = isRecommendedPack(pack.key);
            return (
              <article
                key={pack.key}
                className={recommended ? 'billing-pack billing-pack--recommended' : 'billing-pack'}
              >
                {recommended ? <span className="billing-pack__badge">推荐</span> : null}
                <h2 className="billing-pack__credits">{pack.credits} 积分</h2>
                <p className="billing-pack__price">{formatPackUsd(pack.price_usd_cents)}</p>
                <Button
                  type={recommended ? 'primary' : 'default'}
                  block
                  disabled={!pack.available || buying !== null}
                  loading={buying === pack.key}
                  onClick={() => void onBuy(pack.key)}
                >
                  {pack.available ? '立即购买' : '暂未开放'}
                </Button>
              </article>
            );
          })}
        </div>
      ) : null}

      {creditsPerUsd !== null ? (
        <p className="billing-page__footnote">{formatCreditsPerUsdFootnote(creditsPerUsd)}</p>
      ) : null}
    </div>
  );
}
