import { Segmented } from 'antd';
import { useNavigate } from 'react-router-dom';

export function CanvasTopbar({
  projectId,
  mode,
  onModeChange,
  busy,
  onStop,
}: {
  projectId: number;
  mode: 'auto' | 'manual';
  onModeChange: (m: 'auto' | 'manual') => void;
  busy: boolean;
  onStop: () => void;
}) {
  const navigate = useNavigate();

  return (
    <header className="studio-canvas-v2-topbar">
      <button
        type="button"
        className="studio-canvas-v2-btn"
        onClick={() => {
          if (window.history.length > 1) navigate(-1);
          else navigate('/chat');
        }}
      >
        返回
      </button>
      <h1 className="studio-canvas-v2-topbar__title">项目 #{projectId} · 无限画布</h1>
      <div className="studio-canvas-v2-topbar__actions">
        <Segmented
          size="small"
          value={mode}
          options={[
            { label: 'auto', value: 'auto' },
            { label: 'manual', value: 'manual' },
          ]}
          onChange={(v) => onModeChange(v as 'auto' | 'manual')}
        />
        {busy ? (
          <button type="button" className="studio-canvas-v2-btn" onClick={onStop}>
            停止
          </button>
        ) : (
          <div className="studio-canvas-v2-topbar__spacer" />
        )}
      </div>
    </header>
  );
}
