import type { Task, TaskSection } from '@/constants/tasks';
import type { PerformanceTask } from '@/services/performance/performanceApi';

// TaskTypeId of 360 feedback requests. These open the Give 360 Feedback screen
// instead of the generic task detail screen.
export const THREE_SIXTY_TASK_TYPE_ID = '360_FEEDBACK';

// '::' rather than '_' — TaskTypeId values like 'PIP_REVIEW_SCH' already
// contain underscores, so a '_'-joined id can't be split back apart reliably.
const ID_DELIMITER = '::';

export function formatDisplayDate(isoDate: string | null): string {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return '';
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  return `${String(d.getDate()).padStart(2, '0')} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export interface TaskKey {
  taskId: string;
  taskTypeId: string;
  taskOwnerUserId: string;
}

export function parseTaskId(id: string): TaskKey | null {
  const parts = id.split(ID_DELIMITER);
  if (parts.length !== 3) return null;
  const [taskId, taskTypeId, taskOwnerUserId] = parts;
  return { taskId, taskTypeId, taskOwnerUserId };
}

// Mirrors the bucketing logic in the web app's PerfomanceManager/MyTasks.jsx
// (isTaskClosed / isFutureTask), so a task lands in the same section on both.
export function mapTaskToDisplay(task: PerformanceTask): Task {
  const isClosed = ['completed', 'closed'].includes((task.Task_Status || '').toLowerCase());
  const todayStart = new Date(new Date().setHours(0, 0, 0, 0));
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const isFuture =
    !isClosed && !!task.TargetDate && new Date(task.TargetDate) >= todayEnd;

  const section: TaskSection = isClosed
    ? 'closed'
    : task.isDelayed
      ? 'delayed'
      : isFuture
        ? 'future'
        : 'current';

  return {
    id: [task.TaskId, task.TaskTypeId, task.TaskOwnerUserId].join(ID_DELIMITER),
    title: task.Title || task.TaskTypeName || task.TaskTypeId,
    workflowType: task.Description || task.TaskTypeName || task.TaskTypeId,
    actionDue: formatDisplayDate(task.TargetDate ?? task.NextActionDueDate),
    status: section === 'closed' ? 'closed' : section === 'current' ? 'open' : 'pending',
    section,
    sectionDate: formatDisplayDate(task.Created_Date),
    attachments: task.attachments,
    notes: task.VAR2 ?? '',
  };
}
