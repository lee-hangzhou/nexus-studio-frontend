import {
  ApartmentOutlined,
  AppstoreOutlined,
  MessageOutlined,
  PictureOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import type { ReactNode } from 'react';

interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  links?: ReactNode;
}

const FEATURE_TAGS = [
  { icon: <MessageOutlined />, label: 'AI 对话' },
  { icon: <PictureOutlined />, label: '图像生成' },
  { icon: <VideoCameraOutlined />, label: '视频生成' },
  { icon: <AppstoreOutlined />, label: '智能体画布' },
  { icon: <ApartmentOutlined />, label: '工作流编排' },
];

export function AuthLayout({ title, subtitle, children, links }: AuthLayoutProps) {
  return (
    <div className="auth-page">
      {/* 背景舞台：与 background cover 等比，承载背景图，让叠加文案锚定到图内坐标 */}
      <div className="auth-bg-stage" aria-hidden="true">
        {/* 品牌区：锚定在背景图中 logo 的下方，随背景图一起缩放/位移 */}
        <div className="auth-brand-area">
          <p className="auth-brand-slogan">让文本、图像、视频与智能体协同创作</p>
          <div className="auth-brand-tags">
            {FEATURE_TAGS.map((tag) => (
              <span key={tag.label} className="auth-brand-tag">
                {tag.icon}
                {tag.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* 右侧登录卡 */}
      <div className="auth-card">
        <header className="auth-form-header">
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </header>
        <div className="auth-form-body">{children}</div>
        {links ? <div className="auth-links">{links}</div> : null}
      </div>
    </div>
  );
}
