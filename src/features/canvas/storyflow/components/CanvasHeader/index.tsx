import { Dropdown } from 'antd';
import { useNavigate } from 'react-router-dom';
import { canvasDropdownProps } from '../../constants/canvasDropdown';
import '../../styles/Header.less';

export type CanvasHeaderEpisode = {
  id: number;
  name: string;
  episode_no: number;
};

export function CanvasHeader({
  projectId,
  episodeId,
  projectName,
  episodeName,
  episodes,
  busy,
}: {
  projectId: number;
  episodeId: number;
  projectName?: string;
  episodeName?: string;
  episodes: CanvasHeaderEpisode[];
  busy: boolean;
}) {
  const navigate = useNavigate();
  const goProject = () => navigate(`/projects/${projectId}`);
  const title = projectName?.trim() || '加载中…';
  const episodeTitle = episodeName?.trim() || '加载中…';
  const canSwitchEpisode = episodes.length > 0;

  const episodeItems = [...episodes]
    .sort((a, b) => a.episode_no - b.episode_no)
    .map((ep) => ({
      key: String(ep.id),
      label: ep.name?.trim() || `第 ${ep.episode_no} 集`,
      onClick: () => {
        if (ep.id === episodeId) return;
        navigate(`/projects/${projectId}/episodes/${ep.id}`);
      },
    }));

  return (
    <header className="workflow-canvas-header">
      <div className="workflow-canvas-header__content">
        <div className="workflow-canvas-header__left">
          <nav className="workflow-canvas-header__crumb" aria-label="画布路径">
            <button
              type="button"
              className="workflow-canvas-header__back-button"
              onClick={goProject}
            >
              ← 项目
            </button>
            <span className="workflow-canvas-header__sep" aria-hidden>
              /
            </span>
            <button
              type="button"
              className="workflow-canvas-header__crumb-link"
              title={title}
              onClick={goProject}
            >
              {title}
            </button>
            <span className="workflow-canvas-header__sep" aria-hidden>
              ·
            </span>
            <span className="workflow-canvas-header__surface">画布</span>
            <span className="workflow-canvas-header__sep" aria-hidden>
              /
            </span>
            {canSwitchEpisode ? (
              <Dropdown
                {...canvasDropdownProps({
                  items: episodeItems,
                  selectedKeys: [String(episodeId)],
                })}
                trigger={['click']}
                placement="bottomLeft"
              >
                <button
                  type="button"
                  className="workflow-canvas-header__episode-button"
                  title={episodeTitle}
                  aria-haspopup="listbox"
                  aria-label={`当前集：${episodeTitle}，点击切换`}
                >
                  <span className="workflow-canvas-header__current">{episodeTitle}</span>
                  <span className="workflow-canvas-header__caret" aria-hidden>
                    ▾
                  </span>
                </button>
              </Dropdown>
            ) : (
              <span
                className="workflow-canvas-header__current"
                title={episodeTitle}
                aria-current="page"
              >
                {episodeTitle}
              </span>
            )}
          </nav>
          {busy ? (
            <span className="workflow-canvas-header__live" aria-live="polite">
              <i aria-hidden />
              Agent 工作中
            </span>
          ) : null}
        </div>
      </div>
    </header>
  );
}
