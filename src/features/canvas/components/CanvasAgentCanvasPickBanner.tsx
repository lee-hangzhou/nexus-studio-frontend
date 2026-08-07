import { CanvasFocusIcon } from './CanvasFocusIcon';

type CanvasAgentCanvasPickBannerProps = {
  onExit: () => void;
};

/** 画布选取模式顶部提示条（对齐 Storyflow） */
export function CanvasAgentCanvasPickBanner({ onExit }: CanvasAgentCanvasPickBannerProps) {
  return (
    <div className="canvas-agent-canvas-pick-banner" role="status" aria-live="polite">
      <div className="canvas-agent-canvas-pick-banner__icon" aria-hidden>
        <CanvasFocusIcon />
        <span className="canvas-agent-canvas-pick-banner__pulse" />
      </div>
      <div className="canvas-agent-canvas-pick-banner__text">
        <div className="canvas-agent-canvas-pick-banner__title-row">
          <span className="canvas-agent-canvas-pick-banner__badge">选取中</span>
          <span className="canvas-agent-canvas-pick-banner__title">从画布选取</span>
        </div>
        <div className="canvas-agent-canvas-pick-banner__desc">点击节点以添加引用</div>
      </div>
      <button type="button" className="canvas-agent-canvas-pick-banner__exit" onClick={onExit}>
        退出
      </button>
    </div>
  );
}
