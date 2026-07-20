import { BellOutlined, DownOutlined, QuestionCircleOutlined, SearchOutlined } from '@ant-design/icons';
import { Avatar, Dropdown } from 'antd';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { logout } from '../../api/auth';
import { useUser } from '../../contexts/UserContext';

const navItems: { key: string; to: string; label: string; disabled?: boolean }[] = [
  { key: 'chat', to: '/chat', label: '对话' },
  { key: 'generate', to: '/generate', label: '创作' },
  { key: 'canvas', to: '/projects', label: '画布' },
  { key: 'assets', to: '/assets', label: '资产' },
];

export function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useUser();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const isCanvasEditorRoute = /\/projects\/\d+\/canvas/.test(location.pathname);
  const mainRouteKey = isCanvasEditorRoute ? 'canvas' : (location.pathname.split('/')[1] ?? 'chat');

  return (
    <div className={`studio-shell${isCanvasEditorRoute ? ' studio-shell--canvas' : ''}`}>
      <header className="studio-topbar">
        <div className="studio-topbar__left">
          <NavLink to="/chat" className="studio-brand">
            <img src="/logo.png" alt="" className="studio-brand__mark" />
            <span className="studio-brand__text">Nexus Studio</span>
          </NavLink>

          <nav className="studio-nav" aria-label="主导航">
            {navItems.map((item) =>
              item.disabled ? (
                <span
                  key={item.key}
                  className="studio-nav__item studio-nav__item--disabled"
                  aria-disabled="true"
                  title={`${item.label} 暂不可用`}
                >
                  {item.label}
                </span>
              ) : (
                <NavLink
                  key={item.key}
                  to={item.to}
                  className={({ isActive }) =>
                    `studio-nav__item${isActive ? ' studio-nav__item--active' : ''}`
                  }
                >
                  {item.label}
                </NavLink>
              ),
            )}
          </nav>
        </div>

        <div className="studio-topbar__right">
          <button type="button" className="studio-topbar__workspace">
            默认工作区
            <DownOutlined style={{ fontSize: 11 }} />
          </button>

          <div style={{ width: 1, height: 20, background: 'var(--studio-border)', margin: '0 4px' }} />

          <button type="button" className="studio-topbar__icon-btn" aria-label="搜索">
            <SearchOutlined />
          </button>
          <button type="button" className="studio-topbar__icon-btn" aria-label="通知">
            <BellOutlined />
          </button>
          <button type="button" className="studio-topbar__icon-btn" aria-label="帮助">
            <QuestionCircleOutlined />
          </button>

          <Dropdown
            menu={{
              items: [
                { key: 'logout', label: '退出登录', onClick: () => void handleLogout() },
              ],
            }}
            trigger={['click']}
          >
            <button type="button" className="studio-user">
              <Avatar size={28} style={{ background: 'linear-gradient(135deg, #0693F9, #744DF4)' }}>
                {user?.username?.[0]?.toUpperCase()}
              </Avatar>
              <span className="studio-user__name">{user?.username}</span>
            </button>
          </Dropdown>
        </div>
      </header>

      <main
        className={`studio-main studio-main--${mainRouteKey}`}
        data-route={mainRouteKey}
      >
        <Outlet />
      </main>
    </div>
  );
}
