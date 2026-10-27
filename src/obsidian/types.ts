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

export type CachedHabitCheckin = {
  stamp: number;
  value: number;
  goal: number;
  status: number;
};

export type PendingMutation = {
  id: string;
  type: "create" | "update" | "complete" | "delete" | "habit";
  payload: any;
  queuedAt: string;
};

export type BridgeCache = {
  savedAt: string;
  tasks: any[];
  projects: any[];
  projectBoards: Record<string, any>;
  habits: any[];
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
  dueDate?: string;
  startDate?: string;
  repeatFlag?: string;
  timeZone?: string;
  reminders?: string[];
  projectName?: string;
  reminderTime?: string;
  [key: string]: unknown;
};
