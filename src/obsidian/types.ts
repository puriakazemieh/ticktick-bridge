export * from "../types/ticktick";

import type {
  TickTickTask,
  TickTickProject,
  TickTickHabit,
  CachedHabitCheckin,
  PendingMutation,
  ProjectBoardData
} from "../types/ticktick";

export type DashboardMode = "day" | "week" | "month" | "stats";
export type ControlScreen = "sync" | "notes" | "checklists" | "reports";
export type AuthStatus = "connected" | "needs_auth" | "unknown";

export interface BridgeSettings {
  apiToken: string;
  webSessionToken: string;
  webSessionCookie: string;
  webSessionDeviceId: string;
  timeZone: string;
  dailyNoteFolder: string;
  syncIntervalMinutes: number;
  syncIntervalSeconds: number;
  checkboxImportTag: string;
  scheduledCheckboxProjectId: string;
  showRibbonIcons: boolean;
  plannerFirstWeekday: number;
  plannerShowCompleted: boolean;
  plannerShowHabits: boolean;
  ticktickNotesFolder: string;
  experimentalChecklistReadOnly: boolean;
  boardLastProjectId: string;
  boardCollapsedGroups: string[];
  boardSidebarCollapsed: boolean;
  boardSidebarPreferenceInitialized: boolean;
  boardSmartViewGrouping?: string;
  savedViews: SavedView[];
  experimentalHierarchyWrites: boolean;
  enableDueReminders?: boolean;
  reminderLeadMinutes?: number;
  enableReminderChime?: boolean;
}

export interface TaskFilterState {
  projects: string[];
  tags: string[];
  statuses: number[];
  priorities: number[];
  dateRange: { start?: string; end?: string } | null;
  searchText: string;
  grouping?: string;
  sort?: string;
}

export interface SavedView {
  id: string;
  name: string;
  scope: "all" | "board" | "calendar" | "timeline";
  filter: TaskFilterState;
  grouping?: string;
  sort?: string;
  createdAt: string;
  updatedAt: string;
}

export type BridgeCache = {
  savedAt: string;
  tasks: TickTickTask[];
  projects: TickTickProject[];
  projectBoards: Record<string, ProjectBoardData>;
  habits: TickTickHabit[];
  habitCheckins: Record<string, CachedHabitCheckin[]>;
  pending: PendingMutation[];
  conflicts: PendingMutation[];
  rateLimitedUntil: number;
};

export type TaskDraft = {
  id?: string;
  projectId?: string;
  title?: string;
  desc?: string;
  content?: string;
  dueDate?: string | null;
  startDate?: string | null;
  repeatFlag?: string | null;
  timeZone?: string;
  reminders?: string[];
  tags?: string[];
  tagNames?: string[];
  priority?: number;
  projectName?: string;
  reminderTime?: string;
  columnId?: string | null;
  parentId?: string | null;
  [key: string]: unknown;
};
