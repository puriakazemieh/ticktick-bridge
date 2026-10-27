import { MarkdownRenderer, Menu, Notice, Plugin, TFile, requestUrl, setIcon } from "obsidian";
import { isScheduledForDay, toDateKey, todayInZone } from "../core/date.js";
import { TickTickClient } from "../core/ticktick-client.js";
import { normalizeWebSessionCookie, parseWebHabitCheckins } from "../core/ticktick-web-habits.js";
import { ManagedStorage } from "./managed-storage";
import { MarkdownSync } from "./markdown-sync";
import { MarkdownConflictModal, PendingMutationConflictModal } from "./conflict-modal";
import { PlanningCalendar } from "./planning-calendar";
import { ProjectBoard } from "./project-board";
import { NoteImport, NoteImportModal } from "./note-import";
import { mergeTaskDetails, taskDescription } from "../core/task-description.js";
import { normalizeProjectData } from "../core/project-board.js";

import type { BridgeSettings, BridgeCache, CachedHabitCheckin, PendingMutation, DashboardMode, ControlScreen, TaskDraft, TickTickTask, TickTickProject, TickTickHabit } from "./types";
import { VIEW_TYPE, HABIT_VIEW_TYPE, PLANNER_VIEW_TYPE, PROJECT_BOARD_VIEW_TYPE, CONTROL_VIEW_TYPE, DEFAULT_SETTINGS } from "./constants";
import {
  currentPlatformName,
  appendChecklistSummary,
  formatTaskSchedule,
  formatRecurringTaskSchedule,
  cleanTaskDescription,
  cleanTaskTitle,
  habitIcon,
  habitDashboardSection,
  habitDashboardGroup,
  habitDashboardGroupLabel,
  habitStreak,
  parseRecurringDays,
  recurringTaskKind,
  shiftIsoDay,
  normalizeCache,
  escapeRegExp,
  checkboxSchedule,
  isHabitScheduledForCachedDay,
  dailyNoteDateFromPath,
  toTaskPayload,
  publicCacheMetadata
} from "./helpers";

import { openTaskEditor, confirmDelete } from "./modals/task-editor-modal";
import { TodayTasksView } from "./views/today-tasks-view";
import { TodayHabitsView } from "./views/today-habits-view";
import { PlanningView } from "./views/planning-view";
import { ProjectBoardView } from "./views/project-board-view";
import { TickTickControlView } from "./views/ticktick-control-view";
import { TickTickBridgeSettings } from "./settings";

export default class TickTickBridgePlugin extends Plugin {
  settings: BridgeSettings = DEFAULT_SETTINGS;
  private cache: BridgeCache = { savedAt: "", tasks: [], projects: [], projectBoards: {}, habits: [], habitCheckins: {}, pending: [], conflicts: [], rateLimitedUntil: 0 };
  private habitCheckinCache = new Map<string, { status: number; value: number; goal: number }>();
  private syncTimer: number | null = null;
  private ribbonIcons: HTMLElement[] = [];
  private syncRibbonIcon: HTMLElement | null = null;
  private panelMenuRibbonIcon: HTMLElement | null = null;
  private taskBlocks = new Map<HTMLElement, string | undefined>();
  private habitBlocks = new Map<HTMLElement, { dashboard: boolean; day?: string }>();
  // Keep the rendered Markdown blocks in place when a background sync did
  // not actually change their data.  Replacing a code block recreates its DOM
  // tree, which also discards transient UI state and can move the preview's
  // scroll position.
  private taskBlockSignatures = new Map<HTMLElement, string>();
  private habitBlockSignatures = new Map<HTMLElement, string>();
  private dashboardStates = new Map<HTMLElement, { day: string; mode: DashboardMode }>();
  private checkboxImportTimers = new Map<string, number>();
  private syncInProgress = false;
  private rateLimitedUntil = 0;
  private managedStorage!: ManagedStorage;
  private markdownSync!: MarkdownSync;
  private noteImport!: NoteImport;
  private lastManagedReport = "هنوز گزارشی ثبت نشده است.";

  async onload() {
    this.managedStorage = new ManagedStorage(this.app.vault.adapter as any);
    const savedSettings = await this.loadData();
    const legacySettings = (savedSettings ?? {}) as Record<string, unknown>;
    const {
      projectRoot: _legacyProjectRoot,
      projectDependencies: _legacyProjectDependencies,
      projectTaskCatalog: _legacyProjectTaskCatalog,
      cache: savedCache,
      localHabitFolder: _legacyLocalHabitFolder,
      ...activeSettings
    } = legacySettings;
    this.settings = { ...DEFAULT_SETTINGS, ...activeSettings };
    // This Persian planner is intentionally Saturday-first. Older installs
    // persisted Monday as their legacy default, so migrate them once.
    if (this.settings.plannerFirstWeekday !== 6) this.settings.plannerFirstWeekday = 6;
    const privateCache = await this.managedStorage.readPrivateCache();
    this.cache = normalizeCache(privateCache ?? savedCache);
    this.rateLimitedUntil = Math.max(0, Number(this.cache.rateLimitedUntil ?? 0));
    this.markdownSync = new MarkdownSync(this.app, this.managedStorage, () => this.client(), () => this.settings, () => this.scheduledCheckboxProjectId());
    await this.markdownSync.initialize();
    this.noteImport = new NoteImport(this.app, this.managedStorage, () => this.settings.ticktickNotesFolder);
    if (!privateCache || "projectRoot" in legacySettings || "projectDependencies" in legacySettings || "projectTaskCatalog" in legacySettings) await this.saveSettings();
    // Remove any restored workspace leaf from the retired project-planning view.
    this.app.workspace.onLayoutReady(() => {
      this.app.workspace.getLeavesOfType("ticktick-bridge-projects").forEach(leaf => leaf.detach());
    });
    this.addSettingTab(new TickTickBridgeSettings(this.app, this));
    this.registerView(VIEW_TYPE, leaf => new TodayTasksView(leaf, this));
    this.registerView(HABIT_VIEW_TYPE, leaf => new TodayHabitsView(leaf, this));
    this.registerView(PLANNER_VIEW_TYPE, leaf => new PlanningView(leaf, this));
    this.registerView(PROJECT_BOARD_VIEW_TYPE, leaf => new ProjectBoardView(leaf, this));
    this.registerView(CONTROL_VIEW_TYPE, leaf => new TickTickControlView(leaf, this));
    this.registerMarkdownCodeBlockProcessor("ticktick-today", async (_source, element, context) => {
      const day = dailyNoteDateFromPath(context.sourcePath);
      this.taskBlocks.set(element, day);
      await this.renderTodayBlock(element, day);
    });
    this.registerMarkdownCodeBlockProcessor("ticktick-habits", async (_source, element, context) => {
      const dashboard = context.sourcePath.includes("داشبورد برنامه‌ریزی");
      const day = dailyNoteDateFromPath(context.sourcePath);
      this.habitBlocks.set(element, { dashboard, day });
      await this.renderHabitBlock(element, dashboard, day);
    });
    this.registerMarkdownCodeBlockProcessor("ticktick-recurring", async (_source, element) => this.renderRecurringBlock(element));
    this.registerMarkdownCodeBlockProcessor("ticktick-planner", async (_source, element) => {
      const planner = new PlanningCalendar(element, this.plannerHost());
      await planner.render();
    });
    this.registerMarkdownCodeBlockProcessor("ticktick-board", async (_source, element) => {
      await new ProjectBoard(element, this.projectBoardHost()).render();
    });
    this.configurePanelMenuRibbonIcon();
    this.configureSyncRibbonIcon();
    this.configureRibbonIcons();
    this.addCommand({ id: "open-today-tasks", name: "Open today's TickTick tasks", callback: () => this.openTodayView() });
    this.addCommand({ id: "open-today-habits", name: "Open today's TickTick habits", callback: () => this.openHabitView() });
    this.addCommand({ id: "open-ticktick-sync-center", name: "Open TickTick sync center", callback: () => this.openControlPage("sync") });
    this.addCommand({ id: "preview-ticktick-notes", name: "Preview TickTick Notes import", callback: () => this.openControlPage("notes") });
    this.addCommand({ id: "open-weekly-planner", name: "Open TickTick weekly planner", callback: () => this.openPlannerView() });
    this.addCommand({ id: "open-project-board", name: "Open TickTick project board", callback: () => this.openProjectBoardView() });
    this.addCommand({ id: "refresh-project-board", name: "Refresh TickTick project board", callback: () => this.syncNow() });
    this.addCommand({ id: "sync-now", name: "Sync TickTick now", callback: () => this.syncNow() });
    this.addCommand({ id: "preview-markdown-sync", name: "Preview Markdown ↔ TickTick sync", callback: () => this.previewMarkdownSync() });
    this.addCommand({ id: "apply-markdown-sync", name: "Apply Markdown ↔ TickTick sync preview", callback: () => this.applyMarkdownSync() });
    this.addCommand({ id: "open-markdown-sync-conflicts", name: "Open Markdown sync conflicts", callback: () => this.openMarkdownSyncConflicts() });
    this.addCommand({ id: "repair-markdown-bindings", name: "Repair legacy Markdown bindings", callback: () => this.repairMarkdownBindings() });
    this.addCommand({ id: "import-ticktick-checkboxes", name: "Preview #ticktick checkboxes", callback: () => this.previewMarkdownSync() });
    this.registerEvent(this.app.vault.on("modify", file => {
      if (file instanceof TFile && file.extension === "md") this.queueTaggedCheckboxImport(file);
    }));
    this.configureAutomaticSync();
    // Build the complete local mirror after Obsidian has finished opening.
    // The UI can then stay entirely local between background syncs.
    this.app.workspace.onLayoutReady(() => void this.syncNow({ quiet: true }));
  }

  async createPrewriteSnapshot(purpose: string, payload: unknown) {
    const path = await this.managedStorage.writeSnapshot(purpose, payload);
    try { await this.managedStorage.pruneEligibleManagedBackups(); } catch { /* a completed save remains valid if retention cleanup fails */ }
    return path;
  }

  async saveSettings() {
    // This deliberately contains only public cache metadata; plugin settings and
    // queued request bodies can contain TickTick credentials or private text.
    await this.managedStorage.writePrivateCache(this.cache);
    await this.createPrewriteSnapshot("cache", publicCacheMetadata(this.cache));
    await this.saveData({ ...this.settings, cache: publicCacheMetadata(this.cache) });
  }

  async previewLegacyRootBackups() { return this.managedStorage.legacyRootBackups(); }
  async migrateLegacyRootBackups() {
    const result = await this.managedStorage.migrateLegacyRootBackups();
    this.lastManagedReport = `انتقال ریشه: ${result.migrated.length} از ${result.sources.length} فایل.`;
    try { await this.managedStorage.writeReport("legacy-migration", { sourceCount: result.sources.length, migratedCount: result.migrated.length }); } catch { /* migration is already recoverable */ }
    return result;
  }
  managedStorageReport() { return this.lastManagedReport; }
  async latestManagedReport() { return this.managedStorage.latestReport(); }

  private queueTaggedCheckboxImport(file: TFile) {
    const previous = this.checkboxImportTimers.get(file.path);
    if (previous) window.clearTimeout(previous);
    this.checkboxImportTimers.set(file.path, window.setTimeout(() => {
      this.checkboxImportTimers.delete(file.path);
      void this.previewMarkdownSync(true, [file]);
    }, 700));
  }

  async importAllTaggedCheckboxes() {
    await this.previewMarkdownSync();
  }

  async previewMarkdownSync(quiet = false, files?: TFile[]) {
    const result = await this.markdownSync.preview(files);
    if (!quiet) new Notice(`پیش‌نمایش Markdown sync: ایجاد ${result.create}، ارسال ${result.push}، دریافت ${result.pull}، تعارض ${result.conflict}، قرنطینه ${result.quarantine}.`);
    return result;
  }
  async applyMarkdownSync() {
    const result = await this.markdownSync.apply();
    new Notice(`همگام‌سازی اعمال شد: ${result.applied} تغییر. تعارض/قرنطینه: ${result.conflict + result.quarantine}.`);
    return result;
  }
  async openMarkdownSyncConflicts() {
    const conflicts = await this.markdownSync.conflicts();
    if (conflicts.length) {
      const actionable = conflicts.find(conflict => conflict.diff?.conflicts?.length);
      if (actionable) {
        const choice = await new MarkdownConflictModal(this.app, actionable).openAndWait();
        await this.markdownSync.resolve(actionable, choice);
        new Notice("انتخاب شما ثبت شد؛ گزارش در /.ticktick/reports/ ذخیره شد.");
      } else new Notice(`${conflicts.length} مورد Markdown در قرنطینه است؛ جزئیات در گزارش /.ticktick/reports/ ثبت شده است.`);
    }
    if (this.cache.conflicts.length) new PendingMutationConflictModal(this.app, this.cache.conflicts, (operation, choice) => this.resolveQueuedConflict(operation, choice)).open();
    else if (!conflicts.length) new Notice("تعارضی برای مدیریت وجود ندارد.");
    return conflicts;
  }

  private async resolveQueuedConflict(operation: PendingMutation, choice: "retry" | "discard") {
    this.cache.conflicts = this.cache.conflicts.filter(item => item.id !== operation.id);
    if (choice === "retry") this.cache.pending.push({ ...operation, queuedAt: new Date().toISOString() });
    await this.saveSettings();
    await this.refreshLocalSurfaces();
    new Notice(choice === "retry" ? "تغییر دوباره به صف امن همگام‌سازی رفت." : "تغییر محلی از صف تعارض حذف شد.");
  }
  async repairMarkdownBindings() {
    const result = await this.markdownSync.repairLegacyBindings();
    new Notice(`اسکن binding قدیمی تمام شد؛ ${result.quarantine} مورد نیازمند بررسی دستی است.`);
    return result;
  }

  async previewTickTickNotes() {
    const rows = this.noteImport.preview(this.cache.tasks);
    if (rows.length) new NoteImportModal(this.app, this.noteImport, this.cache.tasks).open();
    else new Notice("Note قابل‌انتقال با kind: NOTE در cache پیدا نشد.");
    return rows;
  }
  async importSelectedTickTickNotes(rows: Array<{ note: any; path: string; selected?: boolean }>) { return this.noteImport.apply(rows); }

  plannerHost() {
    return {
      app: this.app,
      timeZone: this.settings.timeZone,
      firstWeekday: 6,
      showCompleted: this.settings.plannerShowCompleted,
      tasks: () => this.cache.tasks,
      // This host is called by an explicit toolbar action. Let the central
      // sync layer report an honest success/fallback/error notification.
      refresh: async () => { await this.syncNow(); },
      reschedule: async (task: any, day: string) => this.rescheduleTaskFromPlanner(task, day),
      complete: async (task: any) => this.markdownSync.bindingForTask(String(task.id)) ? this.markdownSync.completeBoundTask(String(task.id)) : this.completeTask(task),
      binding: (task: any) => this.markdownSync.bindingForTask(String(task.id)),
      load: async (task: any) => this.loadTaskDetails(task),
      edit: async (task: any) => this.editTaskFromSurface(task),
      create: async (initial: any) => this.createTaskFromSurface(initial),
      habits: (day: string) => this.cachedHabitsForDay(day),
      checkInHabit: async (habit: any, day: string) => {
        const goal = Math.max(1, Number(habit.checkin?.goal ?? habit.goal ?? habit.target ?? 1));
        const current = Number(habit.checkin?.value ?? 0);
        const next = current >= goal ? 0 : Math.min(goal, current + Math.max(1, Number(habit.step ?? 1)));
        return this.checkInHabit(String(habit.id), day, { value: next, goal, status: next >= goal ? 2 : undefined });
      },
      habitWithHistory: (habitId: string, day: string) => this.cachedHabitsWithHistory(day, 28).find(habit => String(habit.id) === habitId),
      // Details panels are cache-only. The normal sync pipeline refreshes this
      // mirror; opening a habit must never create a second web request.
      habitHistory: (habitId: string, from: string, to: string) => this.cachedHabitHistoryRange(habitId, from, to),
      setHabitProgress: async (habit: any, day: string, value: number, goal: number) => this.checkInHabit(String(habit.id), day, { value: Math.max(0, value), goal: Math.max(1, goal), status: value >= goal ? 2 : undefined }),
      loadHabit: async (habit: any) => this.loadHabitDetails(habit),
      showHabits: () => this.settings.plannerShowHabits,
      setShowHabits: async (value: boolean) => { this.settings.plannerShowHabits = value; await this.saveSettings(); },
    };
  }

  projectBoardHost() {
    return {
      app: this.app,
      timeZone: this.settings.timeZone,
      firstWeekday: 6,
      projects: async () => this.cache.projects.length ? this.cache.projects : this.client().listProjects(),
      createProject: (project: any) => this.client().createProject(project),
      updateProject: (project: any) => this.client().updateProject(project),
      deleteProject: (projectId: string) => this.client().deleteProject(projectId),
      createTask: (initial: any) => this.createTaskFromSurface(initial),
      tasks: () => this.cache.tasks,
      habits: () => this.cache.habits,
      checkInHabit: async (habit: any, day: string) => {
        const goal = Math.max(1, Number(habit.checkin?.goal ?? habit.goal ?? habit.target ?? 1));
        const current = Number(habit.checkin?.value ?? 0);
        const next = current >= goal ? 0 : Math.min(goal, current + Math.max(1, Number(habit.step ?? 1)));
        return this.checkInHabit(String(habit.id), day, { value: next, goal, status: next >= goal ? 2 : undefined });
      },
      habitHistory: (habitId: string, from: string, to: string) => this.cachedHabitHistoryRange(habitId, from, to),
      setHabitProgress: async (habit: any, day: string, value: number, goal: number) => this.checkInHabit(String(habit.id), day, { value: Math.max(0, value), goal: Math.max(1, goal), status: value >= goal ? 2 : undefined }),
      board: async (project: any) => this.cache.projectBoards[String(project.id)] ?? this.client().projectBoard(project),
      // This host is called by an explicit toolbar action. Let the central
      // sync layer report an honest success/fallback/error notification.
      refresh: async () => { await this.syncNow(); },
      complete: async (task: any) => this.markdownSync.bindingForTask(String(task.id)) ? this.markdownSync.completeBoundTask(String(task.id)) : this.completeTask(task),
      binding: (task: any) => this.markdownSync.bindingForTask(String(task.id)),
      load: async (task: any) => this.loadTaskDetails(task),
      edit: async (task: any) => this.editTaskFromSurface(task),
      moveToColumn: async (task: any, columnId: string) => this.moveTaskToBoardColumn(task, columnId),
      showCompleted: () => this.settings.plannerShowCompleted,
      preferences: () => ({ selected: this.settings.boardLastProjectId, collapsed: this.settings.boardCollapsedGroups, sidebarCollapsed: this.settings.boardSidebarCollapsed, sidebarPreferenceInitialized: this.settings.boardSidebarPreferenceInitialized }),
      savePreferences: async (value: { selected: string; collapsed: string[]; sidebarCollapsed: boolean; sidebarPreferenceInitialized?: boolean }) => { this.settings.boardLastProjectId = value.selected; this.settings.boardCollapsedGroups = value.collapsed; this.settings.boardSidebarCollapsed = value.sidebarCollapsed; this.settings.boardSidebarPreferenceInitialized = value.sidebarPreferenceInitialized ?? true; await this.saveSettings(); },
    };
  }

  private async importTaggedCheckboxes(file: TFile, quiet = false) {
    const tag = this.settings.checkboxImportTag.trim().replace(/^#/, "") || "ticktick";
    const tagPattern = new RegExp(`(^|\\s)#${escapeRegExp(tag)}(?=\\s|$)`, "i");
    const markerPattern = /\s*<!--\s*ticktick-bridge:([^\s>]+)\s*-->/i;
    const original = await this.app.vault.read(file);
    const lines = original.split(/\r?\n/);
    let changed = false;
    let imported = 0;
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index];
      const task = line.match(/^(\s*(?:[-*+] |\d+\. )\[ \]\s+)(.+)$/);
      if (!task || !tagPattern.test(task[2]) || markerPattern.test(task[2])) continue;
      const scheduled = checkboxSchedule(task[2].replace(tagPattern, "$1"), todayInZone(this.settings.timeZone));
      const title = scheduled.title;
      if (!title) continue;
      const marker = crypto.randomUUID();
      const projectId = scheduled.dueDate ? await this.scheduledCheckboxProjectId() : "inbox";
      const payload = toTaskPayload({ title, projectId, dueDate: scheduled.dueDate }, this.settings.timeZone);
      await this.createTask(payload);
      lines[index] = `${line} <!-- ticktick-bridge:${marker} -->`;
      changed = true;
      imported++;
    }
    if (changed) await this.app.vault.modify(file, lines.join("\n"));
    if (imported && !quiet) new Notice(`${imported} چک‌باکس به TickTick اضافه شد.`);
    return imported;
  }

  private async scheduledCheckboxProjectId() {
    if (this.settings.scheduledCheckboxProjectId) return this.settings.scheduledCheckboxProjectId;
    const cached = this.cache.tasks.find(task => String(task.projectName ?? "").trim() === "اقدام" && task.projectId);
    if (cached?.projectId) return cached.projectId;
    const projects = await this.client().listProjects();
    const action = projects.find((project: { name?: string }) => String(project.name ?? "").trim() === "اقدام");
    if (!action?.id) throw new Error("لیست «اقدام» در TickTick پیدا نشد.");
    this.settings.scheduledCheckboxProjectId = action.id;
    await this.saveSettings();
    return action.id;
  }

  configureAutomaticSync() {
    if (this.syncTimer !== null) window.clearTimeout(this.syncTimer);
    this.syncTimer = null;
    const seconds = Number(this.settings.syncIntervalSeconds);
    const legacyMinutes = Number(this.settings.syncIntervalMinutes);
    const delay = Number.isFinite(seconds) && seconds >= 30 ? seconds * 1_000 : Number.isFinite(legacyMinutes) && legacyMinutes >= 1 ? legacyMinutes * 60_000 : 0;
    if (!delay) return;
    this.syncTimer = window.setTimeout(async () => {
      this.syncTimer = null;
      try {
        await this.syncNow({ quiet: true, scheduled: true });
      } finally {
        // Start the next countdown only after this sync attempt has ended.
        this.configureAutomaticSync();
      }
    }, delay);
  }

  configureRibbonIcons() {
    this.ribbonIcons.forEach(icon => icon.remove());
    this.ribbonIcons = [];
    if (!this.settings.showRibbonIcons) return;
    this.ribbonIcons.push(
      this.addRibbonIcon("check-square", "TickTick Bridge: تسک‌های امروز", () => this.openTodayView()),
      this.addRibbonIcon("activity", "TickTick Bridge: عادت‌های امروز", () => this.openHabitView()),
    );
  }

  configureSyncRibbonIcon() {
    this.syncRibbonIcon?.remove();
    this.syncRibbonIcon = this.addRibbonIcon("arrow-down-up", "TickTick Bridge: همگام‌سازی با TickTick", () => void this.syncNow());
    this.syncRibbonIcon.addClass("ticktick-bridge-sync-ribbon");
    this.setSyncRibbonState(false);
  }

  configurePanelMenuRibbonIcon() {
    this.panelMenuRibbonIcon?.remove();
    this.panelMenuRibbonIcon = this.addRibbonIcon("layout-dashboard", "TickTick Bridge: باز کردن پنل‌ها", event => this.showPanelMenu(event));
    this.panelMenuRibbonIcon.addClass("ticktick-bridge-panel-menu-ribbon");
  }

  private showPanelMenu(event: MouseEvent) {
    const menu = new Menu();
    menu.addItem(item => item.setTitle("تسک‌های امروز").setIcon("check-square").onClick(() => void this.openTodayView()));
    menu.addItem(item => item.setTitle("عادت‌های امروز").setIcon("activity").onClick(() => void this.openHabitView()));
    menu.addItem(item => item.setTitle("تقویم و برنامهٔ هفتگی").setIcon("calendar-days").onClick(() => void this.openPlannerView()));
    menu.addItem(item => item.setTitle("برد پروژه‌ها").setIcon("kanban-square").onClick(() => void this.openProjectBoardView()));
    menu.addSeparator();
    menu.addItem(item => item.setTitle("مرکز همگام‌سازی و تعارض‌ها").setIcon("arrow-down-up").onClick(() => void this.openControlPage("sync")));
    menu.addItem(item => item.setTitle("پیش‌نمایش انتقال TickTick Notes").setIcon("file-down").onClick(() => void this.openControlPage("notes")));
    menu.addItem(item => item.setTitle("Checklistهای task (فقط‌خواندنی)").setIcon("list-checks").onClick(() => void this.openControlPage("checklists")));
    menu.addItem(item => item.setTitle("آخرین گزارش و backup").setIcon("shield-check").onClick(() => void this.openControlPage("reports")));
    menu.showAtMouseEvent(event);
  }

  private setSyncRibbonState(syncing: boolean) {
    if (!this.syncRibbonIcon) return;
    setIcon(this.syncRibbonIcon, syncing ? "loader-circle" : "arrow-down-up");
    this.syncRibbonIcon.toggleClass("is-syncing", syncing);
    this.syncRibbonIcon.setAttribute("aria-label", syncing ? "TickTick Bridge: در حال همگام‌سازی…" : "TickTick Bridge: همگام‌سازی با TickTick");
  }

  async syncNow({ quiet = false, scheduled = false }: { quiet?: boolean; scheduled?: boolean } = {}) {
    // An interval may fire again while a slow TickTick request is still in
    // flight.  Allowing those runs to overlap can apply an older response
    // after a newer one and needlessly redraw the page.
    if (this.syncInProgress) {
      if (!quiet) new Notice("همگام‌سازی TickTick همین حالا در حال انجام است.");
      return;
    }
    if (Date.now() < this.rateLimitedUntil) {
      if (!quiet) new Notice(`TickTick موقتاً درخواست‌ها را محدود کرده است. ارسال تغییرهای صف‌شده حدود ${this.rateLimitWaitSeconds()} ثانیهٔ دیگر دوباره تلاش می‌شود.`);
      return;
    }
    this.syncInProgress = true;
    this.setSyncRibbonState(true);
    try {
      const day = todayInZone(this.settings.timeZone);
      // A queued write that is being rate-limited must not be followed by a
      // second burst of project-data reads. The optimistic cache is already
      // current for the user action, so leave it visible and retry later.
      const pendingFlushed = await this.flushPendingMutations();
      if (!pendingFlushed) {
        if (!quiet) new Notice("تغییرها در صف امن همگام‌سازی ماندند؛ TickTick فعلاً درخواست تازه نمی‌پذیرد.");
        return;
      }
      const refreshed = await this.refreshCacheFromTickTick(day, !scheduled);
      const tasks = this.cachedTasksForDay(day);
      const habits = this.cachedHabitsForDay(day);
      await this.refreshLocalSurfaces();
      if (!quiet && refreshed.remote) {
        const notes = this.cache.tasks.filter(task => String(task.kind ?? "").toUpperCase() === "NOTE").length;
        new Notice(`همگام‌سازی کامل شد: ${this.cache.projects.length} لیست، ${this.cache.tasks.length} رکورد (${notes} Note) و ${habits.length} عادت امروز.`);
      } else if (!quiet) {
        new Notice("نسخهٔ محلی آماده است؛ TickTick دادهٔ تازه‌ای برنگرداند. اتصال وب را در تنظیمات بررسی کن.");
      }
    } catch (error) {
      if (this.isRateLimitError(error)) {
        this.deferForRateLimit(error);
        await this.saveSettings();
      }
      if (!quiet) new Notice(error instanceof Error ? error.message : "همگام‌سازی TickTick ناموفق بود.");
    } finally {
      this.setSyncRibbonState(false);
      this.syncInProgress = false;
      if (!scheduled) this.configureAutomaticSync();
    }
  }

  private hasCache() { return Boolean(this.cache.savedAt); }

  /** Re-render every open local surface after a cache mutation. This deliberately
   * performs no TickTick request, so a drag in week/month is immediately
   * reflected in daily-note blocks, boards and other open views. */
  private async refreshLocalSurfaces() {
    this.habitCheckinCache.clear();
    for (const [element, day] of this.taskBlocks) {
      if (!element.isConnected) {
        this.taskBlocks.delete(element);
        this.taskBlockSignatures.delete(element);
        continue;
      }
      const signature = this.taskBlockSignature(day);
      if (this.taskBlockSignatures.get(element) !== signature) {
        await this.renderTodayBlock(element, day);
        this.taskBlockSignatures.set(element, signature);
      }
    }
    for (const [element, context] of this.habitBlocks) {
      if (!element.isConnected) {
        this.habitBlocks.delete(element);
        this.habitBlockSignatures.delete(element);
        this.dashboardStates.delete(element);
        continue;
      }
      const signature = this.habitBlockSignature(element, context);
      if (this.habitBlockSignatures.get(element) !== signature) {
        await this.renderHabitBlock(element, context.dashboard, context.day);
        this.habitBlockSignatures.set(element, signature);
      }
    }
    for (const type of [VIEW_TYPE, HABIT_VIEW_TYPE, PLANNER_VIEW_TYPE, PROJECT_BOARD_VIEW_TYPE]) {
      for (const leaf of this.app.workspace.getLeavesOfType(type)) {
        const view = leaf.view as unknown as { render?: () => Promise<void> | void };
        if (typeof view.render === "function") await view.render();
      }
    }
  }

  private taskBlockSignature(day?: string) {
    const targetDay = day ?? todayInZone(this.settings.timeZone);
    return JSON.stringify(this.cachedTasksForDay(targetDay));
  }

  private habitBlockSignature(element: HTMLElement, context: { dashboard: boolean; day?: string }) {
    const today = todayInZone(this.settings.timeZone);
    const state = context.dashboard ? this.dashboardStates.get(element) ?? { day: context.day ?? today, mode: "day" as DashboardMode } : null;
    const day = state?.day ?? context.day ?? today;
    const historyDays = state?.mode === "week" ? 7 : state?.mode === "month" ? 30 : state?.mode === "stats" ? 28 : 1;
    const habits = context.dashboard ? this.cachedHabitsWithHistory(day, historyDays) : this.cachedHabitsForDay(day);
    return JSON.stringify({ day, mode: state?.mode, habits });
  }

  cacheSnapshotTime() {
    if (!this.cache.savedAt) return "";
    const value = new Date(this.cache.savedAt);
    return Number.isNaN(value.getTime()) ? "" : new Intl.DateTimeFormat("fa-IR-u-ca-persian", { dateStyle: "medium", timeStyle: "short" }).format(value);
  }

  cacheConflictCount() { return this.cache.conflicts.length; }

  private async refreshCacheFromTickTick(today: string, hydrateHabits = false) {
    const client = this.client();
    const cacheAvailable = this.hasCache();
    // Once a full mirror exists, the web batch feed is sufficient for normal
    // task refreshes. Re-reading projects, habits and sections through the
    // token API every 30 seconds is both redundant and likely to trigger a
    // 429. The token API remains the source for first-run hydration and all
    // mutations, while the visible cache stays usable if the web feed is
    // unavailable for a moment.
    const webTasks = await this.webOpenTasks();
    const projects = cacheAvailable ? this.cache.projects : await client.listProjects();
    let habits = (!cacheAvailable || hydrateHabits) ? await client.listHabits() : this.cache.habits;
    const sections = cacheAvailable ? [] : await client.listHabitSections();
    const projectBoards: Record<string, any> = {};
    const taskIndex = new Map<string, any>();
    // The web batch endpoint is the compact, current task feed. Calling
    // `/project/:id/data` for every project in parallel trips TickTick's rate
    // limiter, then leaves every surface waiting for a refresh that cannot
    // finish. Keep the cached project documents as board metadata and hydrate
    // only a genuinely missing document, one per sync.
    for (const task of this.cache.tasks) {
      const key = `${String(task?.projectId ?? "")}:${String(task?.id ?? "")}`;
      if (task?.id) taskIndex.set(key, task);
    }
    for (const project of projects) {
      const projectId = String(project.id);
      const cachedBoard = this.cache.projectBoards[projectId];
      if (!cachedBoard) continue;
      const board = { ...cachedBoard, project: { ...cachedBoard.project, ...project } };
      projectBoards[projectId] = board;
      for (const task of board.tasks ?? []) {
        const key = `${String(task?.projectId ?? projectId)}:${String(task?.id ?? "")}`;
        if (task?.id) taskIndex.set(key, mergeTaskDetails(task, taskIndex.get(key)));
      }
    }
    const missingProject = projects.find((project: any) => !projectBoards[String(project.id)]);
    if (missingProject) {
      const board = normalizeProjectData(await client.getProjectData(missingProject.id), missingProject);
      projectBoards[String(board.project.id)] = board;
      for (const task of board.tasks) {
        const key = `${String(task?.projectId ?? missingProject.id)}:${String(task?.id ?? "")}`;
        taskIndex.set(key, mergeTaskDetails(taskIndex.get(key), task));
      }
    }
    // Inbox is not returned by the official project list, but it is a normal
    // TickTick task container. Hydrate it once into the private mirror so the
    // board's «ورودی» item is backed by real tasks, not an empty placeholder.
    if (!projectBoards.inbox && !this.cache.tasks.some(task => String(task?.projectId ?? "").toLowerCase() === "inbox")) {
      try {
        const inbox = normalizeProjectData(await client.getProjectData("inbox"), { id: "inbox", name: "ورودی" });
        // The API's Inbox tasks carry an account-specific project id (for
        // example `inbox115…`), not the literal endpoint id `inbox`. Keep
        // that real id for complete/update calls, but mark membership so the
        // synthetic Inbox board can recognise and retain its cards.
        inbox.tasks = inbox.tasks.map((task: any) => ({ ...task, isInbox: true, projectName: "ورودی" }));
        projectBoards.inbox = inbox;
        for (const task of inbox.tasks) taskIndex.set(`${String(task.projectId ?? "inbox")}:${String(task.id ?? "")}`, task);
      } catch {
        // Some accounts expose Inbox only from the web batch feed. It remains
        // safe to continue and populate it from that feed when available.
      }
    }
    for (const task of webTasks ?? []) {
      const projectId = String(task.projectId ?? ""); const key = `${projectId}:${task.id}`;
      const prior = taskIndex.get(key);
      taskIndex.set(key, prior ? mergeTaskDetails(prior, task) : task);
    }
    const tasks = [...taskIndex.values()];
    // Board columns come from the cached project document, while task values
    // come from the fresh batch feed. Recompose them before rendering so a
    // normal sync never displays an old card after a local mutation.
    for (const [projectId, board] of Object.entries(projectBoards)) {
      const prior = new Map<string, any>((board.tasks ?? []).map((task: any) => [String(task.id), task]));
      board.tasks = tasks
        .filter(task => projectId === "inbox" ? Boolean(task.isInbox) : String(task?.projectId ?? "") === projectId)
        .map(task => mergeTaskDetails(prior.get(String(task.id)), task));
    }
    const activeHabits = habits.filter((habit: { status?: number }) => habit.status === undefined || habit.status === 0);
    const fromDay = shiftIsoDay(today, -90);
    // The cache already holds the history. Avoid an additional token API read
    // during normal refreshes; the web endpoint below updates the recent
    // check-ins and is intentionally best-effort.
    const officialDocuments = !cacheAvailable && activeHabits.length ? await client.getHabitCheckins(activeHabits.map((habit: { id: string }) => habit.id), fromDay, today) : [];
    const checkins: Record<string, CachedHabitCheckin[]> = { ...this.cache.habitCheckins };
    for (const document of officialDocuments ?? []) {
      const habitId = String(document?.habitId ?? "");
      if (!habitId) continue;
      checkins[habitId] = (document.checkins ?? []).map((entry: any) => ({ stamp: Number(entry.stamp), value: Number(entry.value ?? 0), goal: Number(entry.goal ?? 1), status: Number(entry.status ?? 0) }));
    }
    // The web feed is the most up-to-date source for today's habit state.
    const webCheckins = await this.webHabitCheckins(activeHabits.map((habit: { id: string }) => habit.id), today, 91);
    if (webCheckins) for (const [habitId, entries] of webCheckins) checkins[habitId] = entries;
    // The habit check-in record carries TickTick's current goal. Prefer that
    // fresh value over a stale cache so a 3-step habit is never written back
    // as 2 steps by a subsequent local check-in.
    if (webCheckins) {
      habits = habits.map((habit: any) => {
        const recent = (webCheckins.get(String(habit.id)) ?? []).at(-1);
        const goal = Number(recent?.goal ?? 0);
        return goal > 0 ? { ...habit, goal } : habit;
      });
    }
    const sectionNames = new Map(sections.map((section: { id: string; name: string }) => [section.id, section.name]));
    this.cache = {
      savedAt: new Date().toISOString(),
      tasks,
      projects,
      projectBoards,
      habits: activeHabits.map((habit: any) => ({ ...habit, sectionName: sectionNames.get(habit.sectionId) ?? habit.sectionName ?? "بدون دسته" })),
      habitCheckins: checkins,
      pending: this.cache.pending,
      conflicts: this.cache.conflicts,
      rateLimitedUntil: 0,
    };
    this.rateLimitedUntil = 0;
    await this.saveSettings();
    return { remote: webTasks !== null || webCheckins !== null || !cacheAvailable };
  }

  private async runMutation(type: PendingMutation["type"], payload: any) {
    const operation = { id: crypto.randomUUID(), type, payload, queuedAt: new Date().toISOString() } as PendingMutation;
    const execute = async () => {
      const client = this.client();
      if (type === "create") return client.createTask(payload);
      if (type === "update") return client.updateTask(payload);
      if (type === "complete") return client.completeTask(payload.projectId, payload.id);
      if (type === "delete") return client.deleteTask(payload.projectId, payload.id);
      return client.checkInHabit(payload.habitId, payload.day, payload.checkin);
    };
    const applyLocal = () => {
      if (type === "create") {
        const task = { ...payload, id: `offline-${operation.id}`, status: 0 };
        this.cache.tasks.push(task);
        const board = this.cache.projectBoards[String(task.projectId ?? "")];
        if (board) board.tasks = [...(board.tasks ?? []), task];
      }
      if (type === "update") {
        this.cache.tasks = this.cache.tasks.map(task => task.id === payload.id ? { ...task, ...payload } : task);
        for (const board of Object.values(this.cache.projectBoards)) board.tasks = (board.tasks ?? []).map((task: any) => task.id === payload.id ? { ...task, ...payload } : task);
      }
      if (type === "complete" || type === "delete") {
        this.cache.tasks = this.cache.tasks.filter(task => task.id !== payload.id);
        for (const board of Object.values(this.cache.projectBoards)) board.tasks = (board.tasks ?? []).filter((task: any) => task.id !== payload.id);
      }
      if (type === "habit") {
        const stamp = Number(String(payload.day).replaceAll("-", ""));
        const previous = this.cache.habitCheckins[payload.habitId] ?? [];
        this.cache.habitCheckins[payload.habitId] = [...previous.filter(entry => entry.stamp !== stamp), { stamp, ...payload.checkin }];
      }
    };
    if (!navigator.onLine) {
      this.cache.pending.push(operation);
      applyLocal();
      await this.saveSettings();
      await this.refreshLocalSurfaces();
      new Notice("آفلاین هستی؛ تغییر در صف همگام‌سازی ذخیره شد.");
      return { queued: true };
    }
    if (Date.now() < this.rateLimitedUntil) {
      this.cache.pending.push(operation);
      applyLocal();
      await this.saveSettings();
      await this.refreshLocalSurfaces();
      new Notice(`TickTick موقتاً محدودیت گذاشته است؛ تغییر محلی حفظ شد و حدود ${this.rateLimitWaitSeconds()} ثانیهٔ دیگر خودکار ارسال می‌شود.`);
      return { queued: true };
    }
    try {
      const result = await execute();
      applyLocal();
      await this.saveSettings();
      await this.refreshLocalSurfaces();
      return { queued: false, result };
    } catch (error) {
      const status = Number((error as { status?: number })?.status ?? 0);
      // A 429 is temporary, not a conflict. Preserve the visible optimistic
      // change and send it after the server's retry window instead of making
      // calendar drag-and-drop look like it failed.
      if (status === 429) this.deferForRateLimit(error);
      else if (status > 0 && status < 500) throw error;
      this.cache.pending.push(operation);
      applyLocal();
      await this.saveSettings();
      await this.refreshLocalSurfaces();
      new Notice(status === 429
        ? `TickTick موقتاً محدودیت گذاشته است؛ تغییر محلی حفظ شد و حدود ${this.rateLimitWaitSeconds()} ثانیهٔ دیگر خودکار ارسال می‌شود.`
        : "اتصال TickTick برقرار نیست؛ تغییر در صف همگام‌سازی ذخیره شد.");
      return { queued: true };
    }
  }

  private async flushPendingMutations() {
    if (!this.cache.pending.length || !navigator.onLine) return true;
    const remaining: PendingMutation[] = [];
    for (let index = 0; index < this.cache.pending.length; index++) {
      const operation = this.cache.pending[index];
      try {
        const client = this.client();
        if (operation.type === "create") await client.createTask(operation.payload);
        else if (operation.type === "update") await client.updateTask(operation.payload);
        else if (operation.type === "complete") await client.completeTask(operation.payload.projectId, operation.payload.id);
        else if (operation.type === "delete") await client.deleteTask(operation.payload.projectId, operation.payload.id);
        else await client.checkInHabit(operation.payload.habitId, operation.payload.day, operation.payload.checkin);
      } catch (error) {
        const status = Number((error as { status?: number })?.status ?? 0);
        // 4xx means the remote item changed or disappeared. Keep a recoverable
        // record instead of overwriting the remote version silently.
        if (status > 0 && status < 500 && status !== 429) {
          this.cache.conflicts.push(operation);
          new Notice("یک تغییر آفلاین با نسخهٔ TickTick تداخل داشت و ارسال نشد.");
        } else {
          if (status === 429) this.deferForRateLimit(error);
          remaining.push(...this.cache.pending.slice(index));
          this.cache.pending = remaining;
          await this.saveSettings();
          return false;
        }
      }
    }
    this.cache.pending = remaining;
    await this.saveSettings();
    return true;
  }

  private isRateLimitError(error: unknown) {
    return Number((error as { status?: number })?.status ?? 0) === 429;
  }

  private deferForRateLimit(error: unknown) {
    const requestedSeconds = Number((error as { retryAfter?: number })?.retryAfter ?? 0);
    // Some TickTick routes omit Retry-After. A one-minute pause avoids a
    // retry storm while keeping the local queue responsive.
    const seconds = Number.isFinite(requestedSeconds) && requestedSeconds > 0 ? Math.min(Math.ceil(requestedSeconds), 600) : 60;
    this.rateLimitedUntil = Math.max(this.rateLimitedUntil, Date.now() + seconds * 1_000);
    this.cache.rateLimitedUntil = this.rateLimitedUntil;
  }

  private rateLimitWaitSeconds() {
    return Math.max(1, Math.ceil((this.rateLimitedUntil - Date.now()) / 1_000));
  }

  async createTask(task: Partial<TickTickTask>) { return this.runMutation("create", task); }
  async updateTask(task: Partial<TickTickTask>) { return this.runMutation("update", task); }
  async completeTask(task: TickTickTask | { id: string; [key: string]: unknown }) { return this.runMutation("complete", task); }
  async deleteTask(task: TickTickTask | { id: string; [key: string]: unknown }) { return this.runMutation("delete", task); }
  async checkInHabit(habitId: string, day: string, checkin: any) { return this.runMutation("habit", { habitId, day, checkin }); }
  async createTaskFromSurface(initial: TaskDraft = {}) {
    const projects = await this.client().listProjects();
    const draft = await openTaskEditor(this.app, projects, initial);
    if (!draft) return null;
    return this.createTask(toTaskPayload(draft, this.settings.timeZone));
  }
  async loadTaskDetails(task: TickTickTask): Promise<TickTickTask | undefined> {
    const cached = this.cache.tasks.find(item => String(item?.id) === String(task?.id) && String(item?.projectId ?? "") === String(task?.projectId ?? ""));
    if (cached && taskDescription(cached)) return mergeTaskDetails(task, cached) as TickTickTask;
    const projectId = String(task?.projectId ?? "");
    if (!projectId || !task?.id) return task;
    const client = this.client();
    let direct = task;
    try { direct = await client.getTask(projectId, String(task.id)); } catch { /* Notes may not support the task-detail route. */ }
    if (taskDescription(direct)) return direct;
    // Notes can be returned without their content by the single-task endpoint.
    // The project document contains the full record in that case.
    try {
      const project = await client.getProjectData(projectId);
      const record = (project?.tasks ?? []).find((item: any) => String(item?.id) === String(task.id));
      return (record ? mergeTaskDetails(direct, record) : direct) as TickTickTask;
    } catch { return direct; }
  }
  async editTaskFromSurface(task: TickTickTask) {
    const current = (await this.loadTaskDetails(task)) ?? task;
    const projects = await this.client().listProjects();
    const draft = await openTaskEditor(this.app, projects, current);
    if (!draft) return null;
    const payload = toTaskPayload({ ...current, ...draft }, this.settings.timeZone);
    await this.updateTask(payload);
    return { ...current, ...payload };
  }
  private async rescheduleTaskFromPlanner(task: any, targetDay: string) {
    const start = toDateKey(task?.startDate, task?.timeZone || this.settings.timeZone);
    const due = toDateKey(task?.dueDate, task?.timeZone || this.settings.timeZone);
    const anchor = start ?? due;
    if (!anchor) throw new Error("تسک تاریخ قابل‌جابه‌جایی ندارد.");
    const offset = Math.round((Date.parse(`${targetDay}T12:00:00Z`) - Date.parse(`${anchor}T12:00:00Z`)) / 86400000);
    const moveValue = (value: any, fallback: string | null) => {
      if (!fallback) return null;
      const original = String(value ?? "");
      const moved = shiftIsoDay(fallback, offset);
      return original.includes("T") ? `${moved}${original.slice(10)}` : `${moved}T00:00:00+0330`;
    };
    const payload = toTaskPayload({ ...task, dueDate: due ? shiftIsoDay(due, offset) : null }, this.settings.timeZone);
    payload.startDate = moveValue(task.startDate, start);
    payload.dueDate = moveValue(task.dueDate, due);
    payload.isAllDay = task.isAllDay ?? !String(task.dueDate ?? task.startDate ?? "").includes("T");
    await this.updateTask(payload);
    return { ...task, ...payload };
  }
  private async moveTaskToBoardColumn(task: any, columnId: string) {
    if (!columnId) throw new Error("ستون مقصد برای انتقال قابل‌استفاده نیست.");
    if (String(task.columnId ?? "") === columnId) return task;
    const payload = toTaskPayload({ ...task, columnId }, this.settings.timeZone);
    await this.updateTask(payload);
    return { ...task, ...payload };
  }

  private cachedTasksForDay(day: string) {
    return this.cache.tasks.filter(task => isScheduledForDay(task, day));
  }

  private cachedHabitsForDay(day: string) {
    const stamp = Number(day.replaceAll("-", ""));
    return this.cache.habits.filter(habit => isHabitScheduledForCachedDay(habit, day)).map(habit => ({
      ...habit,
      checkin: (this.cache.habitCheckins[habit.id] ?? []).find(entry => entry.stamp === stamp) ?? null,
    }));
  }

  private cachedHabitsWithHistory(day: string, days: number) {
    const start = shiftIsoDay(day, -Math.max(0, days - 1));
    const dates = Array.from({ length: days }, (_, index) => shiftIsoDay(start, index));
    const stamp = Number(day.replaceAll("-", ""));
    return this.cache.habits.map(habit => {
      const goal = Math.max(1, Number(habit.goal ?? 1));
      const entries = this.cache.habitCheckins[habit.id] ?? [];
      return {
        ...habit,
        checkin: entries.find(entry => entry.stamp === stamp) ?? null,
        history: dates.filter(date => isHabitScheduledForCachedDay(habit, date)).map(date => {
          const entry = entries.find(value => value.stamp === Number(date.replaceAll("-", "")));
          const value = Number(entry?.value ?? 0);
          return { date, value, completed: entry?.status === 2 || value >= goal };
        }),
      };
    });
  }

  /** Load one habit's requested calendar range on demand. This keeps routine
   * sync cache-first, while month navigation can safely fetch older history. */
  private async habitHistoryRange(habitId: string, from: string, to: string) {
    const habit = this.cache.habits.find(item => String(item.id) === habitId);
    if (!habit) return [];
    let entries = this.cache.habitCheckins[habitId] ?? [];
    if (navigator.onLine && Date.now() >= this.rateLimitedUntil) {
      try {
        const documents = await this.client().getHabitCheckins([habitId], from, to);
        const remote = (documents ?? []).find((document: any) => String(document?.habitId) === habitId)?.checkins ?? [];
        if (remote.length || entries.length) {
          const byStamp = new Map(entries.map(entry => [Number(entry.stamp), entry]));
          for (const entry of remote) byStamp.set(Number(entry.stamp), { stamp: Number(entry.stamp), value: Number(entry.value ?? 0), goal: Number(entry.goal ?? habit.goal ?? 1), status: Number(entry.status ?? 0) });
          entries = [...byStamp.values()];
          this.cache.habitCheckins[habitId] = entries;
          await this.saveSettings();
        }
      } catch {
        // Cached history is still valuable when TickTick is temporarily busy.
      }
    }
    const dates: string[] = [];
    for (let day = from; day <= to; day = shiftIsoDay(day, 1)) dates.push(day);
    const goal = Math.max(1, Number(habit.goal ?? habit.target ?? 1));
    return dates.filter(day => isHabitScheduledForCachedDay(habit, day)).map(day => {
      const entry = entries.find(item => Number(item.stamp) === Number(day.replaceAll("-", "")));
      const value = Number(entry?.value ?? 0);
      return { date: day, value, completed: Number(entry?.status ?? 0) === 2 || value >= goal };
    });
  }

  private cachedHabitHistoryRange(habitId: string, from: string, to: string) {
    const habit = this.cache.habits.find(item => String(item.id) === habitId);
    if (!habit) return [];
    const entries = this.cache.habitCheckins[habitId] ?? [];
    const dates: string[] = [];
    for (let day = from; day <= to; day = shiftIsoDay(day, 1)) dates.push(day);
    const goal = Math.max(1, Number(habit.goal ?? habit.target ?? 1));
    return dates.filter(day => isHabitScheduledForCachedDay(habit, day)).map(day => {
      const entry = entries.find(item => Number(item.stamp) === Number(day.replaceAll("-", "")));
      const value = Number(entry?.value ?? 0);
      return { date: day, value, completed: Number(entry?.status ?? 0) === 2 || value >= goal };
    });
  }

  private async loadHabitDetails(habit: any) {
    if (!habit?.id || !navigator.onLine || Date.now() < this.rateLimitedUntil) return habit;
    const fresh = await this.client().getHabit(String(habit.id));
    if (fresh && typeof fresh === "object") {
      this.cache.habits = this.cache.habits.map(item => String(item.id) === String(habit.id) ? { ...item, ...fresh } : item);
      await this.saveSettings();
    }
    return fresh;
  }

  client() {
    if (!this.settings.apiToken.trim()) throw new Error("ابتدا API Token را در تنظیمات TickTick Bridge وارد کن.");
    return new TickTickClient({
      token: this.settings.apiToken,
      transport: async (url, init) => {
        const response = await requestUrl({ url, method: init.method, headers: init.headers, body: init.body, throw: false });
        return { status: response.status, text: response.text, headers: response.headers };
      },
    });
  }

  /**
   * TickTick's documented token API can lag behind the web app for current
   * habit check-ins.  If the user has opted in with their web-session cookie,
   * use the same read-only check-in feed that the web app reads.
   */
  /**
   * Imports the already-authenticated private TickTick session maintained by
   * TickTickSync.  The password is never read or stored by this plugin.
   */
  async importTickTickSyncSession() {
    const legacyPath = ".obsidian/plugins/tickticksync/data.json";
    try {
      const raw = await this.app.vault.adapter.read(legacyPath);
      const legacy = JSON.parse(raw) as { token?: unknown };
      const token = String(legacy.token ?? "").trim();
      if (!token) throw new Error("نشست فعالی در TickTickSync پیدا نشد. ابتدا یک‌بار در آن افزونه وارد TickTick شو.");
      this.settings.webSessionToken = token;
      this.settings.webSessionCookie = normalizeWebSessionCookie(window.localStorage.getItem("TTS_Cookies") ?? "");
      this.settings.webSessionDeviceId ||= crypto.randomUUID().replaceAll("-", "").slice(0, 24);
      await this.saveSettings();
      return { hasCookie: Boolean(this.settings.webSessionCookie) };
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("نشست فعالی")) throw error;
      throw new Error("تنظیمات TickTickSync خوانده نشد. مطمئن شو افزونه هنوز نصب است و یک‌بار در آن وارد شده‌ای.");
    }
  }

  private webDeviceAgent() {
    const id = this.settings.webSessionDeviceId || crypto.randomUUID().replaceAll("-", "").slice(0, 24);
    return JSON.stringify({
      platform: "web",
      os: currentPlatformName(),
      device: currentPlatformName(),
      name: "",
      version: 6070,
      id,
      channel: "website",
      campaign: "",
      websocket: "",
    });
  }

  /** Signs in directly with TickTick's web endpoint; credentials stay in memory only. */
  async loginToTickTickWeb(username: string, password: string) {
    const cleanUsername = username.trim();
    if (!cleanUsername || !password) throw new Error("نام کاربری و رمز عبور را وارد کن.");
    const deviceId = this.settings.webSessionDeviceId || crypto.randomUUID().replaceAll("-", "").slice(0, 24);
    this.settings.webSessionDeviceId = deviceId;
    const origin = "https://ticktick.com";
    const response = await requestUrl({
      url: `${origin}/api/v2/user/signon?wc=true&remember=true`,
      method: "POST",
      headers: {
        Accept: "*/*",
        "x-device": this.webDeviceAgent(),
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest",
        Origin: origin,
        Referer: `${origin}/signin`,
      },
      body: JSON.stringify({ username: cleanUsername, password }),
      throw: false,
    });
    const body = response.json as { token?: unknown } | undefined;
    const token = String(body?.token ?? "").trim();
    if (response.status < 200 || response.status >= 300 || !token) throw new Error("ورود TickTick ناموفق بود. نام کاربری، رمز عبور یا تأیید امنیتی را بررسی کن.");
    const receivedCookie = response.headers?.["set-cookie"] ?? response.headers?.["Set-Cookie"] ?? "";
    this.settings.webSessionToken = token;
    this.settings.webSessionCookie = normalizeWebSessionCookie(Array.isArray(receivedCookie) ? receivedCookie.join("; ") : receivedCookie);
    await this.saveSettings();
  }

  async webHabitCheckins(habitIds: string[], day: string, historyDays = 1) {
    const token = this.settings.webSessionToken.trim();
    const cookie = normalizeWebSessionCookie(this.settings.webSessionCookie);
    if ((!token && !cookie) || !habitIds.length) return null;
    const afterDay = shiftIsoDay(day, -Math.max(1, historyDays));
    const sessionCookie = token ? `t=${token};${cookie ? ` ${cookie}` : ""}` : cookie;
    try {
      const response = await requestUrl({
        url: "https://api.ticktick.com/api/v2/habitCheckins/query",
        method: "POST",
        headers: {
          Cookie: sessionCookie,
          ...(token ? { t: token } : {}),
          "Content-Type": "application/json",
          "x-device": this.webDeviceAgent(),
        },
        body: JSON.stringify({ habitIds, afterStamp: Number(afterDay.replaceAll("-", "")) }),
        throw: false,
      });
      if (response.status < 200 || response.status >= 300) return null;
      return parseWebHabitCheckins(JSON.parse(response.text || "{}"));
    } catch { return null; }
  }

  /** The web session sees the same task collection as TickTick's Today screen,
   * including Inbox tasks that can be absent from the documented project feed. */
  private async webRequest(path: string, method = "GET", body?: unknown) {
    const token = this.settings.webSessionToken.trim();
    const cookie = normalizeWebSessionCookie(this.settings.webSessionCookie);
    if (!token && !cookie) return null;
    const sessionCookie = token ? `t=${token};${cookie ? ` ${cookie}` : ""}` : cookie;
    try {
      const response = await requestUrl({
        url: `https://api.ticktick.com/api/v2/${path.replace(/^\//, "")}`,
        method,
        headers: {
          Cookie: sessionCookie,
          ...(token ? { t: token } : {}),
          "Content-Type": "application/json",
          "x-device": this.webDeviceAgent(),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        throw: false,
      });
      if (response.status < 200 || response.status >= 300) return null;
      return JSON.parse(response.text || "{}");
    } catch { return null; }
  }

  async webOpenTasks(): Promise<any[] | null> {
    const document = await this.webRequest("batch/check/0");
    if (!document) return null;
    const profiles = Array.isArray(document.projectProfiles) ? document.projectProfiles : [];
    const projectNames = new Map(profiles.map((project: { id?: unknown; name?: unknown }) => [String(project.id ?? ""), String(project.name ?? "")]));
    const updates = Array.isArray(document.syncTaskBean?.update) ? document.syncTaskBean.update : [];
    return updates
      .filter((task: { id?: unknown; status?: unknown }) => Boolean(task?.id) && Number(task.status ?? 0) === 0)
      .map((task: { projectId?: unknown; projectName?: unknown }) => ({
        ...task,
        projectName: String(task.projectName ?? projectNames.get(String(task.projectId ?? "")) ?? "ورودی"),
      }));
  }

  async tasksForDay(day: string): Promise<TickTickTask[]> {
    if (this.hasCache()) return this.cachedTasksForDay(day);
    const webTasks = await this.webOpenTasks();
    if (webTasks !== null) return webTasks.filter(task => isScheduledForDay(task, day));
    return this.client().tasksForDay(day);
  }

  async recurringTasks(): Promise<TickTickTask[]> {
    if (this.hasCache()) return this.cache.tasks
      .filter(task => Boolean(task.repeatFlag) || recurringTaskKind(task) !== "other")
      .sort((left, right) => String(left.dueDate ?? "9999-12-31").localeCompare(String(right.dueDate ?? "9999-12-31")) || String(left.title ?? "").localeCompare(String(right.title ?? ""), "fa"));
    const webTasks = await this.webOpenTasks();
    if (webTasks !== null) return webTasks
      .filter(task => Boolean(task.repeatFlag) || recurringTaskKind(task) !== "other")
      .sort((left, right) => String(left.dueDate ?? "9999-12-31").localeCompare(String(right.dueDate ?? "9999-12-31")) || String(left.title ?? "").localeCompare(String(right.title ?? ""), "fa"));
    return (await this.client().listOpenTasks())
      .filter(task => Boolean(task.repeatFlag) || recurringTaskKind(task) !== "other")
      .sort((left, right) => String(left.dueDate ?? "9999-12-31").localeCompare(String(right.dueDate ?? "9999-12-31")) || String(left.title ?? "").localeCompare(String(right.title ?? ""), "fa"));
  }

  async openTodayView() {
    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.setViewState({ type: VIEW_TYPE, active: true });
  }

  async openHabitView() {
    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.setViewState({ type: HABIT_VIEW_TYPE, active: true });
  }

  async openPlannerView() {
    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.setViewState({ type: PLANNER_VIEW_TYPE, active: true });
  }

  async openProjectBoardView() {
    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.setViewState({ type: PROJECT_BOARD_VIEW_TYPE, active: true });
  }

  async openControlPage(screen: ControlScreen) {
    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.setViewState({ type: CONTROL_VIEW_TYPE, active: true, state: { screen } });
  }

  async renderTodayBlock(element: HTMLElement, dayOverride?: string) {
    element.replaceChildren();
    const root = element.createDiv({ cls: "daily-tasks-output ticktick-task-grid" });
    try {
      const client = this.client();
      const day = dayOverride ?? todayInZone(this.settings.timeZone);
      const toolbar = root.createDiv({ cls: "daily-task-toolbar" });
      const addButton = toolbar.createEl("button", { text: "+ افزودن تسک", cls: "daily-task-add" });
      addButton.addEventListener("click", async () => {
        addButton.disabled = true;
        try {
          const projects = await client.listProjects();
          const draft = await openTaskEditor(this.app, projects, { dueDate: day });
          if (!draft) return;
          await this.createTask(toTaskPayload(draft, this.settings.timeZone));
          new Notice("تسک به TickTick اضافه شد.");
          await this.renderTodayBlock(element, dayOverride);
        } catch (error) {
          new Notice(error instanceof Error ? error.message : "افزودن تسک ناموفق بود.");
        } finally {
          addButton.disabled = false;
        }
      });
      const tasks = await this.tasksForDay(day);
      if (!tasks.length) {
        root.createDiv({ cls: "daily-task-empty", text: "تسکی برای امروز یا قبل از آن نیست." });
        return;
      }
      const cards = root.createDiv({ cls: "ticktick-task-cards" });
      for (const task of tasks) {
        const title = cleanTaskTitle(task.title);
        const row = cards.createDiv({ cls: "daily-task-row ticktick-task-card" });
        const check = row.createEl("input", { cls: "daily-task-checkbox", type: "checkbox", attr: { "aria-label": `انجام ${title}` } });
        const body = row.createDiv({ cls: "daily-task-main" });
        body.createSpan({ cls: "daily-task-title", text: title });
        appendChecklistSummary(body, task, this.settings.experimentalChecklistReadOnly);
        const description = body.createDiv({ cls: "daily-task-description is-hidden" });
        await MarkdownRenderer.renderMarkdown(cleanTaskDescription(task.desc || task.content) || "توضیحی برای این تسک ثبت نشده است.", description, "", this);
        const due = toDateKey(task.dueDate, task.timeZone || this.settings.timeZone) ?? "";
        const start = toDateKey(task.startDate, task.timeZone || this.settings.timeZone) ?? "";
        row.createSpan({ cls: `daily-task-date${due && due < day ? " is-overdue" : ""}`, text: formatTaskSchedule(start, due, day) });
        const actions = row.createDiv({ cls: "daily-task-actions" });
        const descriptionButton = actions.createEl("button", { cls: "daily-task-action mod-icon", attr: { "aria-label": "توضیحات" } });
        setIcon(descriptionButton, "file-text");
        const edit = actions.createEl("button", { cls: "daily-task-action mod-icon", attr: { "aria-label": "ویرایش" } });
        setIcon(edit, "pencil");
        const remove = actions.createEl("button", { cls: "daily-task-action is-danger mod-icon", attr: { "aria-label": "حذف" } });
        setIcon(remove, "trash-2");
        descriptionButton.addEventListener("click", () => {
          const hidden = description.hasClass("is-hidden");
          description.toggleClass("is-hidden", !hidden);
        });
        check.addEventListener("change", async () => {
          check.disabled = true;
          try {
            await this.completeTask(task);
            new Notice("نوبت تسک در TickTick تکمیل شد.");
            await this.renderTodayBlock(element, dayOverride);
          } catch (error) {
            check.checked = false;
            check.disabled = false;
            new Notice(error instanceof Error ? error.message : "تکمیل تسک ناموفق بود.");
          }
        });
        edit.addEventListener("click", async () => {
          try {
            const projects = await client.listProjects();
            const draft = await openTaskEditor(this.app, projects, task);
            if (!draft) return;
            await this.updateTask(toTaskPayload({ ...task, ...draft }, this.settings.timeZone));
            new Notice("تسک در TickTick ویرایش شد.");
            await this.renderTodayBlock(element, dayOverride);
          } catch (error) {
            new Notice(error instanceof Error ? error.message : "ویرایش تسک ناموفق بود.");
          }
        });
        remove.addEventListener("click", async () => {
          if (!await confirmDelete(this.app, title)) return;
          try {
            await this.deleteTask(task);
            new Notice("تسک از TickTick حذف شد.");
            await this.renderTodayBlock(element, dayOverride);
          } catch (error) {
            new Notice(error instanceof Error ? error.message : "حذف تسک ناموفق بود.");
          }
        });
      }
    } catch (error) {
      root.createEl("p", { text: error instanceof Error ? error.message : "اتصال TickTick آماده نیست." });
    } finally {
      if (this.taskBlocks.has(element)) this.taskBlockSignatures.set(element, this.taskBlockSignature(dayOverride));
    }
  }

  async renderHabitBlock(element: HTMLElement, dashboard = false, dayOverride?: string) {
    element.replaceChildren();
    // Do not let an older optimistic click hide a check-in made directly in
    // TickTick. Each render is a fresh read of TickTick's current state.
    this.habitCheckinCache.clear();
    const today = todayInZone(this.settings.timeZone);
    const state = dashboard ? this.dashboardStates.get(element) ?? { day: dayOverride ?? today, mode: "day" as DashboardMode } : null;
    if (dashboard) this.dashboardStates.set(element, state!);
    const root = element.createDiv({ cls: dashboard ? `daily-habit-list ticktick-dashboard-habits ticktick-dashboard-mode-${state!.mode}` : "daily-habit-list" });
    try {
      const client = this.client();
      const day = state?.day ?? dayOverride ?? today;
      const historyDays = state?.mode === "week" ? 7 : state?.mode === "month" ? 30 : state?.mode === "stats" ? 28 : 1;
      let habits = this.hasCache()
        ? dashboard ? this.cachedHabitsWithHistory(day, historyDays) : this.cachedHabitsForDay(day)
        : dashboard ? await client.habitsWithHistory(day, historyDays) : await client.habitsForDay(day);
      const webCheckins = this.hasCache() ? null : await this.webHabitCheckins(habits.map((habit: { id: string }) => habit.id), day, historyDays);
      if (webCheckins) habits = habits.map((habit: { id: string; goal?: number; checkin?: unknown; history?: Array<{ date: string; value?: number; completed?: boolean }> }) => {
        const entries = (webCheckins.get(habit.id) ?? []) as Array<{ stamp: number; value: number; goal: number; status: number }>;
        const checkin = entries.find((entry: { stamp: number }) => entry.stamp === Number(day.replaceAll("-", ""))) ?? habit.checkin;
        const goal = Math.max(1, Number(habit.goal ?? 1));
        const history = habit.history?.map(entry => {
          const recorded = entries.find((item: { stamp: number }) => item.stamp === Number(entry.date.replaceAll("-", "")));
          if (!recorded) return entry;
          const value = Number(recorded.value ?? 0);
          return { ...entry, value, completed: recorded.status === 2 || value >= goal };
        });
        return { ...habit, checkin, ...(history ? { history } : {}) };
      });
      if (dashboard && state?.mode === "day") habits = habits.filter((habit: { history?: Array<{ date: string }> }) => habit.history?.some((entry: { date: string }) => entry.date === day));
      if (dashboard) {
        const controls = root.createDiv({ cls: "ticktick-dashboard-controls" });
        const tabs = controls.createDiv({ cls: "ticktick-dashboard-tabs" });
        const modes: Array<[DashboardMode, string]> = [["day", "روز"], ["week", "هفته"], ["month", "ماه"]];
        for (const [mode, label] of modes) {
          const button = tabs.createEl("button", { text: label, cls: mode === state!.mode ? "is-active" : "", attr: { type: "button" } });
          button.addEventListener("click", () => {
            this.dashboardStates.set(element, { ...state!, mode });
            void this.renderHabitBlock(element, true);
          });
        }
        const navigator = controls.createDiv({ cls: "ticktick-dashboard-date" });
        const previous = navigator.createEl("button", { cls: "mod-icon", attr: { type: "button", "aria-label": "روز قبل", title: "روز قبل" } });
        setIcon(previous, "chevron-left");
        const now = navigator.createEl("button", { text: "امروز", attr: { type: "button" } });
        navigator.createEl("strong", { text: new Intl.DateTimeFormat("fa-IR-u-ca-persian", { weekday: "long", year: "numeric", month: "long", day: "numeric" }).format(new Date(`${day}T12:00:00`)) });
        const next = navigator.createEl("button", { cls: "mod-icon", attr: { type: "button", "aria-label": "روز بعد", title: "روز بعد" } });
        setIcon(next, "chevron-right");
        previous.addEventListener("click", () => {
          this.dashboardStates.set(element, { ...state!, day: shiftIsoDay(day, -1) });
          void this.renderHabitBlock(element, true);
        });
        now.addEventListener("click", () => {
          this.dashboardStates.set(element, { ...state!, day: today });
          void this.renderHabitBlock(element, true);
        });
        next.addEventListener("click", () => {
          this.dashboardStates.set(element, { ...state!, day: shiftIsoDay(day, 1) });
          void this.renderHabitBlock(element, true);
        });
      }
      if (!habits.length) {
        root.createDiv({ cls: "daily-habit-empty", text: "عادتی برای امروز در TickTick نیست." });
        return;
      }
      if (dashboard) habits.sort((left: any, right: any) => habitDashboardGroup(left).localeCompare(habitDashboardGroup(right), "fa") || habitDashboardSection(left).localeCompare(habitDashboardSection(right), "fa"));
      const cards = dashboard ? null : root.createDiv({ cls: "daily-habit-cards" });
      const dashboardGroups = new Map<string, HTMLElement>();
      for (const habit of habits) {
        const goal = Math.max(1, Number(habit.checkin?.goal ?? habit.goal ?? habit.target ?? 1));
        const currentValue = Number(habit.checkin?.value ?? 0);
        const completed = habit.checkin?.status === 2 || currentValue >= goal;
        const step = Math.max(1, Number(habit.step ?? 1));
        const progress = Math.min(1, Math.max(0, currentValue / goal));
        let cardHost: HTMLElement | null = cards;
        if (dashboard) {
          const group = habitDashboardGroup(habit);
          cardHost = dashboardGroups.get(group) ?? null;
          if (!cardHost) {
            const groupShell = root.createDiv({ cls: "ticktick-dashboard-group" });
            const groupTitle = groupShell.createDiv({ cls: "ticktick-dashboard-group-title" });
            groupTitle.createSpan({ text: habitDashboardGroupLabel(group) });
            groupTitle.createSpan({ text: "•" });
            cardHost = groupShell.createDiv({ cls: "ticktick-dashboard-cards" });
            dashboardGroups.set(group, cardHost);
          }
        }
        const habitGroupTone = (group: string) => {
          const map: Record<string, string> = { "زبان": "var(--pd-language, var(--color-yellow))", "شخصی": "var(--pd-personal, var(--color-green))", "سلامتی": "var(--pd-kotlin, var(--color-blue))" };
          return map[group] || "var(--interactive-accent)";
        };
        const card = cardHost!.createEl("button", { cls: `daily-habit-card ticktick-habit-card${dashboard ? " ticktick-dashboard-habit-card" : ""}${completed ? " is-done is-success" : ""}`, attr: { type: "button", "aria-label": `ثبت عادت ${habit.name}` } });
        card.style.setProperty("--card-tone", habitGroupTone(habitDashboardSection(habit)));
        const icon = card.createDiv({ cls: "daily-habit-progress" });
        icon.style.setProperty("--ticktick-progress", `${Math.round(progress * 360)}deg`);
        icon.createDiv({ cls: "daily-habit-icon", text: habitIcon(habit.iconRes ?? habit.icon) });
        const text = card.createDiv({ cls: "daily-habit-text" });
        text.createDiv({ cls: "daily-habit-title", text: habit.name });
        text.createDiv({ cls: "ticktick-habit-source", text: "TickTick" });
        const historyComplete = (habit.history ?? []).filter((entry: { completed: boolean }) => entry.completed).length;
        const streak = habitStreak(habit.history ?? []);
        const progressLabel = goal > 1 ? `${currentValue}/${goal} ${habit.unit ?? ""}`.trim() : completed ? "انجام شد" : "برای ثبت بزن";
        card.createDiv({ cls: "daily-habit-state", text: dashboard ? state!.mode === "day" ? progressLabel : `🔥 ${streak}  ✓ ${historyComplete}/${habit.history?.length ?? 0}` : progressLabel });
        if (dashboard && state!.mode !== "day" && habit.history) {
          const history = card.createDiv({ cls: "ticktick-habit-history", attr: { "aria-label": "تاریخچهٔ عادت" } });
          for (const entry of habit.history) {
            const dot = history.createSpan({ cls: `ticktick-habit-history-dot${entry.completed ? " is-complete" : " is-missed"}` });
            dot.setAttribute("aria-label", `${entry.date}: ${entry.completed ? "انجام شد" : "انجام نشد"}`);
            dot.setAttribute("title", `${entry.date}: ${entry.completed ? "انجام شد" : "انجام نشد"}`);
          }
        }
        card.addEventListener("click", async () => {
          card.disabled = true;
          try {
            const nextValue = completed ? 0 : Math.min(goal, currentValue + step);
            // TickTick uses status 1 for a skipped habit.  Do not send a
            // status for partial progress: its value/goal pair is enough and
            // TickTick renders it as a partially filled circle.
            const nextStatus = completed ? 0 : nextValue >= goal ? 2 : undefined;
            await this.checkInHabit(habit.id, day, {
              value: nextValue,
              goal,
              status: nextStatus,
            });
            new Notice(completed ? "ثبت امروز عادت در TickTick برداشته شد." : nextStatus === 2 ? "عادت در TickTick کامل شد." : `یک مرحله ثبت شد: ${nextValue}/${goal}`);
            await this.renderHabitBlock(element, dashboard, dayOverride);
          } catch (error) {
            card.disabled = false;
            new Notice(error instanceof Error ? error.message : "ثبت عادت ناموفق بود.");
          }
        });
      }
    } catch (error) {
      root.createEl("p", { text: error instanceof Error ? error.message : "اتصال TickTick آماده نیست." });
    } finally {
      const context = this.habitBlocks.get(element);
      if (context) this.habitBlockSignatures.set(element, this.habitBlockSignature(element, context));
    }
  }

  async renderRecurringBlock(element: HTMLElement) {
    element.replaceChildren();
    const root = element.createDiv({ cls: "ticktick-recurring-board" });
    try {
      const tasks = (await this.recurringTasks()).filter(task => Boolean(
        toDateKey(task.startDate, task.timeZone || this.settings.timeZone)
        || toDateKey(task.dueDate, task.timeZone || this.settings.timeZone),
      ));
      const groups: Array<[("daily" | "weekly" | "monthly" | "yearly")[], string]> = [[["daily"], "روزانه"], [["weekly"], "هفتگی"], [["monthly"], "ماهانه"], [["yearly"], "سالانه"]];
      const today = todayInZone(this.settings.timeZone);
      for (const [kinds, label] of groups) {
        const items = tasks.filter(task => {
          const kind = recurringTaskKind(task);
          return kind !== "other" && kinds.includes(kind);
        });
        const column = root.createDiv({ cls: `ticktick-recurring-column ticktick-recurring-${kinds[0]}` });
        const heading = column.createDiv({ cls: "ticktick-recurring-column-heading" });
        heading.createSpan({ text: label });
        heading.createEl("small", { text: String(items.length) });
        if (!items.length) {
          column.createDiv({ cls: "ticktick-recurring-empty", text: "موردی ندارد." });
          continue;
        }
        const projectListColor = (name: string) => {
          const map: Record<string, string> = { "برنامه‌ریزی": "#3b82f6", "شخصی": "#10b981", "مدیریت مالی": "#f59e0b", "فروشگاه": "#8b5cf6", "توسن‌تکنیو": "#0ea5e9" };
          return map[name] || "var(--interactive-accent)";
        };
        for (const task of items) {
          const card = column.createEl("button", { cls: "ticktick-recurring-card", attr: { type: "button", "aria-label": `ویرایش ${cleanTaskTitle(task.title)}` } });
          card.style.setProperty("--card-tone", projectListColor(task.projectName ?? ""));
          card.createDiv({ cls: "ticktick-recurring-title", text: cleanTaskTitle(task.title) });
          const meta = card.createDiv({ cls: "ticktick-recurring-meta" });
          meta.createDiv({ cls: "ticktick-recurring-project", text: task.projectName ?? "بدون لیست" });
          
          const due = toDateKey(task.dueDate, task.timeZone || this.settings.timeZone);
            const start = toDateKey(task.startDate, task.timeZone || this.settings.timeZone);
            const repeatDays = parseRecurringDays(task.repeatFlag, due || start || "");
            if (repeatDays) meta.createDiv({ cls: "ticktick-recurring-days", text: repeatDays });
          const dateStr = formatRecurringTaskSchedule(start || "", due || "", today);
          meta.createDiv({ cls: "ticktick-recurring-date", text: dateStr ? `نوبت بعدی: ${dateStr}` : "بدون تاریخ" });
          card.addEventListener("click", async () => {
            card.disabled = true;
            try {
              const projects = await this.client().listProjects();
              const draft = await openTaskEditor(this.app, projects, task);
              if (!draft) return;
              await this.updateTask(toTaskPayload({ ...task, ...draft }, this.settings.timeZone));
              new Notice("تسک تکرارشونده در TickTick ویرایش شد.");
              await this.renderRecurringBlock(element);
            } catch (error) {
              new Notice(error instanceof Error ? error.message : "ویرایش تسک ناموفق بود.");
            } finally { card.disabled = false; }
          });
        }
      }
    } catch (error) {
      root.createEl("p", { text: error instanceof Error ? error.message : "اتصال TickTick آماده نیست." });
    }
  }
}
