import { LogoutOutlined, UserOutlined } from '@ant-design/icons';
import { Avatar, Dropdown } from 'antd';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { logout } from '../../api/auth';
import { useUser } from '../../contexts/UserContext';

const navItems: { key: string; to: string; label: string; disabled?: boolean }[] = [
  { key: 'projects', to: '/projects', label: '项目' },
  { key: 'generate', to: '/generate', label: '创作' },
  { key: 'chat', to: '/chat', label: 'Agent' },
  { key: 'assets', to: '/assets', label: '素材' },
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
  const mainRouteKey = isCanvasEditorRoute ? 'canvas' : (location.pathname.split('/')[1] ?? 'projects');

  return (
    <div className={`studio-shell${isCanvasEditorRoute ? ' studio-shell--canvas' : ''}`}>
      <header className="studio-topbar">
        <div className="studio-topbar__left">
          <NavLink to="/projects" className="studio-brand">
            <img src="/logo.png" alt="" className="studio-brand__mark" />
            <span className="studio-brand__text">Dream Drama</span>
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
          <Dropdown
            menu={{
              items: [
                {
                  key: 'account',
                  icon: <UserOutlined />,
                  label: user?.username || '当前用户',
                  disabled: true,
                },
                { type: 'divider' },
                {
                  key: 'logout',
                  icon: <LogoutOutlined />,
                  label: '退出登录',
                  onClick: () => void handleLogout(),
                },
              ],
            }}
            trigger={['click']}
          >
            <button type="button" className="studio-user">
              <Avatar size={28} style={{ background: '#F0B35B', color: '#1A140C' }}>
                {user?.username?.[0]?.toUpperCase()}
              </Avatar>
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
