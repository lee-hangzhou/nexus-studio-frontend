import {
  AppstoreOutlined,
  CommentOutlined,
  FolderOpenOutlined,
  HomeOutlined,
  LogoutOutlined,
  PictureOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Avatar, Dropdown } from 'antd';
import type { ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { logout } from '../../api/auth';
import { useUser } from '../../contexts/UserContext';
import { loginUrl } from '../../shared/utils/authGate';

const workspaceNav: { key: string; to: string; label: string; end?: boolean; icon: ReactNode }[] = [
  { key: 'home', to: '/', label: '首页', end: true, icon: <HomeOutlined /> },
  { key: 'generate', to: '/generate', label: '创作', icon: <PictureOutlined /> },
  { key: 'projects', to: '/projects', label: '画布', icon: <AppstoreOutlined /> },
  { key: 'chat', to: '/chat', label: '超级工坊', icon: <CommentOutlined /> },
  { key: 'assets', to: '/assets', label: '资源', icon: <FolderOpenOutlined /> },
];

export function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useUser();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const isCanvasEditorRoute = /\/projects\/\d+\/episodes\/\d+/.test(location.pathname);
  const isFoyerRoute = location.pathname === '/';
  const mainRouteKey = isCanvasEditorRoute
    ? 'canvas'
    : isFoyerRoute
      ? 'home'
      : (location.pathname.split('/')[1] ?? 'home');

  const shellMode = isCanvasEditorRoute ? 'canvas' : 'workspace';

  const userMenu = user ? (
    <Dropdown
      menu={{
        items: [
          {
            key: 'account',
            icon: <UserOutlined />,
            label: user.username || '当前用户',
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
      <button type="button" className="studio-user" aria-label="用户菜单">
        <Avatar size={28} className="studio-user__avatar">
          {user.username?.[0]?.toUpperCase()}
        </Avatar>
      </button>
    </Dropdown>
  ) : (
    <Link
      to={loginUrl(`${location.pathname}${location.search}`)}
      className="studio-user studio-user--login"
      aria-label="登录"
    >
      登录
    </Link>
  );

  return (
    <div className={`studio-shell studio-shell--${shellMode}`}>
      {!isCanvasEditorRoute ? (
        <aside className="studio-rail" aria-label="工作导航">
          <NavLink to="/" className="studio-rail__brand" title="Nexus Studio" end>
            <img src="/logo.png" alt="" className="studio-brand__mark" />
          </NavLink>

          <nav className="studio-rail__nav">
            {workspaceNav.map((item) => (
              <NavLink
                key={item.key}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `studio-rail__item${isActive ? ' studio-rail__item--active' : ''}`
                }
                title={item.label}
              >
                <span className="studio-rail__icon" aria-hidden>
                  {item.icon}
                </span>
                <span className="studio-rail__label">{item.label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="studio-rail__footer">{userMenu}</div>
        </aside>
      ) : null}

      <main
        className={`studio-main studio-main--${mainRouteKey}`}
        data-route={mainRouteKey}
      >
        <Outlet />
      </main>
    </div>
  );
}
