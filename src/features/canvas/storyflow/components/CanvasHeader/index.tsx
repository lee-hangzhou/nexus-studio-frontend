import { ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import '../../styles/Header.less';

export function CanvasHeader({
  projectId,
  projectName,
  busy,
  onStop,
}: {
  projectId: number;
  projectName?: string;
  busy: boolean;
  onStop: () => void;
}) {
  const navigate = useNavigate();

  return (
    <div className="workflow-canvas-header">
      <div className="workflow-canvas-header__content">
        <button
          type="button"
          className="workflow-canvas-header__back-button"
          aria-label="返回"
          onClick={() => navigate('/projects')}
        >
          <ArrowLeftOutlined />
          <span>项目列表</span>
        </button>
        <span className="workflow-canvas-header__slash">/</span>
        <span className="workflow-canvas-header__episode-name">
          {projectName?.trim() || `项目 #${projectId}`}
        </span>
        {busy ? (
          <button
            type="button"
            className="workflow-canvas-header__back-button"
            style={{ marginLeft: 'auto' }}
            onClick={onStop}
          >
            停止
          </button>
        ) : null}
      </div>
    </div>
  );
}
