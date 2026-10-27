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
  projectName?: string;
  reminderTime?: string;
  [key: string]: unknown;
};
