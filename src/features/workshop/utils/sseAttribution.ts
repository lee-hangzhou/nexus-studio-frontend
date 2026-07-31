import type { TaskTimelineEntry } from '../types';

export function buildTaskTimelineEntries(
  tasks: Array<{ id: string; title: string; status: string }>,
  expertByTask: Record<string, string | null> = {},
): TaskTimelineEntry[] {
  return tasks.map((task) => ({
    task_id: task.id,
    title: task.title,
    status: task.status,
    speaker_role: 'host',
    expert_id: expertByTask[task.id] ?? null,
  }));
}

export function formatSseAttributionLine(entry: TaskTimelineEntry): string {
  const expert = entry.expert_id ?? '—';
  return `[${entry.speaker_role}] task=${entry.task_id} expert=${expert}`;
}
