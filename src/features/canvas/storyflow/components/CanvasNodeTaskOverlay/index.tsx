import type { CanvasTaskStatus } from '../../types';
import './CanvasNodeTaskOverlay.less';

/** 从节点 data 取任务失败文案（generateError 优先于 results.errorMessage） */
export function pickCanvasTaskErrorMessage(data?: {
  generateError?: string;
  results?: { errorMessage?: string };
}): string {
  const fromGenerate = (data?.generateError ?? '').trim();
  if (fromGenerate) {
    return fromGenerate;
  }
  return (data?.results?.errorMessage ?? '').trim();
}

/**
 * 画布节点任务态遮罩：running / failed 时覆盖在预览区上方。
 * 图片 / 视频 / 音频等媒体节点共用。
 */
export function CanvasNodeTaskOverlay({
  status,
  errorMessage = '',
  runningLabel = '正在生成...',
  waitingLabel = '等待输入...',
  failedTitle = '生成失败',
  className,
}: {
  status?: CanvasTaskStatus | string;
  errorMessage?: string;
  runningLabel?: string;
  waitingLabel?: string;
  failedTitle?: string;
  className?: string;
}) {
  const normalized = (status ?? '').trim();

  if (normalized === 'running') {
    return (
      <div
        className={`workflow-canvas-task-overlay${className ? ` ${className}` : ''}`}
        aria-label="任务进行中"
      >
        {runningLabel}
      </div>
    );
  }

  if (normalized === 'waiting_inputs') {
    return (
      <div
        className={`workflow-canvas-task-overlay is-waiting${className ? ` ${className}` : ''}`}
        aria-label="等待输入"
      >
        {waitingLabel}
      </div>
    );
  }

  if (normalized === 'failed') {
    const detail = errorMessage.trim();
    return (
      <div
        className={`workflow-canvas-task-overlay${className ? ` ${className}` : ''}`}
        aria-label="任务失败"
      >
        <div className="workflow-canvas-task-overlay__text">
          {failedTitle}
          {detail ? (
            <div className="workflow-canvas-task-overlay__detail">{detail}</div>
          ) : null}
        </div>
      </div>
    );
  }

  return null;
}
