import { LoadingOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import type { ToolStepView } from '../../../api/chat';

const TOOL_LABELS: Record<string, string> = {
  web_search: '网页搜索',
  web_fetch: '抓取网页',
  read_file: '读取文件',
  write_file: '写入文件',
  execute_python: '运行脚本',
  list_files: '列出文件',
  publish_file: '交付文件',
};

function toolLabel(name: string): string {
  return TOOL_LABELS[name] ?? name;
}

function isPendingStep(step: ToolStepView): boolean {
  return (
    step.result_preview === '执行中…' || step.result_preview === '参数异常，正在自动修复…'
  );
}

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds} 秒`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function deriveStatusLabel(
  toolSteps: ToolStepView[],
  think: string,
  content: string,
  awaitingUserGate: boolean,
): string {
  if (awaitingUserGate) {
    return '等待您完成验证…';
  }
  const pending = toolSteps.find(isPendingStep);
  if (pending) {
    return `正在执行：${toolLabel(pending.name)}`;
  }
  if (toolSteps.length > 0 && !content.trim()) {
    return '工具已完成，模型思考中…';
  }
  if (think.trim() && !content.trim()) {
    return '正在组织回答…';
  }
  return '正在处理你的请求…';
}

type Props = {
  visible: boolean;
  toolSteps: ToolStepView[];
  think: string;
  content: string;
  startedAt: number | null;
  awaitingUserGate?: boolean;
  variant?: 'inline' | 'compact';
};

export function TurnWorkingStatus({
  visible,
  toolSteps,
  think,
  content,
  startedAt,
  awaitingUserGate = false,
  variant = 'inline',
}: Props) {
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    if (!visible || startedAt == null) {
      setElapsedSec(0);
      return;
    }
    const tick = () => {
      setElapsedSec(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [visible, startedAt]);

  if (!visible) return null;

  const label = deriveStatusLabel(toolSteps, think, content, awaitingUserGate);
  const elapsed = startedAt != null ? formatElapsed(elapsedSec) : null;

  if (variant === 'compact') {
    return (
      <div className="studio-turn-status studio-turn-status--compact" role="status" aria-live="polite">
        <LoadingOutlined className="studio-turn-status__icon" spin />
        <span className="studio-turn-status__label">{label}</span>
        {elapsed ? <span className="studio-turn-status__elapsed">{elapsed}</span> : null}
      </div>
    );
  }

  return (
    <div className="studio-turn-status" role="status" aria-live="polite">
      <LoadingOutlined className="studio-turn-status__icon" spin />
      <div className="studio-turn-status__body">
        <span className="studio-turn-status__label">{label}</span>
        <span className="studio-turn-status__hint">复杂任务可能需要几分钟，请保持页面打开</span>
        {elapsed ? <span className="studio-turn-status__elapsed">已等待 {elapsed}</span> : null}
      </div>
    </div>
  );
}
