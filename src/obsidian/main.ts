import { App, Component, ItemView, MarkdownRenderer, Menu, Modal, Notice, Platform, Plugin, PluginSettingTab, Setting, TFile, WorkspaceLeaf, requestUrl, setIcon } from "obsidian";
import { isHabitScheduledForDay, isScheduledForDay, jalaliDateKeyToGregorian, toDateKey, todayInZone } from "../core/date.js";
import { TickTickClient } from "../core/ticktick-client.js";
import { normalizeWebSessionCookie, parseWebHabitCheckins } from "../core/ticktick-web-habits.js";
import { ManagedStorage } from "./managed-storage";
import { MarkdownSync } from "./markdown-sync";
import { MarkdownConflictModal } from "./conflict-modal";
import { PlanningCalendar } from "./planning-calendar";
import { ProjectBoard } from "./project-board";
import { HabitMigration } from "./habit-migration";
import { NoteImport, NoteImportModal } from "./note-import";
import { checklistSummary } from "../core/checklist.js";

const VIEW_TYPE = "ticktick-bridge-today";
const HABIT_VIEW_TYPE = "ticktick-bridge-habits";
const PLANNER_VIEW_TYPE = "ticktick-bridge-planner";
const PROJECT_BOARD_VIEW_TYPE = "ticktick-bridge-project-board";
const CONTROL_VIEW_TYPE = "ticktick-bridge-control";
type DashboardMode = "day" | "week" | "month" | "stats";
type ControlScreen = "sync" | "habits" | "notes" | "checklists" | "reports";

function currentPlatformName() {
  if (Platform.isWin) return "Windows";
  if (Platform.isMacOS) return "macOS";
  if (Platform.isLinux) return "Linux";
  return "Unknown";
}

interface BridgeSettings {
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
  localHabitFolder: string;
  ticktickNotesFolder: string;
  experimentalChecklistReadOnly: boolean;
  boardLastProjectId: string;
  boardCollapsedGroups: string[];
}

type CachedHabitCheckin = { stamp: number; value: number; goal: number; status: number };
type BridgeCache = {
  savedAt: string;
  tasks: any[];
  habits: any[];
  habitCheckins: Record<string, CachedHabitCheckin[]>;
  pending: PendingMutation[];
  conflicts: PendingMutation[];
};
type PendingMutation = { id: string; type: "create" | "update" | "complete" | "delete" | "habit"; payload: any; queuedAt: string };

const DEFAULT_SETTINGS: BridgeSettings = {
  apiToken: "",
  webSessionToken: "",
  webSessionCookie: "",
  webSessionDeviceId: "",
  timeZone: "Asia/Tehran",
  dailyNoteFolder: "Journal",
  syncIntervalMinutes: 0,
  syncIntervalSeconds: 0,
  checkboxImportTag: "ticktick",
  scheduledCheckboxProjectId: "",
  showRibbonIcons: false,
  plannerFirstWeekday: 6,
  plannerShowCompleted: false,
  localHabitFolder: "برنامه‌ریزی/Habits",
  ticktickNotesFolder: "TickTick Notes",
  experimentalChecklistReadOnly: true,
  boardLastProjectId: "",
  boardCollapsedGroups: [],
};

export default class TickTickBridgePlugin extends Plugin {
  settings: BridgeSettings = DEFAULT_SETTINGS;
  private cache: BridgeCache = { savedAt: "", tasks: [], habits: [], habitCheckins: {}, pending: [], conflicts: [] };
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
  private managedStorage!: ManagedStorage;
  private markdownSync!: MarkdownSync;
  private habitMigration!: HabitMigration;
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
      ...activeSettings
    } = legacySettings;
    this.settings = { ...DEFAULT_SETTINGS, ...activeSettings };
    this.cache = normalizeCache(savedCache);
    this.markdownSync = new MarkdownSync(this.app, this.managedStorage, () => this.client(), () => this.settings, () => this.scheduledCheckboxProjectId());
    await this.markdownSync.initialize();
    this.habitMigration = new HabitMigration(this.app, this.managedStorage, () => this.settings.localHabitFolder);
    this.noteImport = new NoteImport(this.app, this.managedStorage, () => this.settings.ticktickNotesFolder);
    if ("projectRoot" in legacySettings || "projectDependencies" in legacySettings || "projectTaskCatalog" in legacySettings) await this.saveSettings();
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
    this.addCommand({ id: "review-local-habits", name: "Review local habits for TickTick migration", callback: () => this.reviewLocalHabits() });
    this.addCommand({ id: "migrate-local-habits", name: "Migrate selected local habits to TickTick", callback: () => this.migrateLocalHabits() });
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
  }

  async createPrewriteSnapshot(purpose: string, payload: unknown) {
    const path = await this.managedStorage.writeSnapshot(purpose, payload);
    try { await this.managedStorage.pruneEligibleManagedBackups(); } catch { /* a completed save remains valid if retention cleanup fails */ }
    return path;
  }

  async saveSettings() {
    // This deliberately contains only public cache metadata; plugin settings and
    // queued request bodies can contain TickTick credentials or private text.
    await this.createPrewriteSnapshot("cache", publicCacheMetadata(this.cache));
    await this.saveData({ ...this.settings, cache: this.cache });
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
      if (!conflicts[0].diff?.conflicts?.length) { new Notice(`${conflicts[0].message} — این مورد قرنطینه شده و در گزارش ذخیره شده است.`); return conflicts; }
      const choice = await new MarkdownConflictModal(this.app, conflicts[0]).openAndWait();
      await this.markdownSync.resolve(conflicts[0], choice);
      new Notice("انتخاب شما ثبت شد؛ گزارش در /.ticktick/reports/ ذخیره شد.");
    } else new Notice("تعارض Markdown sync وجود ندارد.");
    return conflicts;
  }
  async repairMarkdownBindings() {
    const result = await this.markdownSync.repairLegacyBindings();
    new Notice(`اسکن binding قدیمی تمام شد؛ ${result.quarantine} مورد نیازمند بررسی دستی است.`);
    return result;
  }

  async reviewLocalHabits() {
    const rows = await this.habitMigration.preview(this.cache.habits);
    new Notice(`پیش‌نمایش عادت‌های محلی: ${rows.length} مورد؛ ${rows.filter(row => row.needsMapping).length} مورد نیازمند نگاشت دستی است. هیچ داده‌ای تغییر نکرد.`);
    return rows;
  }
  async migrateLocalHabits() { return this.habitMigration.apply(); }
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
      firstWeekday: this.settings.plannerFirstWeekday,
      showCompleted: this.settings.plannerShowCompleted,
      tasks: () => this.cache.tasks,
      refresh: async () => { await this.syncNow({ quiet: true }); },
      reschedule: async (task: any, day: string) => this.markdownSync.rescheduleBoundTask(String(task.id), day),
      complete: async (task: any) => this.markdownSync.bindingForTask(String(task.id)) ? this.markdownSync.completeBoundTask(String(task.id)) : this.completeTask(task),
      binding: (task: any) => this.markdownSync.bindingForTask(String(task.id)),
      load: async (task: any) => this.loadTaskDetails(task),
      edit: async (task: any) => this.editTaskFromSurface(task),
      create: async (initial: any) => this.createTaskFromSurface(initial),
    };
  }

  projectBoardHost() {
    return {
      app: this.app,
      projects: () => this.client().listProjects(),
      createProject: (project: any) => this.client().createProject(project),
      updateProject: (project: any) => this.client().updateProject(project),
      deleteProject: (projectId: string) => this.client().deleteProject(projectId),
      createTask: (initial: any) => this.createTaskFromSurface(initial),
      tasks: () => this.cache.tasks,
      board: (project: any) => this.client().projectBoard(project),
      refresh: async () => { await this.syncNow({ quiet: true }); },
      complete: async (task: any) => this.markdownSync.bindingForTask(String(task.id)) ? this.markdownSync.completeBoundTask(String(task.id)) : this.completeTask(task),
      binding: (task: any) => this.markdownSync.bindingForTask(String(task.id)),
      load: async (task: any) => this.loadTaskDetails(task),
      edit: async (task: any) => this.editTaskFromSurface(task),
      showCompleted: () => this.settings.plannerShowCompleted,
      preferences: () => ({ selected: this.settings.boardLastProjectId, collapsed: this.settings.boardCollapsedGroups }),
      savePreferences: async (value: { selected: string; collapsed: string[] }) => { this.settings.boardLastProjectId = value.selected; this.settings.boardCollapsedGroups = value.collapsed; await this.saveSettings(); },
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
    if (this.syncTimer !== null) window.clearInterval(this.syncTimer);
    this.syncTimer = null;
    const seconds = Number(this.settings.syncIntervalSeconds);
    const legacyMinutes = Number(this.settings.syncIntervalMinutes);
    const delay = Number.isFinite(seconds) && seconds >= 30 ? seconds * 1_000 : Number.isFinite(legacyMinutes) && legacyMinutes >= 1 ? legacyMinutes * 60_000 : 0;
    if (!delay) return;
    this.syncTimer = window.setInterval(() => void this.syncNow({ quiet: true }), delay);
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
    menu.addItem(item => item.setTitle("پیش‌نمایش عادت‌های محلی").setIcon("activity").onClick(() => void this.openControlPage("habits")));
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

  async syncNow({ quiet = false }: { quiet?: boolean } = {}) {
    // An interval may fire again while a slow TickTick request is still in
    // flight.  Allowing those runs to overlap can apply an older response
    // after a newer one and needlessly redraw the page.
    if (this.syncInProgress) return;
    this.syncInProgress = true;
    this.setSyncRibbonState(true);
    try {
      const day = todayInZone(this.settings.timeZone);
      await this.flushPendingMutations();
      await this.refreshCacheFromTickTick(day);
      const tasks = this.cachedTasksForDay(day);
      const habits = this.cachedHabitsForDay(day);
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
      for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
        const view = leaf.view as unknown as { render?: () => Promise<void> | void };
        if (typeof view.render === "function") await view.render();
      }
      for (const leaf of this.app.workspace.getLeavesOfType(HABIT_VIEW_TYPE)) {
        const view = leaf.view as unknown as { render?: () => Promise<void> | void };
        if (typeof view.render === "function") await view.render();
      }
      if (!quiet) new Notice(`TickTick همگام شد: ${tasks.length} تسک و ${habits.length} عادت امروز.`);
    } catch (error) {
      if (!quiet) new Notice(error instanceof Error ? error.message : "همگام‌سازی TickTick ناموفق بود.");
    } finally {
      this.setSyncRibbonState(false);
      this.syncInProgress = false;
    }
  }

  private hasCache() { return Boolean(this.cache.savedAt); }

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

  private async refreshCacheFromTickTick(today: string) {
    const client = this.client();
    const [webTasks, habits, sections] = await Promise.all([this.webOpenTasks(), client.listHabits(), client.listHabitSections()]);
    const tasks = webTasks ?? await client.listOpenTasks();
    const activeHabits = habits.filter((habit: { status?: number }) => habit.status === undefined || habit.status === 0);
    const fromDay = shiftIsoDay(today, -90);
    const officialDocuments = activeHabits.length ? await client.getHabitCheckins(activeHabits.map((habit: { id: string }) => habit.id), fromDay, today) : [];
    const checkins: Record<string, CachedHabitCheckin[]> = {};
    for (const document of officialDocuments ?? []) {
      const habitId = String(document?.habitId ?? "");
      if (!habitId) continue;
      checkins[habitId] = (document.checkins ?? []).map((entry: any) => ({ stamp: Number(entry.stamp), value: Number(entry.value ?? 0), goal: Number(entry.goal ?? 1), status: Number(entry.status ?? 0) }));
    }
    // The web feed is the most up-to-date source for today's habit state.
    const webCheckins = await this.webHabitCheckins(activeHabits.map((habit: { id: string }) => habit.id), today, 91);
    if (webCheckins) for (const [habitId, entries] of webCheckins) checkins[habitId] = entries;
    const sectionNames = new Map(sections.map((section: { id: string; name: string }) => [section.id, section.name]));
    this.cache = {
      savedAt: new Date().toISOString(),
      tasks,
      habits: activeHabits.map((habit: any) => ({ ...habit, sectionName: sectionNames.get(habit.sectionId) ?? "بدون دسته" })),
      habitCheckins: checkins,
      pending: this.cache.pending,
      conflicts: this.cache.conflicts,
    };
    await this.saveSettings();
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
      if (type === "create") this.cache.tasks.push({ ...payload, id: `offline-${operation.id}`, status: 0 });
      if (type === "update") this.cache.tasks = this.cache.tasks.map(task => task.id === payload.id ? { ...task, ...payload } : task);
      if (type === "complete" || type === "delete") this.cache.tasks = this.cache.tasks.filter(task => task.id !== payload.id);
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
      new Notice("آفلاین هستی؛ تغییر در صف همگام‌سازی ذخیره شد.");
      return { queued: true };
    }
    try {
      const result = await execute();
      applyLocal();
      await this.saveSettings();
      return { queued: false, result };
    } catch (error) {
      const status = Number((error as { status?: number })?.status ?? 0);
      if (status > 0 && status < 500) throw error;
      this.cache.pending.push(operation);
      applyLocal();
      await this.saveSettings();
      new Notice("اتصال TickTick برقرار نیست؛ تغییر در صف همگام‌سازی ذخیره شد.");
      return { queued: true };
    }
  }

  private async flushPendingMutations() {
    if (!this.cache.pending.length || !navigator.onLine) return;
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
        if (status > 0 && status < 500) {
          this.cache.conflicts.push(operation);
          new Notice("یک تغییر آفلاین با نسخهٔ TickTick تداخل داشت و ارسال نشد.");
        } else {
          remaining.push(...this.cache.pending.slice(index));
          break;
        }
      }
    }
    this.cache.pending = remaining;
    await this.saveSettings();
  }

  async createTask(task: any) { return this.runMutation("create", task); }
  async updateTask(task: any) { return this.runMutation("update", task); }
  async completeTask(task: any) { return this.runMutation("complete", task); }
  async deleteTask(task: any) { return this.runMutation("delete", task); }
  async checkInHabit(habitId: string, day: string, checkin: any) { return this.runMutation("habit", { habitId, day, checkin }); }
  async createTaskFromSurface(initial: TaskDraft = {}) {
    const projects = await this.client().listProjects();
    const draft = await openTaskEditor(this.app, projects, initial);
    if (!draft) return null;
    return this.createTask(toTaskPayload(draft, this.settings.timeZone));
  }
  async loadTaskDetails(task: any) {
    const projectId = String(task?.projectId ?? "");
    if (!projectId || !task?.id) return task;
    return this.client().getTask(projectId, String(task.id));
  }
  async editTaskFromSurface(task: any) {
    const current = await this.loadTaskDetails(task);
    const projects = await this.client().listProjects();
    const draft = await openTaskEditor(this.app, projects, current);
    if (!draft) return null;
    const payload = toTaskPayload({ ...current, ...draft }, this.settings.timeZone);
    await this.updateTask(payload);
    return { ...current, ...payload };
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

  client() {
    if (!this.settings.apiToken.trim()) throw new Error("ابتدا API Token را در تنظیمات TickTick Bridge وارد کن.");
    return new TickTickClient({
      token: this.settings.apiToken,
      transport: async (url, init) => {
        const response = await requestUrl({ url, method: init.method, headers: init.headers, body: init.body, throw: false });
        return { status: response.status, text: response.text };
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

  async tasksForDay(day: string) {
    if (this.hasCache()) return this.cachedTasksForDay(day);
    const webTasks = await this.webOpenTasks();
    if (webTasks !== null) return webTasks.filter(task => isScheduledForDay(task, day));
    return this.client().tasksForDay(day);
  }

  async recurringTasks() {
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
      const localHabits = (await this.habitMigration.localHabits()).map(habit => {
        const checkin = habit.history.find(entry => entry.date === day);
        return { ...habit, id: habit.id, source: "local", repeatRule: habit.cadence === "weekly" ? "RRULE:FREQ=WEEKLY" : "RRULE:FREQ=DAILY", checkin: checkin ? { value: checkin.value, goal: habit.goal, status: checkin.completed ? 2 : 0 } : null };
      });
      habits = [...habits, ...localHabits];
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
        const previous = navigator.createEl("button", { text: "‹", attr: { type: "button", "aria-label": "روز قبل" } });
        const now = navigator.createEl("button", { text: "امروز", attr: { type: "button" } });
        navigator.createEl("strong", { text: new Intl.DateTimeFormat("fa-IR-u-ca-persian", { weekday: "long", year: "numeric", month: "long", day: "numeric" }).format(new Date(`${day}T12:00:00`)) });
        const next = navigator.createEl("button", { text: "›", attr: { type: "button", "aria-label": "روز بعد" } });
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
        const card = cardHost!.createEl("button", { cls: `daily-habit-card${dashboard ? " ticktick-dashboard-habit-card" : ""}${completed ? " is-done" : ""}`, attr: { type: "button", "aria-label": `ثبت عادت ${habit.name}` } });
        const localOnly = habit.source === "local";
        if (localOnly) card.addClass("ticktick-local-habit");
        card.style.setProperty("--card-tone", habitGroupTone(habitDashboardSection(habit)));
        const icon = card.createDiv({ cls: "daily-habit-progress" });
        icon.style.setProperty("--ticktick-progress", `${Math.round(progress * 360)}deg`);
        icon.createDiv({ cls: "daily-habit-icon", text: habitIcon(habit.iconRes ?? habit.icon) });
        const text = card.createDiv({ cls: "daily-habit-text" });
        text.createDiv({ cls: "daily-habit-title", text: habit.name });
        text.createDiv({ cls: "ticktick-habit-source", text: localOnly ? `محلی · ${habit.sourcePath}` : "TickTick" });
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
          if (localOnly) { new Notice("عادت محلی فقط خواندنی است؛ writeback پیش‌فرض خاموش است."); return; }
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

class TodayTasksView extends ItemView {
  constructor(leaf: WorkspaceLeaf, private plugin: TickTickBridgePlugin) { super(leaf); }
  getViewType() { return VIEW_TYPE; }
  getDisplayText() { return "تسک‌های امروز"; }
  getIcon() { return "check-square"; }

  async onOpen() { await this.render(); }

  async render() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("ticktick-today-tasks-panel");
    const header = contentEl.createDiv({ cls: "ticktick-panel-header" });
    header.createEl("h2", { text: "تسک‌های امروز" });
    const refresh = header.createEl("button", { text: "بروزرسانی" });
    refresh.addEventListener("click", async () => {
      refresh.disabled = true;
      try { await this.render(); } finally { refresh.disabled = false; }
    });
    try {
      const client = this.plugin.client();
      const day = todayInZone(this.plugin.settings.timeZone);
      const toolbar = contentEl.createDiv({ cls: "ticktick-bridge-toolbar" });
      const addButton = toolbar.createEl("button", { text: "+ افزودن تسک", cls: "mod-cta" });
      addButton.addEventListener("click", async () => {
        addButton.disabled = true;
        try {
          const projects = await client.listProjects();
          const draft = await openTaskEditor(this.app, projects, { dueDate: day });
          if (!draft) return;
          await this.plugin.createTask(toTaskPayload(draft, this.plugin.settings.timeZone));
          new Notice("تسک به TickTick اضافه شد.");
          await this.render();
        } catch (error) {
          new Notice(error instanceof Error ? error.message : "افزودن تسک ناموفق بود.");
        } finally {
          addButton.disabled = false;
        }
      });
      const tasks = await this.plugin.tasksForDay(day);
      if (!tasks.length) contentEl.createEl("p", { text: "تسکی برای امروز یا قبل از آن نیست." });
      for (const task of tasks) {
        const row = contentEl.createDiv({ cls: "ticktick-bridge-task" });
        const check = row.createEl("input", { type: "checkbox" });
        const body = row.createDiv({ cls: "ticktick-bridge-task-body" });
        body.createSpan({ text: task.title });
        appendChecklistSummary(body, task, this.plugin.settings.experimentalChecklistReadOnly);
        body.createEl("small", { text: task.projectName ? ` · ${task.projectName}` : "" });
        const actions = row.createDiv({ cls: "ticktick-bridge-actions" });
        await addDescriptionToggle(this.app, this, body, actions, task);
        const edit = actions.createEl("button", { cls: "mod-icon", attr: { "aria-label": "ویرایش" } });
        setIcon(edit, "pencil");
        const remove = actions.createEl("button", { cls: "mod-warning mod-icon", attr: { "aria-label": "حذف" } });
        setIcon(remove, "trash-2");
        check.addEventListener("change", async () => {
          check.disabled = true;
          try {
            await this.plugin.completeTask(task);
            new Notice("نوبت تسک در TickTick تکمیل شد.");
            await this.render();
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
            await this.plugin.updateTask(toTaskPayload({ ...task, ...draft }, this.plugin.settings.timeZone));
            new Notice("تسک در TickTick ویرایش شد.");
            await this.render();
          } catch (error) {
            new Notice(error instanceof Error ? error.message : "ویرایش تسک ناموفق بود.");
          }
        });
        remove.addEventListener("click", async () => {
          const accepted = await confirmDelete(this.app, task.title);
          if (!accepted) return;
          try {
            await this.plugin.deleteTask(task);
            new Notice("تسک از TickTick حذف شد.");
            await this.render();
          } catch (error) {
            new Notice(error instanceof Error ? error.message : "حذف تسک ناموفق بود.");
          }
        });
      }
    } catch (error) {
      contentEl.createEl("p", { text: error instanceof Error ? error.message : "اتصال TickTick آماده نیست." });
    }
  }
}

class TodayHabitsView extends ItemView {
  constructor(leaf: WorkspaceLeaf, private plugin: TickTickBridgePlugin) { super(leaf); }
  getViewType() { return HABIT_VIEW_TYPE; }
  getDisplayText() { return "عادت‌های امروز"; }
  getIcon() { return "activity"; }

  async onOpen() { await this.render(); }

  async render() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("ticktick-today-habits-panel");
    contentEl.createEl("h2", { text: "عادت‌های امروز" });
    const refresh = contentEl.createEl("button", { text: "به‌روزرسانی" });
    refresh.addEventListener("click", async () => {
      refresh.disabled = true;
      try { await this.render(); } finally { refresh.disabled = false; }
    });
    const panel = contentEl.createDiv({ cls: "ticktick-bridge-habit-panel" });
    await this.plugin.renderHabitBlock(panel, true);
  }
}

class PlanningView extends ItemView {
  constructor(leaf: WorkspaceLeaf, private plugin: TickTickBridgePlugin) { super(leaf); }
  getViewType() { return PLANNER_VIEW_TYPE; }
  getDisplayText() { return "برنامه‌ریزی TickTick"; }
  getIcon() { return "calendar-days"; }
  async onOpen() { await this.render(); }
  async render() {
    this.contentEl.empty();
    this.contentEl.addClass("ticktick-planner-panel");
    await new PlanningCalendar(this.contentEl, this.plugin.plannerHost()).render();
  }
}

class ProjectBoardView extends ItemView {
  constructor(leaf: WorkspaceLeaf, private plugin: TickTickBridgePlugin) { super(leaf); }
  getViewType() { return PROJECT_BOARD_VIEW_TYPE; }
  getDisplayText() { return "برد پروژه‌های TickTick"; }
  getIcon() { return "kanban-square"; }
  async onOpen() { await this.render(); }
  async render() {
    this.contentEl.empty(); this.contentEl.addClass("ticktick-project-board-panel");
    await new ProjectBoard(this.contentEl, this.plugin.projectBoardHost()).render();
  }
}

class TickTickControlView extends ItemView {
  private screen: ControlScreen = "sync";
  constructor(leaf: WorkspaceLeaf, private plugin: TickTickBridgePlugin) { super(leaf); }
  getViewType() { return CONTROL_VIEW_TYPE; }
  getDisplayText() { return "مرکز کنترل TickTick"; }
  getIcon() { return "sliders-horizontal"; }
  getState() { return { screen: this.screen }; }
  async setState(state: { screen?: ControlScreen }) { this.screen = state?.screen ?? "sync"; await this.render(); }
  async onOpen() { await this.render(); }
  async render() {
    this.contentEl.empty(); this.contentEl.addClass("ticktick-control-page");
    const nav = this.contentEl.createDiv({ cls: "ticktick-control-nav" });
    const choices: Array<[ControlScreen, string]> = [["sync", "همگام‌سازی"], ["habits", "عادت‌های محلی"], ["notes", "TickTick Notes"], ["checklists", "Checklist"], ["reports", "گزارش‌ها"]];
    for (const [screen, label] of choices) { const button = nav.createEl("button", { text: label, cls: this.screen === screen ? "is-active" : "" }); button.addEventListener("click", () => { this.screen = screen; void this.render(); }); }
    const body = this.contentEl.createDiv({ cls: "ticktick-control-body" });
    if (this.screen === "sync") {
      body.createEl("h2", { text: "همگام‌سازی و تعارض‌ها" }); body.createEl("p", { text: "Preview هیچ تغییری نمی‌نویسد؛ Apply فقط پس از انتخاب شما اجرا می‌شود." });
      this.button(body, "همگام‌سازی عادی", async () => this.plugin.syncNow()); this.button(body, "Preview Markdown", async () => this.plugin.previewMarkdownSync()); this.button(body, "Apply Preview", async () => this.plugin.applyMarkdownSync(), true); this.button(body, "باز کردن تعارض‌ها", async () => this.plugin.openMarkdownSyncConflicts());
    } else if (this.screen === "habits") {
      body.createEl("h2", { text: "عادت‌های محلی" }); body.createEl("p", { text: "این بررسی فقط‌خواندنی است؛ فایل‌های محلی تغییر یا حذف نمی‌شوند." }); this.button(body, "مرور عادت‌های محلی", async () => this.plugin.reviewLocalHabits());
    } else if (this.screen === "notes") {
      body.createEl("h2", { text: "انتقال انتخابی TickTick Notes" }); body.createEl("p", { text: "فقط Noteهای دارای kind: NOTE پس از انتخاب شما وارد فولدر TickTick Notes می‌شوند؛ فایل موجود overwrite نمی‌شود." }); this.button(body, "انتخاب و انتقال Noteها", async () => this.plugin.previewTickTickNotes(), true);
    } else if (this.screen === "checklists") {
      body.createEl("h2", { text: "Checklist و Subtask" }); body.createEl("p", { text: "Checklistها در کارت task نمایش داده می‌شوند اما فعلاً فقط‌خواندنی‌اند؛ ویرایش child item تا تأیید رسمی API TickTick فعال نمی‌شود." }); this.button(body, "باز کردن تسک‌های امروز", async () => this.plugin.openTodayView());
    } else {
      body.createEl("h2", { text: "گزارش‌ها و backup" }); const latest = await this.plugin.latestManagedReport(); body.createEl("p", { text: latest?.path ?? "هنوز گزارشی وجود ندارد." }); if (latest) body.createEl("pre", { text: JSON.stringify(latest.report, null, 2) });
    }
  }
  private button(parent: HTMLElement, label: string, action: () => Promise<any>, cta = false) { const button = parent.createEl("button", { text: label, cls: cta ? "mod-cta" : "" }); button.addEventListener("click", async () => { button.disabled = true; try { await action(); } catch (error) { new Notice(error instanceof Error ? error.message : "عملیات ناموفق بود."); } finally { button.disabled = false; } }); }
}

type TaskDraft = {
  id?: string;
  projectId?: string;
  title?: string;
  desc?: string;
  content?: string;
  dueDate?: string;
  repeatFlag?: string;
  [key: string]: unknown;
};

function appendChecklistSummary(parent: HTMLElement, task: any, enabled: boolean) {
  const summary = checklistSummary(task.items);
  if (!summary.total) return;
  const detail = parent.createEl("details", { cls: "ticktick-checklist-readonly" });
  detail.createEl("summary", { text: `Checklist: ${summary.completed}/${summary.total}${enabled ? " · فقط خواندنی" : " · غیرفعال"}` });
  for (const item of (task.items ?? [])) detail.createEl("div", { text: `${Number(item.status ?? 0) !== 0 ? "☑" : "☐"} ${String(item.title ?? item.content ?? "")}` });
}

function formatTaskDate(dueDate: string, today: string) {
  if (!dueDate) return "بدون تاریخ";
  if (dueDate === today) return "امروز";
  const date = new Date(`${dueDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return dueDate;
  const label = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric", month: "numeric", day: "numeric" }).format(date);
  return dueDate < today ? `عقب‌افتاده · ${label}` : label;
}

function formatTaskSchedule(startDate: string, dueDate: string, today: string) {
  if (!startDate || !dueDate || startDate === dueDate) return formatTaskDate(dueDate, today);
  const format = (dateKey: string) => {
    const value = new Date(`${dateKey}T12:00:00`);
    return Number.isNaN(value.getTime()) ? dateKey : new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric", month: "numeric", day: "numeric" }).format(value);
  };
  return `از ${format(startDate)} تا ${format(dueDate)}`;
}

function formatRecurringTaskSchedule(startDate: string, dueDate: string, today: string) {
  if (!startDate || !dueDate || startDate === dueDate) return formatTaskSchedule(startDate, dueDate, today);
  const weekday = (dateKey: string) => new Intl.DateTimeFormat("fa-IR-u-ca-persian", { weekday: "long" }).format(new Date(`${dateKey}T12:00:00`));
  return `از ${weekday(startDate)} تا ${weekday(dueDate)}`;
}

function cleanTaskDescription(value: unknown) {
  return String(value ?? "")
    .replace(/^\s*\[[^\]]+\]\(obsidian:\/\/[^)]+\)\s*$/gim, "")
    .replace(/obsidian:\/\/[^\s<\])]+/gi, "")
    .replace(/^\s*-{10,}\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanTaskTitle(value: unknown) {
  return String(value ?? "")
    .replace(/\s*\[[^\]]+\]\(obsidian:\/\/[^)]+\)\s*/gi, " ")
    .trim();
}

function habitIcon(icon: unknown) {
  const value = String(icon ?? "").toLowerCase();
  if (value.includes("reading")) return "📖";
  if (value.includes("listen") || value.includes("music")) return "🎧";
  if (value.includes("stretch") || value.includes("sport") || value.includes("exercise")) return "🧘";
  if (value.includes("language") || value.includes("learn")) return "🗣️";
  return "✓";
}

function habitDashboardSection(habit: { sectionName?: unknown }) {
  return String(habit.sectionName ?? "بدون دسته");
}

function habitDashboardCadence(habit: { tags?: unknown; tagNames?: unknown; tag?: unknown; repeatRule?: unknown }) {
  const values = [habit.tags, habit.tagNames, habit.tag]
    .flatMap(value => Array.isArray(value) ? value : value == null ? [] : [value])
    .map(value => String(value).trim().toLocaleLowerCase("fa"));
  // A Persian tag is the explicit override.  If neither tag is present, fall
  // back to TickTick's repeat rule so every habit still has a useful group.
  if (values.some(value => value === "روزانه" || value === "daily")) return "عادت‌های روزانه";
  if (values.some(value => value === "هفتگی" || value === "weekly")) return "عادت‌های هفتگی";
  return String(habit.repeatRule ?? "").toUpperCase().includes("FREQ=WEEKLY") ? "عادت‌های هفتگی" : "عادت‌های روزانه";
}

function habitDashboardGroup(habit: { sectionName?: unknown; tags?: unknown; tagNames?: unknown; tag?: unknown; repeatRule?: unknown }) {
  return `${habitDashboardCadence(habit)}\u0000${habitDashboardSection(habit)}`;
}

function habitDashboardGroupLabel(group: string) {
  const [cadence, section] = group.split("\u0000");
  return section ? `${cadence} · ${section}` : cadence;
}

function habitStreak(history: Array<{ completed: boolean }>) {
  let total = 0;
  for (const entry of history.slice().reverse()) {
    if (!entry.completed) break;
    total++;
  }
  return total;
}

function parseRecurringDays(repeatFlag: unknown, dateKey?: string): string {
  const rule = String(repeatFlag ?? "").toUpperCase();
  const match = rule.match(/BYDAY=([^;]+)/);
  const map: Record<string, string> = { "SA": "شنبه", "SU": "یکشنبه", "MO": "دوشنبه", "TU": "سه‌شنبه", "WE": "چهارشنبه", "TH": "پنج‌شنبه", "FR": "جمعه" };
  const order = ["SA", "SU", "MO", "TU", "WE", "TH", "FR"];
  const jsDayMap = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

  let days: string[] = [];
  if (match) {
    days = match[1].split(",");
  } else if (rule.includes("FREQ=WEEKLY") && dateKey) {
    const d = new Date(`${dateKey}T12:00:00`);
    if (!Number.isNaN(d.getTime())) {
      days = [jsDayMap[d.getDay()]];
    }
  }

  if (days.length > 0) {
    days.sort((a, b) => order.indexOf(a) - order.indexOf(b));
    if (days.length === 7) return "هر روز";
    const mapped = days.map(d => map[d]).filter(Boolean);
    if (days.length >= 2 && days.join(",") === order.slice(order.indexOf(days[0]), order.indexOf(days[0]) + days.length).join(",")) {
      return `از ${mapped[0]} تا ${mapped[mapped.length - 1]}`;
    }
    return mapped.map(d => d + "‌ها").join("، ");
  }

  if (rule.includes("FREQ=DAILY")) return "هر روز";
  if (rule.includes("FREQ=WEEKLY")) return "هر هفته";
  if (rule.includes("FREQ=MONTHLY")) return "ماهانه";
  if (rule.includes("FREQ=YEARLY")) return "سالانه";
  return "";
}

function recurringKind(repeatFlag: unknown): "weekly" | "monthly" | "yearly" | "daily" | "other" {
  const rule = String(repeatFlag ?? "").toUpperCase();
  if (rule.includes("FREQ=WEEKLY")) return "weekly";
  if (rule.includes("FREQ=MONTHLY")) return "monthly";
  if (rule.includes("FREQ=YEARLY")) return "yearly";
  if (rule.includes("FREQ=DAILY")) return "daily";
  return "other";
}

function recurringTaskKind(task: Record<string, unknown>): ReturnType<typeof recurringKind> {
  const tagValues = [task.tags, task.tagNames, task.tag]
    .flatMap(value => Array.isArray(value) ? value : value == null ? [] : [value])
    .map(value => String(value).trim().replace(/^#/, "").toLocaleLowerCase("fa"));
  const taggedKind = (name: string, kind: ReturnType<typeof recurringKind>) =>
    tagValues.includes(name) || new RegExp(`(?:^|\\s)#${name}(?=\\s|$)`, "iu").test(`${task.title ?? ""}\n${task.content ?? ""}\n${task.desc ?? ""}`) ? kind : null;
  // Explicit scheduling tags take priority over TickTick's repeat rule.
  return taggedKind("روزانه", "daily") ?? taggedKind("هفتگی", "weekly") ?? taggedKind("ماهانه", "monthly") ?? taggedKind("سالانه", "yearly") ?? recurringKind(task.repeatFlag);
}

function shiftIsoDay(day: string, amount: number) {
  const value = new Date(`${day}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

function normalizeCache(value: unknown): BridgeCache {
  const candidate = value as Partial<BridgeCache> | null;
  if (!candidate || typeof candidate !== "object") return { savedAt: "", tasks: [], habits: [], habitCheckins: {}, pending: [], conflicts: [] };
  return {
    savedAt: typeof candidate.savedAt === "string" ? candidate.savedAt : "",
    tasks: Array.isArray(candidate.tasks) ? candidate.tasks : [],
    habits: Array.isArray(candidate.habits) ? candidate.habits : [],
    habitCheckins: candidate.habitCheckins && typeof candidate.habitCheckins === "object" ? candidate.habitCheckins : {},
    pending: Array.isArray(candidate.pending) ? candidate.pending : [],
    conflicts: Array.isArray(candidate.conflicts) ? candidate.conflicts : [],
  };
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function checkboxSchedule(source: string, today: string) {
  const rules: Array<{ pattern: RegExp; due: () => string }> = [
    { pattern: /#امروز(?=\s|$)/giu, due: () => today },
    { pattern: /#فردا(?=\s|$)/giu, due: () => shiftIsoDay(today, 1) },
    { pattern: /#پس(?:[-_‌\s])?فردا(?=\s|$)/giu, due: () => shiftIsoDay(today, 2) },
    { pattern: /#این(?:[-_‌\s])?هفته(?=\s|$)/giu, due: () => nextWeekday(today, 5, false) },
    { pattern: /#هفته(?:[-_‌\s])?بعد(?=\s|$)/giu, due: () => nextWeekday(today, 6, true) },
    { pattern: /#ماه(?:[-_‌\s])?بعد(?=\s|$)/giu, due: () => {
      const date = new Date(`${today}T12:00:00Z`);
      date.setUTCMonth(date.getUTCMonth() + 1, 1);
      return date.toISOString().slice(0, 10);
    } },
  ];
  const weekdays: Record<string, number> = { "شنبه": 6, "یکشنبه": 0, "دوشنبه": 1, "سه‌شنبه": 2, "چهارشنبه": 3, "پنجشنبه": 4, "جمعه": 5 };
  for (const [name, weekday] of Object.entries(weekdays)) rules.push({ pattern: new RegExp(`#${name}(?=\\s|$)`, "giu"), due: () => nextWeekday(today, weekday, false) });
  for (const rule of rules) {
    if (rule.pattern.test(source)) return { dueDate: rule.due(), title: source.replace(rule.pattern, "").replace(/\s+/g, " ").trim() };
  }
  return { dueDate: "", title: source.replace(/\s+/g, " ").trim() };
}

function nextWeekday(day: string, weekday: number, forceNextWeek: boolean) {
  const current = new Date(`${day}T12:00:00Z`).getUTCDay();
  let offset = (weekday - current + 7) % 7;
  if (forceNextWeek || offset === 0) offset += 7;
  return shiftIsoDay(day, offset);
}

function isHabitScheduledForCachedDay(habit: any, day: string) {
  return isHabitScheduledForDay(habit, day);
}

function dailyNoteDateFromPath(path: string) {
  // Obsidian normally provides slash-separated vault paths, but accepting
  // Windows separators keeps the selected daily note's date authoritative
  // regardless of how a view was opened.
  const match = path.match(/(?:^|[\\/])(1[34]\d{2}-\d{2}-\d{2})\.md$/);
  return match ? jalaliDateKeyToGregorian(match[1]) ?? undefined : undefined;
}

function persianMonthSegments(start: string, due: string) {
  const format = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { month: "long" });
  const output: Array<{ label: string; days: number }> = [];
  for (let day = start; day <= due; day = shiftIsoDay(day, 1)) {
    const label = format.format(new Date(`${day}T12:00:00Z`));
    const current = output.at(-1);
    if (current?.label === label) current.days++;
    else output.push({ label, days: 1 });
  }
  return output;
}

async function addDescriptionToggle(app: App, component: Component, body: HTMLElement, actions: HTMLElement, task: TaskDraft) {
  const description = cleanTaskDescription(task.desc || task.content);
  const button = actions.createEl("button", { cls: "mod-icon", attr: { "aria-label": "توضیحات" } });
  setIcon(button, "file-text");
  const panel = body.createDiv({ cls: "ticktick-bridge-description" });
  panel.addClass("is-hidden");
  await MarkdownRenderer.render(app, description || "توضیحی برای این تسک ثبت نشده است.", panel, "", component);
  button.addEventListener("click", () => panel.classList.toggle("is-hidden"));
}

function toTaskPayload(draft: TaskDraft, timeZone: string) {
  const { projectName, dueDate, reminderTime, reminders: _reminders, ...task } = draft as TaskDraft & { projectName?: string; reminderTime?: string; reminders?: string[] };
  const day = String(dueDate ?? "").slice(0, 10);
  return {
    ...task,
    title: String(task.title ?? "").trim(),
    desc: String(task.desc || task.content || "").trim(),
    content: "",
    projectId: task.projectId,
    dueDate: day ? `${day}T00:00:00+0330` : null,
    startDate: task.startDate ?? null,
    timeZone,
    isAllDay: true,
    reminders: reminderTime ? [reminderTrigger(reminderTime)] : [],
    repeatFlag: String(task.repeatFlag ?? "").trim() || null,
  };
}

function reminderTrigger(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return "";
  return `TRIGGER:P0DT${hours}H${minutes}M0S`;
}

function reminderTimeFromTask(task: TaskDraft) {
  for (const reminder of Array.isArray(task.reminders) ? task.reminders : []) {
    const match = String(reminder).match(/P0?DT(\d+)H(\d+)M/i);
    if (match) return `${match[1].padStart(2, "0")}:${match[2].padStart(2, "0")}`;
  }
  return "";
}

class TaskEditorModal extends Modal {
  private resolveResult!: (value: TaskDraft | null) => void;
  private result = new Promise<TaskDraft | null>(resolve => this.resolveResult = resolve);
  private finished = false;
  private comp = new Component();
  constructor(app: App, private projects: Array<{ id: string; name: string }>, private initial: TaskDraft) { super(app); }
  finish(value: TaskDraft | null) { if (!this.finished) { this.finished = true; this.resolveResult(value); this.close(); } }
  onOpen() {
    this.modalEl.addClass("ticktick-modal");
    const { contentEl } = this;
    contentEl.addClass("ticktick-task-editor-modal");

    // ─── Decorative header ───
    const header = contentEl.createDiv({ cls: "ticktick-editor-header" });
    header.createEl("h2", { text: this.initial.id ? "✏️ ویرایش تسک" : "✨ افزودن تسک" });
    header.createEl("p", { cls: "ticktick-task-editor-subtitle", text: "تغییرات مستقیماً در TickTick ذخیره می‌شوند." });

    // ─── Gradient divider ───
    contentEl.createDiv({ cls: "ticktick-editor-divider" });

    // ─── Fields container ───
    const fields = contentEl.createDiv({ cls: "ticktick-editor-fields" });

    let title = String(this.initial.title ?? "");
    let description = String(this.initial.desc || this.initial.content || "");
    let projectId = String(this.initial.projectId ?? this.projects[0]?.id ?? "");
    let dueDate = toDateKey(String(this.initial.dueDate ?? ""), String(this.initial.timeZone ?? "Asia/Tehran")) ?? "";
    let reminderTime = reminderTimeFromTask(this.initial);

    new Setting(fields).setName("📝 عنوان").addText(input => { input.setValue(title).onChange(value => title = value); input.inputEl.dir = "rtl"; input.inputEl.addClass("ticktick-input-full-width"); });

    const selectedProjectName = () => this.projects.find(project => project.id === projectId)?.name ?? "انتخاب پروژه";
    new Setting(fields).setName("📂 پروژه").setDesc("برای انتخاب پروژه کلیک کن.").addButton(button => {
      button.setButtonText(selectedProjectName());
      button.buttonEl.addClass("ticktick-project-picker");
      button.buttonEl.addEventListener("click", (event) => {
        const menu = new Menu();
        this.projects.forEach(project => menu.addItem(item => item
          .setTitle(project.name)
          .setChecked(project.id === projectId)
          .onClick(() => { projectId = project.id; button.setButtonText(selectedProjectName()); })));
        menu.showAtMouseEvent(event);
      });
    });

    new Setting(fields).setName("📅 تاریخ").setDesc("با انتخاب تاریخ، تقویم سیستم باز می‌شود.").addText(input => { input.inputEl.type = "date"; input.setValue(dueDate).onChange(value => dueDate = value); input.inputEl.dir = "ltr"; });
    new Setting(fields).setName("⏰ یادآوری").setDesc("اختیاری؛ در ساعت انتخاب‌شده در همان روز یادآوری می‌شود.").addText(input => { input.inputEl.type = "time"; input.setValue(reminderTime).onChange(value => reminderTime = value); input.inputEl.dir = "ltr"; });

    // ─── Description Section (Full-width, Markdown Preview & Edit) ───
    const descSection = fields.createDiv({ cls: "ticktick-desc-section" });
    const descHeader = descSection.createDiv({ cls: "ticktick-desc-header" });
    const descHeaderInfo = descHeader.createDiv({ cls: "ticktick-desc-header-info" });
    descHeaderInfo.createSpan({ text: "📋 توضیحات (Markdown)", cls: "ticktick-desc-label" });

    const tabsWrap = descHeader.createDiv({ cls: "ticktick-desc-tabs" });
    const previewTabBtn = tabsWrap.createEl("button", {
      cls: "ticktick-tab-btn",
      text: "👁️ پیش‌نمایش"
    });
    const editTabBtn = tabsWrap.createEl("button", {
      cls: "ticktick-tab-btn",
      text: "✏️ ویرایش متن"
    });

    const descContainer = descSection.createDiv({ cls: "ticktick-desc-container" });
    const previewEl = descContainer.createDiv({ cls: "ticktick-desc-preview" });
    const descTextarea = descContainer.createEl("textarea", {
      cls: "ticktick-desc-textarea",
      placeholder: "توضیحات و یادداشت‌های تسک را وارد کن... (پشتیبانی کامل از Markdown)"
    });
    descTextarea.value = description;
    descTextarea.oninput = () => { description = descTextarea.value; };

    const renderPreview = async () => {
      previewEl.empty();
      const content = description.trim() || "*هنوز توضیحی برای این تسک ثبت نشده است. برای نوشتن، روی دکمه «ویرایش متن» در بالا کلیک کنید.*";
      await MarkdownRenderer.render(this.app, content, previewEl, "", this.comp);
    };

    const setTab = (tab: "preview" | "edit") => {
      if (tab === "preview") {
        previewTabBtn.addClass("is-active");
        editTabBtn.removeClass("is-active");
        previewEl.removeClass("is-hidden");
        descTextarea.addClass("is-hidden");
        description = descTextarea.value;
        void renderPreview();
      } else {
        editTabBtn.addClass("is-active");
        previewTabBtn.removeClass("is-active");
        previewEl.addClass("is-hidden");
        descTextarea.removeClass("is-hidden");
        descTextarea.focus();
      }
    };

    previewTabBtn.onclick = (e) => { e.preventDefault(); setTab("preview"); };
    editTabBtn.onclick = (e) => { e.preventDefault(); setTab("edit"); };

    const initialTab = description.trim() ? "preview" : "edit";
    setTab(initialTab);

    // ─── Action buttons ───
    const actions = contentEl.createDiv({ cls: "ticktick-editor-actions" });
    actions.createEl("button", { text: "❌ انصراف" }).addEventListener("click", () => this.finish(null));
    actions.createEl("button", { text: "💾 ذخیره", cls: "mod-cta" }).addEventListener("click", () => {
      description = descTextarea.value;
      if (!title.trim() || !projectId) return new Notice("عنوان و پروژه را وارد کن.");
      if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return new Notice("تاریخ باید به شکل YYYY-MM-DD باشد.");
      this.finish({ ...this.initial, title: title.trim(), desc: description.trim(), projectId, dueDate, reminderTime });
    });
  }
  onClose() {
    this.comp.unload();
    this.contentEl.empty();
    if (!this.finished) { this.finished = true; this.resolveResult(null); }
  }
  openAndWait() { this.open(); return this.result; }
}

class DeleteConfirmationModal extends Modal {
  private resolveResult!: (value: boolean) => void;
  private result = new Promise<boolean>(resolve => this.resolveResult = resolve);
  private finished = false;
  constructor(app: App, private title: string) { super(app); }
  finish(value: boolean) { if (!this.finished) { this.finished = true; this.resolveResult(value); this.close(); } }
  onOpen() {
    this.contentEl.createEl("h2", { text: "حذف تسک" });
    this.contentEl.createEl("p", { text: `تسک «${this.title}» از TickTick حذف شود؟` });
    const actions = this.contentEl.createDiv({ cls: "modal-button-container" });
    actions.createEl("button", { text: "انصراف" }).addEventListener("click", () => this.finish(false));
    actions.createEl("button", { text: "حذف", cls: "mod-warning" }).addEventListener("click", () => this.finish(true));
  }
  onClose() { this.contentEl.empty(); if (!this.finished) { this.finished = true; this.resolveResult(false); } }
  openAndWait() { this.open(); return this.result; }
}

function openTaskEditor(app: App, projects: Array<{ id: string; name: string }>, initial: TaskDraft) {
  const allProjects = [{ id: "inbox", name: "صندوق ورودی" }, ...projects.filter(p => p.id !== "inbox")];
  return new TaskEditorModal(app, allProjects, initial).openAndWait();
}
function confirmDelete(app: App, title: string) { return new DeleteConfirmationModal(app, title).openAndWait(); }

class TickTickWebLoginModal extends Modal {
  private resolveResult!: (value: { username: string; password: string } | null) => void;
  private result = new Promise<{ username: string; password: string } | null>(resolve => this.resolveResult = resolve);
  private submitted = false;

  onOpen() {
    this.contentEl.addClass("ticktick-login-modal");
    this.contentEl.createEl("h2", { text: "ورود مستقیم به TickTick" });
    this.contentEl.createEl("p", { text: "رمز فقط برای دریافت نشست TickTick استفاده می‌شود و در Obsidian ذخیره نخواهد شد." });
    let username = "";
    let password = "";
    new Setting(this.contentEl).setName("ایمیل یا نام کاربری").addText(input => {
      input.inputEl.autocomplete = "username";
      input.inputEl.addClass("ticktick-input-full-width");
      input.onChange(value => username = value);
    });
    new Setting(this.contentEl).setName("رمز عبور").addText(input => {
      input.inputEl.type = "password";
      input.inputEl.autocomplete = "current-password";
      input.inputEl.addClass("ticktick-input-full-width");
      input.onChange(value => password = value);
    });
    const actions = this.contentEl.createDiv({ cls: "modal-button-container" });
    actions.createEl("button", { text: "انصراف" }).addEventListener("click", () => this.finish(null));
    actions.createEl("button", { text: "ورود و اتصال", cls: "mod-cta" }).addEventListener("click", () => {
      if (!username.trim() || !password) { new Notice("نام کاربری و رمز عبور را وارد کن."); return; }
      this.finish({ username, password });
    });
  }

  private finish(value: { username: string; password: string } | null) {
    if (this.submitted) return;
    this.submitted = true;
    this.resolveResult(value);
    this.close();
  }

  onClose() {
    this.contentEl.empty();
    if (!this.submitted) { this.submitted = true; this.resolveResult(null); }
  }

  openAndWait() { this.open(); return this.result; }
}

class TickTickBridgeSettings extends PluginSettingTab {
  constructor(app: import("obsidian").App, private plugin: TickTickBridgePlugin) { super(app, plugin); }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    new Setting(containerEl).setName("تنظیمات اتصال و همگام‌سازی").setHeading();
    const cachedAt = this.plugin.cacheSnapshotTime();
    new Setting(containerEl).setName("نسخهٔ محلی داده‌ها").setDesc(cachedAt
      ? `آخرین دریافت: ${cachedAt} — پنل‌ها ابتدا از این نسخهٔ سریع نمایش داده می‌شوند.`
      : "هنوز نسخهٔ محلی ساخته نشده است. یک‌بار «همگام‌سازی الآن» را بزن.");
    new Setting(containerEl).setName("مرکز سادهٔ همگام‌سازی").setDesc("یک صفحهٔ کامل برای sync عادی، preview/apply Markdown و حل تعارض‌ها.").addButton(button => button.setButtonText("باز کردن مرکز Sync").setCta().onClick(() => void this.plugin.openControlPage("sync")));
    if (this.plugin.cacheConflictCount()) new Setting(containerEl).setName("تداخل‌های نیازمند بررسی").setDesc(`${this.plugin.cacheConflictCount()} تغییر آفلاین در TickTick قابل اعمال نبود و برای جلوگیری از بازنویسی دادهٔ جدید، نگه داشته شده است.`);
    new Setting(containerEl).setName("فضای مدیریت‌شدهٔ TickTick").setDesc(`/.ticktick/ — نسخه‌های پشتیبان تا ۱۰ روز تقویمی UTC نگه داشته می‌شوند. آخرین گزارش: ${this.plugin.managedStorageReport()}`);
    new Setting(containerEl).setName("آخرین گزارش مدیریت‌شده").setDesc("آخرین گزارش غیرمحرمانهٔ عملیات ذخیره‌شده در .ticktick/reports/ را نمایش می‌دهد.").addButton(button => button
      .setButtonText("باز کردن گزارش آخر")
      .onClick(async () => {
        button.setDisabled(true);
        try { new ManagedReportModal(this.app, await this.plugin.latestManagedReport()).open(); }
        finally { button.setDisabled(false); }
      }));
    new Setting(containerEl).setName("انتقال پشتیبان‌های قدیمی ریشهٔ Vault").setDesc("فقط فایل‌های دقیق ticktick-backup-*.csv را پس از تأیید و بررسی طول بایت کپی می‌کند.").addButton(button => button
      .setButtonText("Move legacy root backups")
      .onClick(async () => {
        button.setDisabled(true);
        try {
          const files = await this.plugin.previewLegacyRootBackups();
          const size = files.reduce((total, file) => total + file.size, 0);
          if (!files.length) { new Notice("پشتیبان قدیمی در ریشهٔ Vault پیدا نشد."); return; }
          const confirmed = await new LegacyBackupMigrationModal(this.app, files.length, size).openAndWait();
          if (!confirmed) return;
          const result = await this.plugin.migrateLegacyRootBackups();
          new Notice(`${result.migrated.length} از ${result.sources.length} پشتیبان قدیمی منتقل شد.`);
          this.display();
        } finally { button.setDisabled(false); }
      }));
    new Setting(containerEl).setName("API Token").setDesc("توکن شخصی TickTick؛ فقط در تنظیمات افزونه نگهداری می‌شود.").addText(input => {
      input.inputEl.type = "password";
      input.setValue(this.plugin.settings.apiToken).onChange(async value => { this.plugin.settings.apiToken = value.trim(); await this.plugin.saveSettings(); });
    });
    new Setting(containerEl).setName("تگ چک‌باکس TickTick").setDesc("چک‌باکس‌های دارای این تگ ابتدا فقط پیش‌نمایش می‌شوند؛ سپس با فرمان اعمال، binding امن TickTick می‌گیرند.").addText(input => {
      input.setValue(this.plugin.settings.checkboxImportTag).onChange(async value => {
        this.plugin.settings.checkboxImportTag = value.trim().replace(/^#/, "") || "ticktick";
        await this.plugin.saveSettings();
      });
    }).addButton(button => button.setButtonText("پیش‌نمایش همهٔ یادداشت‌ها").onClick(async () => {
      button.setDisabled(true);
      try { await this.plugin.importAllTaggedCheckboxes(); } finally { button.setDisabled(false); }
    })).addButton(button => button.setButtonText("اعمال پیش‌نمایش").setCta().onClick(async () => {
      button.setDisabled(true);
      try { await this.plugin.applyMarkdownSync(); } finally { button.setDisabled(false); }
    }));
    new Setting(containerEl).setName("Checklist و Subtask آزمایشی").setDesc("فعلاً فقط خواندنی است؛ API رسمی برای ویرایش امن child item تأیید نشده و هیچ checkboxای در این بخش چیزی را تغییر نمی‌دهد.").addToggle(toggle => toggle.setValue(this.plugin.settings.experimentalChecklistReadOnly).setDisabled(true));
    new Setting(containerEl).setName("انتقال TickTick Notes").setDesc("فقط Noteهای دارای kind: NOTE را پس از انتخاب شما در فولدر قابل‌مشاهده وارد می‌کند؛ یک‌طرفه و بدون overwrite.").addText(input => input.setValue(this.plugin.settings.ticktickNotesFolder).onChange(async value => { this.plugin.settings.ticktickNotesFolder = value.trim().replace(/^\/+|\/+$/g, "") || "TickTick Notes"; await this.plugin.saveSettings(); })).addButton(button => button.setButtonText("انتخاب Noteها").onClick(() => void this.plugin.previewTickTickNotes()));
    new Setting(containerEl).setName("ورود مستقل برای عادت‌ها").setDesc("مستقیم وارد TickTick می‌شود و نشست لازم را در خود Bridge نگه می‌دارد. نام کاربری و رمز ذخیره نمی‌شوند.").addButton(button => button
      .setButtonText("ورود به TickTick")
      .setCta()
      .onClick(async () => {
        const credentials = await new TickTickWebLoginModal(this.app).openAndWait();
        if (!credentials) return;
        button.setDisabled(true);
        try {
          await this.plugin.loginToTickTickWeb(credentials.username, credentials.password);
          new Notice("ورود مستقل TickTick انجام شد. حالا اتصال عادت‌ها را بررسی یا همگام‌سازی کن.");
          this.display();
        } catch (error) {
          new Notice(error instanceof Error ? error.message : "ورود به TickTick ناموفق بود.");
        } finally { button.setDisabled(false); }
      }));
    new Setting(containerEl).setName("اتصال آسان از TickTickSync").setDesc("نشست فعال TickTickSync را وارد می‌کند تا چک‌این عادت‌ها فوری و دقیق خوانده شوند. رمز عبور خوانده، نمایش داده یا ذخیره نمی‌شود.").addButton(button => button
      .setButtonText("وارد کردن اتصال TickTickSync")
      .setCta()
      .onClick(async () => {
        button.setDisabled(true);
        try {
          const result = await this.plugin.importTickTickSyncSession();
          new Notice(result.hasCookie ? "اتصال TickTickSync وارد شد." : "اتصال TickTickSync وارد شد؛ در صورت خطا یک‌بار افزونهٔ قدیمی را باز کن و دوباره امتحان کن.");
          this.display();
        } catch (error) {
          new Notice(error instanceof Error ? error.message : "وارد کردن اتصال TickTickSync ناموفق بود.");
        } finally { button.setDisabled(false); }
      }));
    new Setting(containerEl).setName("Cookie تکمیلی وب (اختیاری)").setDesc("فقط اگر اتصال خودکار جواب نداد، Cookie نشست وب TickTick را اینجا وارد کن. این مقدار مانند رمز عبور است.").addText(input => {
      input.inputEl.type = "password";
      input.inputEl.addClass("ticktick-input-cookie");
      input.setValue(this.plugin.settings.webSessionCookie).onChange(async value => { this.plugin.settings.webSessionCookie = normalizeWebSessionCookie(value); await this.plugin.saveSettings(); });
    });
    new Setting(containerEl).setName("بررسی اتصال وب عادت‌ها").setDesc("چک‌این‌های امروز را مستقیماً از سرویس وب TickTick می‌خواند.").addButton(button => button
      .setButtonText("اتصال عادت‌ها را بررسی کن")
      .onClick(async () => {
        button.setDisabled(true);
        try {
          const habits = await this.plugin.client().listHabits();
          const checkins = await this.plugin.webHabitCheckins(habits.map((habit: { id: string }) => habit.id), todayInZone(this.plugin.settings.timeZone));
          if (!checkins) throw new Error("نشست وب معتبر نیست یا TickTick پاسخ نداد.");
          const count = [...checkins.values()].flat().filter(entry => entry.status === 2).length;
          new Notice(`اتصال وب برقرار است: ${count} چک‌این امروز خوانده شد.`);
        } catch (error) { new Notice(error instanceof Error ? error.message : "اتصال وب عادت‌ها ناموفق بود."); }
        finally { button.setDisabled(false); }
      }));
    new Setting(containerEl).setName("بررسی اتصال").setDesc("با توکن واردشده، پروژه‌ها و عادت‌ها را از TickTick می‌خواند.").addButton(button => button
      .setButtonText("اتصال را بررسی کن")
      .onClick(async () => {
        button.setDisabled(true);
        try {
          const client = this.plugin.client();
          const [projects, habits] = await Promise.all([client.listProjects(), client.listHabits()]);
          new Notice(`اتصال برقرار است: ${projects.length} پروژه و ${habits.length} عادت پیدا شد.`);
        } catch (error) {
          new Notice(error instanceof Error ? error.message : "اتصال به TickTick ناموفق بود.");
        } finally {
          button.setDisabled(false);
        }
      }));
    new Setting(containerEl).setName("همگام‌سازی خودکار").setDesc("فاصلهٔ زمانی بر حسب ثانیه (حداقل ۳۰ ثانیه). صفر یعنی خاموش. نمایش از نسخهٔ محلی فوری است و این زمان فقط برای تازه‌سازی آن استفاده می‌شود.").addText(input => {
      input.inputEl.type = "number";
      input.inputEl.min = "0";
      input.setValue(String(this.plugin.settings.syncIntervalSeconds || this.plugin.settings.syncIntervalMinutes * 60)).onChange(async value => {
        const requested = Math.floor(Number(value) || 0);
        const seconds = requested > 0 ? Math.max(30, requested) : 0;
        this.plugin.settings.syncIntervalSeconds = seconds;
        this.plugin.settings.syncIntervalMinutes = 0;
        await this.plugin.saveSettings();
        this.plugin.configureAutomaticSync();
      });
    });
    new Setting(containerEl).setName("همگام‌سازی دستی").setDesc("نسخهٔ محلی تسک‌ها، عادت‌ها و تاریخچهٔ ۹۰ روز اخیر را همین حالا از TickTick تازه می‌کند.").addButton(button => button
      .setButtonText("همگام‌سازی الآن")
      .onClick(async () => {
        button.setDisabled(true);
        try { await this.plugin.syncNow(); } finally { button.setDisabled(false); }
      }));
    new Setting(containerEl).setName("تقویم برنامه‌ریزی").setDesc("هفته و شبکهٔ ماه از شنبه شروع می‌شوند و تسک تکمیل‌شده به‌صورت پیش‌فرض پنهان است.").addDropdown(dropdown => dropdown
      .addOption("6", "شنبه")
      .addOption("1", "دوشنبه")
      .addOption("0", "یکشنبه")
      .setValue(String(this.plugin.settings.plannerFirstWeekday))
      .onChange(async value => { this.plugin.settings.plannerFirstWeekday = Number(value); await this.plugin.saveSettings(); }))
      .addToggle(toggle => toggle.setValue(this.plugin.settings.plannerShowCompleted).setTooltip("نمایش تسک‌های تکمیل‌شده در تقویم").onChange(async value => { this.plugin.settings.plannerShowCompleted = value; await this.plugin.saveSettings(); }));
    new Setting(containerEl).setName("عادت‌های محلی").setDesc("منبع فقط‌خواندنی برای داشبورد و پیش‌نمایش مهاجرت؛ فایل‌ها هرگز خودکار تغییر یا حذف نمی‌شوند.").addText(input => input
      .setValue(this.plugin.settings.localHabitFolder)
      .onChange(async value => { this.plugin.settings.localHabitFolder = value.trim().replace(/^\/+|\/+$/g, ""); await this.plugin.saveSettings(); }))
      .addButton(button => button.setButtonText("مرور عادت‌ها").onClick(async () => { button.setDisabled(true); try { await this.plugin.reviewLocalHabits(); } finally { button.setDisabled(false); } }));
    new Setting(containerEl).setName("آیکون‌های اضافی نوار کناری").setDesc("آیکون همگام‌سازی همیشه نمایش داده می‌شود. با روشن‌کردن این گزینه، میانبر تسک‌ها و عادت‌ها هم نمایش داده می‌شوند.").addToggle(toggle => toggle
      .setValue(this.plugin.settings.showRibbonIcons)
      .onChange(async value => {
        this.plugin.settings.showRibbonIcons = value;
        await this.plugin.saveSettings();
        this.plugin.configureRibbonIcons();
      }));
    new Setting(containerEl).setName("Time zone").addText(input => input.setValue(this.plugin.settings.timeZone).onChange(async value => { this.plugin.settings.timeZone = value || "Asia/Tehran"; await this.plugin.saveSettings(); }));
    new Setting(containerEl).setName("Daily notes folder").addText(input => input.setValue(this.plugin.settings.dailyNoteFolder).onChange(async value => { this.plugin.settings.dailyNoteFolder = value; await this.plugin.saveSettings(); }));
  }
}

class LegacyBackupMigrationModal extends Modal {
  private resolveResult!: (value: boolean) => void;
  private result = new Promise<boolean>(resolve => this.resolveResult = resolve);
  private finished = false;
  constructor(app: App, private count: number, private size: number) { super(app); }
  onOpen() {
    this.contentEl.createEl("h2", { text: "انتقال پشتیبان‌های قدیمی" });
    this.contentEl.createEl("p", { text: `${this.count} فایل با مجموع ${this.size.toLocaleString()} بایت پیدا شد. هر فایل ابتدا به .ticktick/backups/legacy-root/ کپی و طول بایت آن بررسی می‌شود؛ فقط سپس نسخهٔ ریشه حذف خواهد شد.` });
    const actions = this.contentEl.createDiv({ cls: "modal-button-container" });
    actions.createEl("button", { text: "انصراف" }).addEventListener("click", () => this.finish(false));
    actions.createEl("button", { text: "انتقال", cls: "mod-warning" }).addEventListener("click", () => this.finish(true));
  }
  private finish(value: boolean) { if (this.finished) return; this.finished = true; this.resolveResult(value); this.close(); }
  onClose() { this.contentEl.empty(); if (!this.finished) { this.finished = true; this.resolveResult(false); } }
  openAndWait() { this.open(); return this.result; }
}

class ManagedReportModal extends Modal {
  constructor(app: App, private latest: { path: string; report: unknown } | null) { super(app); }
  onOpen() {
    this.contentEl.createEl("h2", { text: "آخرین گزارش مدیریت‌شده" });
    if (!this.latest) { this.contentEl.createEl("p", { text: "هنوز گزارشی در .ticktick/reports/ ثبت نشده است." }); return; }
    this.contentEl.createEl("p", { text: this.latest.path });
    this.contentEl.createEl("pre", { text: JSON.stringify(this.latest.report, null, 2) });
  }
  onClose() { this.contentEl.empty(); }
}

function publicCacheMetadata(cache: BridgeCache) {
  const task = (item: any) => ({ id: item?.id, projectId: item?.projectId, title: item?.title, status: item?.status, dueDate: item?.dueDate, startDate: item?.startDate });
  const habit = (item: any) => ({ id: item?.id, name: item?.name, status: item?.status, sectionId: item?.sectionId, sectionName: item?.sectionName });
  return { savedAt: cache.savedAt, tasks: cache.tasks.map(task), habits: cache.habits.map(habit), pendingCount: cache.pending.length, conflictCount: cache.conflicts.length };
}
