import {
  CheckCircleFilled,
  CodeOutlined,
  DownOutlined,
  FileTextOutlined,
  LoadingOutlined,
  MessageOutlined,
  SearchOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import { useMemo, useState } from 'react';
import type { ToolStepView } from '../../../api/chat';
import { visibleToolSteps } from '../toolStepVisibility';
import type { TurnTimelineItem } from '../turnTimeline';
import { toolStepsFromTimeline, visibleTurnTimeline } from '../turnTimeline';

type StepStatus = 'pending' | 'failed' | 'done';

const TOOL_LABELS: Record<string, string> = {
  web_search: '网页搜索',
  read_file: '读取文件',
  write_file: '写入文件',
  execute_python: '运行脚本',
  list_dir: '列出目录',
  query_canvas_nodes: '读取画布',
  apply_canvas_patch: '更新画布',
  apply_canvas_edge_operation: '更新连线',
  apply_canvas_arrange: '整理画布布局',
  list_generate_models: '查询生成模型',
  submit_node_generation: '提交生成任务',
  list_node_generations: '查询生成状态',
  inspect_node_media: '查看节点画面',
  inspect_turn_media: '查看附件画面',
  read_canvas_skill: '读取画布技能',
  recall_user_memory: '检索用户记忆',
  recall_conversation_memory: '检索会话记忆',
  list_user_memories: '查看用户记忆',
  list_conversation_memories: '查看会话记忆',
  manage_user_memory: '更新用户记忆',
  manage_conversation_memory: '更新会话记忆',
  browser_exec_script: '检查页面',
  browser_capture_state: '保存页面截图',
  request_user_gate: '正在准备操作面板',
  login_method: '请选择登录方式',
};

const TOOL_TAGS: Record<string, string> = {
  web_search: 'Search',
  read_file: 'File',
  write_file: 'File',
  execute_python: 'Script',
  list_dir: 'File',
  query_canvas_nodes: 'Canvas',
  apply_canvas_patch: 'Canvas',
  apply_canvas_edge_operation: 'Canvas',
  apply_canvas_arrange: 'Canvas',
  list_generate_models: 'Model',
  submit_node_generation: 'Generate',
  list_node_generations: 'Generate',
  inspect_node_media: 'Vision',
  inspect_turn_media: 'Vision',
  read_canvas_skill: 'Skill',
  browser_exec_script: 'Browser',
  browser_capture_state: 'Browser',
  request_user_gate: 'Browser',
};

function stepStatus(step: ToolStepView): StepStatus {
  if (
    step.result_preview === '执行中…'
    || step.result_preview === '参数异常，正在自动修复…'
  ) return 'pending';
  if (step.result_preview.startsWith('失败:')) return 'failed';
  return 'done';
}

function toolLabel(name: string): string {
  return TOOL_LABELS[name] ?? name;
}

function toolTag(name: string): string {
  return TOOL_TAGS[name] ?? 'Tool';
}

function stepTitle(step: ToolStepView): string {
  const { name, args } = step;
  if (name === 'query_canvas_nodes') return '读取当前画布状态';
  if (name === 'list_generate_models') {
    const kind = typeof args.kind === 'string' ? args.kind : '';
    return kind === 'video' ? '查询可用视频模型' : kind === 'image' ? '查询可用图片模型' : '查询可用生成模型';
  }
  if (name === 'apply_canvas_patch' || name === 'apply_canvas_edge_operation') {
    const operation =
      args.operation && typeof args.operation === 'object'
        ? (args.operation as Record<string, unknown>)
        : null;
    const op = typeof operation?.op === 'string' ? operation.op : '';
    if (op === 'create_node') return '创建画布节点';
    if (op === 'update_node') return '更新画布节点';
    if (op === 'connect') return '连接画布节点';
    if (op === 'disconnect') return '断开画布连接';
    return name === 'apply_canvas_edge_operation' ? '更新连线' : '更新画布';
  }
  if (name === 'submit_node_generation') {
    const kind = typeof args.kind === 'string' ? args.kind : '';
    return kind === 'video' ? '提交视频生成任务' : kind === 'image' ? '提交图片生成任务' : '提交生成任务';
  }
  if (name === 'web_search') {
    const query = args.query ?? args.q;
    if (typeof query === 'string' && query.trim()) return query.trim();
  }
  if (typeof args.path === 'string' && args.path.trim()) return args.path.trim();
  if (typeof args.filename === 'string' && args.filename.trim()) return args.filename.trim();
  return toolLabel(name);
}

function summarizeRun(steps: ToolStepView[]): string {
  if (steps.length === 0) return '执行工具中…';

  const groups = new Map<string, number>();
  for (const step of steps) {
    groups.set(step.name, (groups.get(step.name) ?? 0) + 1);
  }

  const parts: string[] = [];
  groups.forEach((count, name) => {
    const label = toolLabel(name);
    parts.push(count > 1 ? `${count} 次${label}` : label);
  });

  const pending = steps.some((step) => stepStatus(step) === 'pending');
  if (pending) {
    return parts.length > 0 ? `正在执行：${parts.join('，')}` : '正在执行工具…';
  }
  return parts.length > 0 ? `已执行 ${steps.length} 个步骤 · ${parts.join('，')}` : `已执行 ${steps.length} 个步骤`;
}

function TimelineDoneFoot({ show }: { show: boolean }) {
  if (!show) return null;

  return (
    <div className="tool-run__done">
      <CheckCircleFilled className="tool-run__done-icon" aria-hidden />
      <span>完成</span>
    </div>
  );
}

function StepIcon({ name, status }: { name: string; status: StepStatus }) {
  if (status === 'pending') {
    return <LoadingOutlined spin />;
  }
  if (name === 'web_search') return <SearchOutlined />;
  if (name === 'execute_python') return <CodeOutlined />;
  if (name === 'read_file' || name === 'write_file' || name === 'list_dir') {
    return <FileTextOutlined />;
  }
  return <ToolOutlined />;
}

function NarrationRow({ text }: { text: string }) {
  return (
    <div className="tool-run__step tool-run__step--narration">
      <span className="tool-run__step-icon tool-run__step-icon--narration" aria-hidden>
        <MessageOutlined />
      </span>
      <div className="tool-run__step-body">
        <div className="tool-run__step-title tool-run__step-title--narration">{text}</div>
      </div>
    </div>
  );
}

function ToolRunStep({ step }: { step: ToolStepView }) {
  const status = stepStatus(step);

  return (
    <div className="tool-run__step tool-run__step--compact">
      <span className={`tool-run__step-icon tool-run__step-icon--${status}`} aria-hidden>
        <StepIcon name={step.name} status={status} />
      </span>
      <div className="tool-run__step-body">
        <div className="tool-run__step-title">{stepTitle(step)}</div>
        <span className="tool-run__step-tag">{toolTag(step.name)}</span>
      </div>
    </div>
  );
}

type Props = {
  steps?: ToolStepView[];
  items?: TurnTimelineItem[];
  turnInProgress?: boolean;
};

export function ToolRunTimeline({
  steps,
  items,
  turnInProgress = false,
}: Props) {
  const visibleItems = useMemo(() => {
    if (items) return visibleTurnTimeline(items);
    return visibleToolSteps(steps ?? []).map((step) => ({
      kind: 'tool' as const,
      id: step.call_id,
      step,
    }));
  }, [items, steps]);

  const visibleSteps = useMemo(() => toolStepsFromTimeline(visibleItems), [visibleItems]);
  const hasPending = useMemo(
    () => visibleSteps.some((step) => stepStatus(step) === 'pending'),
    [visibleSteps],
  );
  const allDone = visibleSteps.length > 0 && visibleSteps.every((step) => stepStatus(step) === 'done');
  const [collapsed, setCollapsed] = useState(false);

  if (visibleItems.length === 0) return null;

  const summary = summarizeRun(visibleSteps);
  const expanded = hasPending ? true : !collapsed;

  return (
    <div className="tool-run">
      <button
        type="button"
        className="tool-run__summary"
        onClick={() => {
          if (!hasPending) setCollapsed((value) => !value);
        }}
        aria-expanded={expanded}
      >
        <span className="tool-run__summary-text">{summary}</span>
        <DownOutlined className={`tool-run__chevron${expanded ? ' tool-run__chevron--open' : ''}`} />
      </button>

      {expanded ? (
        <div className="tool-run__timeline">
          {visibleItems.map((item) =>
            item.kind === 'narration' ? (
              <NarrationRow key={item.id} text={item.text} />
            ) : (
              <ToolRunStep key={item.id} step={item.step} />
            ),
          )}
          <TimelineDoneFoot show={allDone && !turnInProgress} />
        </div>
      ) : null}
    </div>
  );
}
