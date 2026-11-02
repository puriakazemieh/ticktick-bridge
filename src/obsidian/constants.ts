import type { BridgeSettings } from "./types";

export const VIEW_TYPE = "ticktick-bridge-today";
export const HABIT_VIEW_TYPE = "ticktick-bridge-habits";
export const PLANNER_VIEW_TYPE = "ticktick-bridge-planner";
export const PROJECT_BOARD_VIEW_TYPE = "ticktick-bridge-project-board";
export const CONTROL_VIEW_TYPE = "ticktick-bridge-control";
export const TIMELINE_VIEW_TYPE = "ticktick-bridge-timeline";
export const WEEKLY_REVIEW_VIEW_TYPE = "ticktick-bridge-weekly-review";
export const EISENHOWER_MATRIX_VIEW_TYPE = "ticktick-bridge-matrix";
export const TIMEBLOCK_PLANNER_VIEW_TYPE = "ticktick-bridge-day-planner";
export const HEATMAP_VIEW_TYPE = "ticktick-bridge-heatmap";

export const DEFAULT_SETTINGS: BridgeSettings = {
  apiToken: "",
  webSessionToken: "",
  webSessionCookie: "",
  webSessionDeviceId: "",
  timeZone: "Asia/Tehran",
  dailyNoteFolder: "Journal",
  syncIntervalMinutes: 0,
  syncIntervalSeconds: 30,
  checkboxImportTag: "ticktick",
  scheduledCheckboxProjectId: "",
  showRibbonIcons: false,
  plannerFirstWeekday: 6,
  plannerShowCompleted: false,
  plannerShowHabits: false,
  ticktickNotesFolder: "TickTick Notes",
  experimentalChecklistReadOnly: true,
  boardLastProjectId: "",
  boardCollapsedGroups: [],
  boardSidebarCollapsed: false,
  boardSidebarPreferenceInitialized: false,
  boardSmartViewGrouping: "project",
  savedViews: [],
  experimentalHierarchyWrites: false,
  enableDueReminders: true,
  reminderLeadMinutes: 5,
  enableReminderChime: true,
};
