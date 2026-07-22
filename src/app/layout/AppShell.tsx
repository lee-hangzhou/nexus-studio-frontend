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
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { logout } from '../../api/auth';
import { useUser } from '../../contexts/UserContext';

const workspaceNav: { key: string; to: string; label: string; end?: boolean; icon: ReactNode }[] = [
  { key: 'home', to: '/', label: 'Home', end: true, icon: <HomeOutlined /> },
  { key: 'generate', to: '/generate', label: '创作', icon: <PictureOutlined /> },
  { key: 'projects', to: '/projects', label: '画布', icon: <AppstoreOutlined /> },
  { key: 'chat', to: '/chat', label: '对话', icon: <CommentOutlined /> },
  { key: 'assets', to: '/assets', label: '素材', icon: <FolderOpenOutlined /> },
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
  const isFoyerRoute = location.pathname === '/';
  const mainRouteKey = isCanvasEditorRoute
    ? 'canvas'
    : isFoyerRoute
      ? 'home'
      : (location.pathname.split('/')[1] ?? 'home');

  const shellMode = isFoyerRoute ? 'foyer' : isCanvasEditorRoute ? 'canvas' : 'workspace';

  const userMenu = (
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
      <button type="button" className="studio-user" aria-label="用户菜单">
        <Avatar size={28} className="studio-user__avatar">
          {user?.username?.[0]?.toUpperCase()}
        </Avatar>
      </button>
    </Dropdown>
  );

  return (
    <div className={`studio-shell studio-shell--${shellMode}`}>
      {isFoyerRoute ? (
        <header className="studio-topbar studio-topbar--foyer">
          <div className="studio-topbar__left">
            <NavLink to="/" className="studio-brand" end>
              <img src="/logo.png" alt="" className="studio-brand__mark" />
              <span className="studio-brand__text">Nexus Studio</span>
            </NavLink>
          </div>
          <div className="studio-topbar__right">
            <NavLink to="/assets" className="studio-topbar__link">
              素材库
            </NavLink>
            <NavLink to="/projects" className="studio-topbar__link">
              全部工作
            </NavLink>
            {userMenu}
          </div>
        </header>
      ) : null}

      {!isFoyerRoute && !isCanvasEditorRoute ? (
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
