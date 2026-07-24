import { useNavigate } from 'react-router-dom';
import '../../styles/Header.less';

export function CanvasHeader({
  projectId,
  projectName,
  busy,
}: {
  projectId: number;
  projectName?: string;
  busy: boolean;
}) {
  const navigate = useNavigate();
  const title = projectName?.trim() || `画布 #${projectId}`;

  return (
    <header className="workflow-canvas-header">
      <div className="workflow-canvas-header__content">
        <div className="workflow-canvas-header__left">
          <nav className="workflow-canvas-header__crumb" aria-label="画布路径">
            <button
              type="button"
              className="workflow-canvas-header__back-button"
              onClick={() => navigate('/')}
            >
              ← Home
            </button>
            <span className="workflow-canvas-header__sep" aria-hidden>
              /
            </span>
            <strong className="workflow-canvas-header__title" title={title}>
              {title}
            </strong>
            <span className="workflow-canvas-header__sep" aria-hidden>
              ·
            </span>
            <span className="workflow-canvas-header__surface">画布</span>
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
