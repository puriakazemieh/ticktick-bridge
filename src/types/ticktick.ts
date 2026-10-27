/**
 * TickTick Bridge — Domain Models & Type Definitions
 */

export interface TickTickChecklistItem {
  id?: string;
  title?: string;
  content?: string;
  status?: number; // 0: open, 1: completed
  sortOrder?: number;
  startDate?: string;
  [key: string]: unknown;
}

export interface TickTickTask {
  id: string;
  projectId: string;
  title: string;
  content?: string;
  desc?: string;
  status?: number; // 0: active/open, 2: completed
  dueDate?: string | null;
  startDate?: string | null;
  isAllDay?: boolean;
  priority?: number; // 0: none, 1: low, 3: medium, 5: high
  repeatFlag?: string | null;
  timeZone?: string;
  reminders?: string[];
  items?: TickTickChecklistItem[];
  columnId?: string | null;
  sortOrder?: number;
  tags?: string[];
  tagNames?: string[];
  projectName?: string;
  projectColor?: string;
  kind?: "TEXT" | "NOTE" | string;
  pinned?: boolean;
  isInbox?: boolean;
  createdTime?: string;
  modifiedTime?: string;
  completedTime?: string;
  [key: string]: unknown;
}

export interface TickTickProject {
  id: string;
  name: string;
  color?: string;
  folderName?: string;
  groupId?: string;
  sortOrder?: number;
  closed?: boolean;
  kind?: "TASK" | "NOTE" | string;
  viewMode?: "list" | "kanban" | "timeline" | string;
  openCount?: number;
  isInbox?: boolean;
  virtual?: boolean;
  [key: string]: unknown;
}

export interface TickTickColumn {
  id: string;
  name: string;
  projectId?: string;
  sortOrder?: number;
  count?: number;
  groups?: Array<{ name: string; tasks: TickTickTask[] }>;
  synthetic?: boolean;
  [key: string]: unknown;
}

export interface ProjectBoardData {
  project: TickTickProject;
  columns: TickTickColumn[];
  tasks: TickTickTask[];
  [key: string]: unknown;
}

export interface CachedHabitCheckin {
  stamp: number;
  value: number;
  goal: number;
  status: number;
}

export interface HabitHistoryEntry {
  date: string;
  value: number;
  completed: boolean;
}

export interface TickTickHabit {
  id: string;
  name: string;
  icon?: string;
  iconRes?: string;
  status?: number;
  color?: string;
  repeatRule?: string;
  sectionId?: string;
  sectionName?: string;
  tags?: string[];
  tagNames?: string[];
  tag?: string;
  goal?: number;
  target?: number;
  step?: number;
  unit?: string;
  recordType?: string;
  encouragement?: string;
  sortOrder?: number;
  checkin?: CachedHabitCheckin | { goal?: number; status?: number; value?: number; [key: string]: unknown } | null;
  history?: HabitHistoryEntry[];
  [key: string]: unknown;
}

export interface TickTickNote {
  id: string;
  title: string;
  projectId: string;
  projectName?: string;
  kind: "NOTE";
  content: string;
  modifiedTime?: string | null;
  tags?: string[];
  [key: string]: unknown;
}

export interface MarkdownConflict {
  path: string;
  line: number;
  message: string;
  diff?: {
    conflicts?: Array<{
      field: string;
      local: unknown;
      remote: unknown;
    }>;
  };
  [key: string]: unknown;
}

export type MutationType = "create" | "update" | "complete" | "delete" | "habit";

export interface PendingMutation {
  id: string;
  type: MutationType;
  payload: Partial<TickTickTask> | Partial<TickTickHabit> | Partial<TickTickProject> | Record<string, unknown>;
  queuedAt: string;
}

export interface TaskPriorityInfo {
  value: number;
  label: string;
  icon: string;
  className: string;
}
