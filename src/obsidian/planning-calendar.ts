import { App, Menu, Modal, Notice, setIcon } from "obsidian";
import { renderUnifiedHabitCard } from "./habit-card";
import { HOURLY_SLOTS, isSamePersianMonth, isTaskUnscheduled, persianMonthRange, recurringTaskOccursOnDay, scheduleTaskDate, shiftCalendarDay, shiftPersianMonth, sortPlanningTasks, taskDateRange, taskHourSlot, tasksForCalendarDay, unscheduledTasks, unscheduleTaskDate, weekRange } from "../core/calendar-range.js";
import { formatPersianDate } from "../core/persian-date.js";
import { toDateKey, todayInZone } from "../core/date.js";
import { TaskDetailsModal } from "./task-details-modal";
import { taskPriority } from "./task-priority";
import { enhanceHorizontalScroll, scrollToStart } from "./horizontal-scroll";

import { matchesTaskFilter } from "../core/task-filter.js";
import { formatTaskEstimate } from "../core/task-hierarchy.js";
import { bulkSelectionStore } from "./selection-store";
import { BulkActionBar } from "./bulk-action-bar";
import {
  computeDayTimeSlots,
  computeTimeSlotDropMutation,
  computeResizeBlockMutation
} from "../core/timeblocking.js";
import { cleanTaskTitle } from "./helpers";
import type { TickTickTask, TickTickHabit, CachedHabitCheckin, HabitHistoryEntry, SavedView, TaskFilterState } from "./types";

export type HabitDetailsHost = {
  firstWeekday: number;
  habits: (day: string) => TickTickHabit[];
  habitHistory: (habitId: string, from: string, to: string) => HabitHistoryEntry[];
  setHabitProgress: (habit: TickTickHabit, day: string, value: number, goal: number) => Promise<unknown>;
  onEditHabit?: (habit: TickTickHabit) => void;
};

export type PlannerHost = HabitDetailsHost & {
  app: App;
  timeZone: string;
  firstWeekday: number;
  showCompleted: boolean;
  tasks: () => TickTickTask[];
  refresh: () => Promise<void>;
  reschedule: (task: TickTickTask, day: string, time?: string) => Promise<unknown>;
  unschedule: (task: TickTickTask) => Promise<unknown>;
  complete: (task: TickTickTask) => Promise<unknown>;
  binding: (task: TickTickTask) => unknown;
  openHabitEditor?: (habit?: TickTickHabit) => Promise<unknown>;
  load: (task: TickTickTask) => Promise<TickTickTask | undefined>;
  edit: (task: TickTickTask) => Promise<unknown>;
  create: (initial: Partial<TickTickTask>) => Promise<unknown>;
  updateTask?: (mutation: Partial<TickTickTask>) => Promise<any>;
  deleteTask?: (task: TickTickTask) => Promise<any>;
  habits: (day: string) => TickTickHabit[];
  checkInHabit: (habit: TickTickHabit, day: string) => Promise<unknown>;
  habitWithHistory: (habitId: string, day: string) => (TickTickHabit & { history?: HabitHistoryEntry[] }) | undefined;
  loadHabit: (habit: TickTickHabit) => Promise<TickTickHabit | undefined>;
  showHabits: () => boolean;
  setShowHabits: (value: boolean) => Promise<void>;
  savedViews?: () => SavedView[];
  saveSavedViews?: (views: SavedView[]) => Promise<void>;
  executeBulkOperation?: (taskIds: string[], op: string, params: any) => Promise<any>;
};

type Mode = "day" | "week" | "month";
type ColorMode = "project" | "tag" | "priority" | "uniform";

function habitGlyph(habit: Partial<TickTickHabit>) {
  const value = String(habit?.iconRes ?? habit?.icon ?? "").toLowerCase();
  if (/language|book|read|learn/.test(value)) return "📚";
  if (/sport|run|fitness|exercise/.test(value)) return "🏃";
  if (/meditat|mind|sleep/.test(value)) return "🧘";
  if (/water|drink/.test(value)) return "💧";
  if (/music|listen/.test(value)) return "🎵";
  if (/write|note/.test(value)) return "✍️";
  return "✓";
}

function formatTaskTime(task: Pick<TickTickTask, "isAllDay" | "startDate" | "dueDate">, timeZone: string): string | null {
  if (task.isAllDay) return null;
  const raw = task.startDate ?? task.dueDate;
  if (!raw || !String(raw).includes("T")) return null;
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return null;
    return new Intl.DateTimeFormat("fa-IR", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
  } catch {
    const m = String(raw).match(/T(\d{2}:\d{2})/);
    return m ? m[1] : null;
  }
}

class PlannerMultiSelectModal extends Modal {
  private answer?: Set<string>;
  constructor(app: App, private label: string, private values: string[], private selected: Set<string>, private prefix = "") {
    super(app);
  }

  openAndWait() {
    this.open();
    return new Promise<Set<string> | undefined>(resolve => {
      this.onClose = () => {
        this.contentEl.empty();
        resolve(this.answer);
      };
    });
  }

  onOpen() {
    this.modalEl.addClass("ticktick-filter-modal-dialog");
    this.titleEl.setText(`فیلتر ${this.label}`);
    const choices = new Set(this.selected);

    const searchBox = this.contentEl.createDiv({ cls: "ticktick-filter-search-box" });
    const searchInput = searchBox.createEl("input", {
      type: "search",
      placeholder: `جستجو در ${this.label}…`,
      cls: "ticktick-filter-search-input"
    });

    const list = this.contentEl.createDiv({ cls: "ticktick-planner-filter-modal" });

    const renderList = (filterText = "") => {
      list.empty();
      const filtered = this.values.filter(v => !filterText || v.toLowerCase().includes(filterText.toLowerCase()));
      if (!filtered.length) {
        list.createDiv({ cls: "ticktick-filter-empty", text: "موردی پیدا نشد" });
        return;
      }
      for (const value of filtered) {
        const row = list.createEl("label", { cls: "ticktick-filter-item" });
        const check = row.createEl("input", { type: "checkbox", cls: "ticktick-filter-checkbox" });
        check.checked = choices.has(value);
        row.createSpan({ cls: "ticktick-filter-item-text", text: `${this.prefix}${value}` });
        check.addEventListener("change", () => {
          check.checked ? choices.add(value) : choices.delete(value);
        });
      }
    };

    searchInput.addEventListener("input", () => renderList(searchInput.value.trim()));
    renderList();

    const actions = this.contentEl.createDiv({ cls: "modal-button-container ticktick-filter-actions" });
    const selectAllBtn = actions.createEl("button", { text: "انتخاب همه", cls: "ticktick-filter-quick-btn" });
    selectAllBtn.addEventListener("click", () => {
      this.values.forEach(v => choices.add(v));
      renderList(searchInput.value.trim());
    });

    const clearBtn = actions.createEl("button", { text: "حذف همه", cls: "ticktick-filter-quick-btn" });
    clearBtn.addEventListener("click", () => {
      choices.clear();
      renderList(searchInput.value.trim());
    });

    actions.createEl("button", { text: "لغو" }).addEventListener("click", () => this.close());
    actions.createEl("button", { text: "اعمال فیلتر", cls: "mod-cta" }).addEventListener("click", () => {
      this.answer = choices;
      this.close();
    });
  }
}

class TaskOverflowModal extends Modal {
  constructor(
    app: App,
    private tasks: TickTickTask[],
    private complete: (task: TickTickTask) => Promise<unknown>,
    private load: (task: TickTickTask) => Promise<TickTickTask | undefined>,
    private edit: (task: TickTickTask) => Promise<unknown>,
    private changed: () => Promise<void>,
    private dayLabel?: string,
    private updateTask?: (mutation: Partial<TickTickTask>) => Promise<any>,
    private allTasks?: () => TickTickTask[],
    private deleteTask?: (task: TickTickTask) => Promise<any>,
    private createTask?: (draft: Partial<TickTickTask>) => Promise<any>
  ) {
    super(app);
  }

  onOpen() {
    this.modalEl.addClass("ticktick-overflow-modal");
    this.titleEl.setText(this.dayLabel ? `تسک‌های ${this.dayLabel}` : "تسک‌های این روز");

    const container = this.contentEl.createDiv({ cls: "ticktick-overflow-list" });
    for (const task of this.tasks) {
      const priority = taskPriority(task.priority);
      const isCompleted = Number(task.status ?? 0) !== 0;
      const tone = task.projectColor || (
        Number(task.priority) === 5 ? "var(--color-red)" :
        Number(task.priority) === 3 ? "var(--color-orange)" :
        Number(task.priority) === 1 ? "var(--color-blue)" :
        "var(--interactive-accent)"
      );

      const row = container.createDiv({
        cls: `ticktick-overflow-task priority-${priority.value} ${isCompleted ? "is-completed" : ""}`,
        attr: { role: "button", tabindex: "0" }
      });
      row.style.setProperty("--ticktick-task-tone", tone);

      const openDetails = () => new TaskDetailsModal(this.app, task, {
        complete: async () => { await this.complete(task); },
        load: this.load,
        edit: this.edit,
        updateTask: this.updateTask ? (m) => this.updateTask!(m) : undefined,
        deleteTask: this.deleteTask ? (t) => this.deleteTask!(t) : undefined,
        createTask: this.createTask ? (d) => this.createTask!(d) : undefined,
        allTasks: this.allTasks,
        changed: this.changed
      }).open();

      row.addEventListener("click", openDetails);
      row.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openDetails();
        }
      });

      const check = row.createEl("input", { type: "checkbox", cls: "ticktick-overflow-check", attr: { "aria-label": `تکمیل ${task.title}` } });
      check.checked = isCompleted;
      check.disabled = isCompleted;
      check.addEventListener("click", e => e.stopPropagation());

      const main = row.createDiv({ cls: "ticktick-overflow-task-main" });
      const titleEl = main.createDiv({
        text: String(task.title ?? "بدون عنوان"),
        cls: "ticktick-overflow-task-title"
      });
      titleEl.addEventListener("click", event => {
        event.stopPropagation();
        openDetails();
      });

      if (task.projectName) {
        main.createSpan({ cls: "ticktick-overflow-task-project", text: task.projectName });
      }

      check.addEventListener("change", async () => {
        check.disabled = true;
        try {
          await this.complete(task);
          task.status = 2;
          await this.changed();
          new Notice("تسک تکمیل و همگام شد.");
        } catch (error) {
          check.checked = false;
          check.disabled = false;
          new Notice(error instanceof Error ? error.message : "تکمیل تسک ناموفق بود.");
        }
      });
    }
  }

  onClose() {
    this.contentEl.empty();
  }
}

export class HabitDetailsModal extends Modal {
  private month: string;
  private selectedDay: string;
  private history = new Map<string, HabitHistoryEntry>();
  private saving = false;
  constructor(app: App, private habit: TickTickHabit, private host: HabitDetailsHost, day: string) {
    super(app);
    this.month = day;
    this.selectedDay = day;
    // The planner already supplied its local history when the habit was clicked.
    this.history = new Map((Array.isArray(habit?.history) ? habit.history : [])
      .filter((entry: HabitHistoryEntry) => entry?.date)
      .map((entry: HabitHistoryEntry) => [String(entry.date), entry]));
    if (habit?.checkin) this.history.set(day, { date: day, value: Number(habit.checkin.value ?? 0), completed: Number(habit.checkin.status ?? 0) === 2 });
  }
  onOpen() {
    this.modalEl.addClass("ticktick-habit-details-modal");
    this.loadMonth();
  }
  private monthDays() { return persianMonthRange(this.month, this.host.firstWeekday).filter(day => isSamePersianMonth(day, this.month)); }
  private loadMonth() {
    const days = this.monthDays();
    const entries = this.host.habitHistory(String(this.habit.id), days[0], days.at(-1)!);
    this.history = new Map(entries.map((entry: HabitHistoryEntry) => [entry.date, entry]));
    this.render();
  }
  private selectedEntry() { return this.history.get(this.selectedDay) ?? { date: this.selectedDay, value: 0, completed: false }; }
  private render() {
    this.contentEl.empty();
    this.titleEl.setText(String(this.habit.name ?? "عادت"));
    const goal = Math.max(1, Number(this.habit.goal ?? this.habit.target ?? 1));
    const selected = this.selectedEntry(); const value = Number(selected.value ?? 0);
    const shell = this.contentEl.createDiv({ cls: "ticktick-habit-detail-shell" });
    const summary = shell.createDiv({ cls: "ticktick-habit-detail-summary" });
    summary.createDiv({ cls: "ticktick-habit-detail-icon", text: habitGlyph(this.habit) });
    const identity = summary.createDiv({ cls: "ticktick-habit-detail-identity" });
    identity.createEl("strong", { text: String(this.habit.name ?? "عادت") });
    identity.createSpan({ text: this.habit.sectionName ?? "TickTick" });
    const progress = summary.createDiv({ cls: "ticktick-habit-detail-progress" });
    progress.createEl("strong", { text: `${value}/${goal}` });
    progress.createSpan({ text: this.habit.unit || (goal > 1 ? "مرحله" : "ثبت") });

    if (this.host.onEditHabit) {
      const editBtn = summary.createEl("button", {
        cls: "ticktick-habit-detail-edit-btn",
        text: "ویرایش عادت",
        attr: { type: "button", title: "ویرایش تنظیمات عادت" }
      });
      setIcon(editBtn, "pencil");
      editBtn.addEventListener("click", () => {
        this.close();
        this.host.onEditHabit!(this.habit);
      });
    }

    const description = String(this.habit.description ?? this.habit.desc ?? this.habit.content ?? this.habit.notes ?? "").trim();
    if (description) {
      const box = shell.createDiv({ cls: "ticktick-habit-detail-description" });
      box.createEl("strong", { text: "توضیحات" });
      box.createDiv({ text: description });
    }

    const stage = shell.createDiv({ cls: "ticktick-habit-stage-control" });
    stage.createSpan({ text: `ثبت ${new Intl.DateTimeFormat("fa-IR-u-ca-persian", { weekday: "long", day: "numeric", month: "long" }).format(new Date(`${this.selectedDay}T12:00:00Z`))}` });
    const controls = stage.createDiv({ cls: "ticktick-habit-stage-buttons" });
    const decrease = controls.createEl("button", { text: "−", attr: { type: "button", "aria-label": "کم‌کردن یک مرحله" } });
    const count = controls.createEl("span", { text: `${value} از ${goal}` });
    const increase = controls.createEl("button", { text: "+", cls: "mod-cta", attr: { type: "button", "aria-label": "افزودن یک مرحله" } });
    decrease.disabled = value <= 0 || this.saving;
    increase.disabled = value >= goal || this.saving;
    const setValue = async (next: number) => {
      this.saving = true; decrease.disabled = increase.disabled = true;
      try {
        await this.host.setHabitProgress(this.habit, this.selectedDay, next, goal);
        this.history.set(this.selectedDay, { date: this.selectedDay, value: next, completed: next >= goal });
        new Notice(next >= goal ? "عادت کامل و همگام شد." : `پیشرفت عادت: ${next}/${goal}`);
      } catch (error) { new Notice(error instanceof Error ? error.message : "ثبت عادت ناموفق بود."); }
      this.saving = false; this.render();
    };
    decrease.addEventListener("click", () => void setValue(value - 1));
    increase.addEventListener("click", () => void setValue(value + 1));
    count.setAttribute("aria-live", "polite");

    const calendar = shell.createDiv({ cls: "ticktick-habit-detail-calendar" });
    const nav = calendar.createDiv({ cls: "ticktick-habit-calendar-nav" });
    const previous = nav.createEl("button", { text: "‹", attr: { type: "button", "aria-label": "ماه قبل" } });
    nav.createEl("strong", { text: new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric", month: "long" }).format(new Date(`${this.month}T12:00:00Z`)) });
    const next = nav.createEl("button", { text: "›", attr: { type: "button", "aria-label": "ماه بعد" } });
    previous.addEventListener("click", () => { this.month = shiftPersianMonth(this.month, -1); this.loadMonth(); });
    next.addEventListener("click", () => { this.month = shiftPersianMonth(this.month, 1); this.loadMonth(); });
    const weekday = calendar.createDiv({ cls: "ticktick-habit-calendar-weekdays" });
    for (const label of ["ش", "ی", "د", "س", "چ", "پ", "ج"]) weekday.createSpan({ text: label });
    const grid = calendar.createDiv({ cls: "ticktick-habit-history-calendar" });
    const days = this.monthDays();
    const firstOffset = (new Date(`${days[0]}T12:00:00Z`).getUTCDay() - this.host.firstWeekday + 7) % 7;
    for (let index = 0; index < firstOffset; index++) grid.createSpan({ cls: "ticktick-habit-history-blank" });
    for (const dayKey of days) {
      const entry = this.history.get(dayKey); const done = Boolean(entry?.completed); const scheduled = this.habit.repeatRule ? this.host.habits(dayKey).some(habit => String(habit.id) === String(this.habit.id)) : true;
      const day = grid.createEl("button", { cls: `ticktick-habit-history-day ${done ? "is-complete" : ""} ${scheduled ? "is-scheduled" : "is-unscheduled"} ${dayKey === this.selectedDay ? "is-selected" : ""}`, text: new Intl.DateTimeFormat("fa-IR-u-ca-persian", { day: "numeric" }).format(new Date(`${dayKey}T12:00:00Z`)), attr: { type: "button", title: `${dayKey}${done ? " · انجام شده" : scheduled ? " · انجام نشده" : " · بدون برنامه"}` } });
      day.disabled = !scheduled || this.saving;
      day.addEventListener("click", () => {
        this.selectedDay = dayKey;
        const dayValue = Number(entry?.value ?? 0);
        // A day cell is also a quick check-in surface: every press records one
        // stage for that exact date, while unscheduled dates stay unavailable.
        if (dayValue >= goal) void setValue(0);
        else void setValue(Math.min(goal, dayValue + Math.max(1, Number(this.habit.step ?? 1))));
      });
    }
  }
  onClose() { this.contentEl.empty(); }
}

export class UnscheduleConfirmModal extends Modal {
  private confirmed = false;

  constructor(app: App, private task: TickTickTask, private onConfirm: () => void) {
    super(app);
  }

  onOpen() {
    this.modalEl.addClass("ticktick-unschedule-modal");
    this.titleEl.setText("حذف تاریخ و انتقال به بک‌لاگ");
    this.contentEl.createEl("p", {
      text: `آیا مطمئن هستید که می‌خواهید زمان‌بندی تسک «${this.task.title || "بدون عنوان"}» را حذف کرده و آن را به ستون بک‌لاگ (تسک‌های بدون تاریخ) منتقل کنید؟`
    });

    const actions = this.contentEl.createDiv({ cls: "modal-button-container" });
    actions.createEl("button", { text: "انصراف" }).addEventListener("click", () => this.close());
    const confirmBtn = actions.createEl("button", {
      text: "انتقال به بک‌لاگ",
      cls: "mod-warning"
    });
    confirmBtn.addEventListener("click", () => {
      this.confirmed = true;
      this.close();
    });
  }

  onClose() {
    this.contentEl.empty();
    if (this.confirmed) {
      this.onConfirm();
    }
  }
}

export class PlanningCalendar {
  private backlogCollapsed = true;
  private showTimeGrid = false;
  private mode: Mode = "week";
  private day: string;
  private projects = new Set<string>();
  private tags = new Set<string>();
  private sortMode = "ticktick";
  private colorMode: ColorMode = "project";
  private showHabits = false;
  private showHabitsForAllDays = false;
  private showAllRecurring = false;
  private draggingTaskId = "";
  private filterState: TaskFilterState = {
    projects: [],
    tags: [],
    statuses: [],
    priorities: [],
    dateRange: null,
    searchText: "",
    grouping: "none",
    sort: "ticktick"
  };
  private draggingSourceDay = "";
  private lastRenderedDay?: string;
  private lastRenderedMode?: Mode;
  private lastRenderSignature = "";
  private bulkActionBar: BulkActionBar | null = null;
  private savedGridScrollLeft = 0;
  private savedGridScrollTop = 0;
  private savedDrawerScrollTop = 0;
  private savedBodyScrollTop = 0;
  private savedBodyScrollLeft = 0;
  private savedHostScrollTop = 0;
  private savedHostScrollLeft = 0;
  private savedBacklogScrollTop = 0;
  private isRendering = false;
  private wasRecentlyRendering = false;

  constructor(private element: HTMLElement, private host: PlannerHost) {
    this.day = todayInZone(host.timeZone);
    this.showHabits = host.showHabits();
  }

  async render(force = false) {
    const tasks = this.filteredTasks();
    const habits = this.showHabits ? this.host.habits(this.day) : [];

    // Lightweight data signature to skip redundant DOM teardown during periodic 30s background sync
    const currentSignature = JSON.stringify({
      mode: this.mode,
      day: this.day,
      projects: [...this.projects],
      tags: [...this.tags],
      sortMode: this.sortMode,
      colorMode: this.colorMode,
      showHabits: this.showHabits,
      showHabitsForAllDays: this.showHabitsForAllDays,
      showAllRecurring: this.showAllRecurring,
      backlogCollapsed: this.backlogCollapsed,
      showTimeGrid: this.showTimeGrid,
      taskCount: tasks.length,
      tasksSig: tasks.map(t => `${t.id}:${t.status}:${t.dueDate}:${t.title}:${t.priority}:${t.projectName || ""}:${(t.tags ?? []).join(",")}`).join("|"),
      habitsSig: habits.map(h => `${h.id}:${h.checkin?.status}:${h.checkin?.value}:${h.goal}`).join("|")
    });

    if (!force && this.lastRenderSignature === currentSignature && this.element.hasChildNodes()) {
      return;
    }

    // Cache writes re-render the same planner. Preserve the surrounding view's
    // vertical and horizontal scroll positions so drag/drop or the 30s background sync
    // does not throw the user back to the top of the planner.
    const bodySlot = this.element.closest<HTMLElement>(".ticktick-workspace-body-slot") ?? this.element;
    const scrollHost = this.element.closest<HTMLElement>(".view-content, .workspace-leaf-content") ?? this.element.parentElement;
    const isSameView = this.lastRenderedMode === this.mode && this.lastRenderedDay === this.day;

    if (bodySlot && isSameView) {
      if (bodySlot.scrollTop > 0) this.savedBodyScrollTop = bodySlot.scrollTop;
      if (bodySlot.scrollLeft !== 0) this.savedBodyScrollLeft = bodySlot.scrollLeft;
    }
    if (scrollHost && isSameView) {
      if (scrollHost.scrollTop > 0) this.savedHostScrollTop = scrollHost.scrollTop;
      if (scrollHost.scrollLeft !== 0) this.savedHostScrollLeft = scrollHost.scrollLeft;
    }

    if (bodySlot && !(bodySlot as any)._ttbPlannerScrollTrackingAttached) {
      (bodySlot as any)._ttbPlannerScrollTrackingAttached = true;
      bodySlot.addEventListener("scroll", () => {
        if (!this.isRendering && this.lastRenderedMode === this.mode && this.lastRenderedDay === this.day) {
          if (bodySlot.scrollTop > 0) {
            this.savedBodyScrollTop = bodySlot.scrollTop;
          } else if (bodySlot.scrollTop === 0 && !this.wasRecentlyRendering) {
            this.savedBodyScrollTop = 0;
          }
          if (bodySlot.scrollLeft !== 0) {
            this.savedBodyScrollLeft = bodySlot.scrollLeft;
          }
        }
      }, { passive: true });
    }
    if (scrollHost && !(scrollHost as any)._ttbPlannerHostScrollTrackingAttached) {
      (scrollHost as any)._ttbPlannerHostScrollTrackingAttached = true;
      scrollHost.addEventListener("scroll", () => {
        if (!this.isRendering && this.lastRenderedMode === this.mode && this.lastRenderedDay === this.day) {
          if (scrollHost.scrollTop > 0) {
            this.savedHostScrollTop = scrollHost.scrollTop;
          } else if (scrollHost.scrollTop === 0 && !this.wasRecentlyRendering) {
            this.savedHostScrollTop = 0;
          }
          if (scrollHost.scrollLeft !== 0) {
            this.savedHostScrollLeft = scrollHost.scrollLeft;
          }
        }
      }, { passive: true });
    }

    const existingGrid = this.element.querySelector<HTMLElement>(".ticktick-planner-days, .ticktick-planner-month, .ticktick-timeblock-grid-container");
    if (existingGrid && isSameView) {
      if (existingGrid.scrollLeft !== 0) this.savedGridScrollLeft = existingGrid.scrollLeft;
      if (existingGrid.scrollTop > 0) this.savedGridScrollTop = existingGrid.scrollTop;
    }
    const existingDrawer = this.element.querySelector<HTMLElement>(".ticktick-timeblock-drawer");
    if (existingDrawer && isSameView && existingDrawer.scrollTop > 0) {
      this.savedDrawerScrollTop = existingDrawer.scrollTop;
    }
    const existingBacklog = this.element.querySelector<HTMLElement>(".ticktick-planner-backlog-cards");
    if (existingBacklog) {
      if (existingBacklog.scrollTop > 0) this.savedBacklogScrollTop = existingBacklog.scrollTop;
    }

    // Keep the slot height from collapsing to 0 during DOM rebuild so Chromium doesn't reset scrollTop to 0
    const prevScrollHeight = bodySlot.scrollHeight;
    if (isSameView && prevScrollHeight > 0) {
      bodySlot.style.minHeight = `${prevScrollHeight}px`;
    }

    this.isRendering = true;
    this.wasRecentlyRendering = true;
    this.element.empty();
    this.element.addClass("ticktick-planner");

    const root = this.element.createDiv({ cls: "ticktick-planner-root" });
    const controls = root.createDiv({ cls: "ticktick-planner-controls" });

    // 1. Mode Segmented Control
    const modesContainer = controls.createDiv({ cls: "ticktick-planner-modes" });
    for (const [mode, label, icon] of [["day", "روز", "calendar"], ["week", "هفته", "calendar-days"], ["month", "ماه", "calendar-range"]] as Array<[Mode, string, string]>) {
      const button = modesContainer.createEl("button", {
        cls: `ticktick-planner-mode-btn ${this.mode === mode ? "is-active" : ""}`,
        attr: { type: "button" }
      });
      const iconSpan = button.createSpan({ cls: "ticktick-mode-icon" });
      setIcon(iconSpan, icon);
      button.createSpan({ text: label });
      button.addEventListener("click", () => {
        if (this.mode !== mode) {
          this.savedBodyScrollTop = 0;
          this.savedBodyScrollLeft = 0;
          this.savedGridScrollLeft = 0;
          this.savedGridScrollTop = 0;
          this.mode = mode;
          void this.render(true);
        }
      });
    }

    // 2. Date Navigation Controls
    const nav = controls.createDiv({ cls: "ticktick-planner-nav" });
    const step = this.mode === "week" ? 7 : 1;

    // Keep the visual arrows in the order users expect in the calendar bar:
    // previous on the left, next on the right.
    const prevBtn = nav.createEl("button", {
      cls: "ticktick-nav-btn mod-icon",
      text: "‹",
      attr: { type: "button", "aria-label": "قبلی" }
    });
    prevBtn.addEventListener("click", () => {
      this.savedBodyScrollTop = 0;
      this.savedBodyScrollLeft = 0;
      this.savedGridScrollLeft = 0;
      this.savedGridScrollTop = 0;
      this.day = this.mode === "month" ? shiftPersianMonth(this.day, -1) : shiftCalendarDay(this.day, -step);
      void this.render(true);
    });

    const todayBtn = nav.createEl("button", {
      cls: "ticktick-nav-today-btn",
      text: "امروز",
      attr: { type: "button" }
    });
    todayBtn.addEventListener("click", () => {
      this.savedBodyScrollTop = 0;
      this.savedBodyScrollLeft = 0;
      this.savedGridScrollLeft = 0;
      this.savedGridScrollTop = 0;
      this.day = todayInZone(this.host.timeZone);
      void this.render(true);
    });

    const nextBtn = nav.createEl("button", {
      cls: "ticktick-nav-btn mod-icon",
      text: "›",
      attr: { type: "button", "aria-label": "بعدی" }
    });
    nextBtn.addEventListener("click", () => {
      this.savedBodyScrollTop = 0;
      this.savedBodyScrollLeft = 0;
      this.savedGridScrollLeft = 0;
      this.savedGridScrollTop = 0;
      this.day = this.mode === "month" ? shiftPersianMonth(this.day, 1) : shiftCalendarDay(this.day, step);
      void this.render(true);
    });

    const titleFormatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian", this.mode === "month"
      ? { year: "numeric", month: "long" }
      : this.mode === "week"
        ? { year: "numeric", month: "long" }
        : { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    nav.createEl("span", {
      cls: "ticktick-planner-date-title",
      text: titleFormatter.format(new Date(`${this.day}T12:00:00Z`))
    });

    // 3. Filters Bar
    this.renderFilters(root);

    // 5. Tasks & Grid
    if (!tasks.length) {
      const emptyBox = root.createDiv({ cls: "ticktick-planner-empty" });
      emptyBox.createEl("p", { text: "تسکی برای نمایش در این بازه یا فیلتر یافت نشد." });
      emptyBox.createEl("small", { text: "می‌توانید با دکمهٔ «افزودن تسک» برنامه جدیدی بسازید." });
    }

    if (this.mode === "month") {
      this.renderMonth(root, tasks);
    } else if (this.mode === "day") {
      this.renderDayTimeblockView(root, this.day, tasks);
    } else {
      this.renderDays(root, weekRange(this.day, this.host.firstWeekday), tasks);
    }
    const restoreScrolls = () => {
      if (isSameView) {
        if (bodySlot && (this.savedBodyScrollTop > 0 || this.savedBodyScrollLeft !== 0)) {
          bodySlot.scrollTo({
            top: this.savedBodyScrollTop,
            left: this.savedBodyScrollLeft,
            behavior: "instant" as ScrollBehavior
          });
        }
        if (scrollHost && (this.savedHostScrollTop > 0 || this.savedHostScrollLeft !== 0)) {
          scrollHost.scrollTo({
            top: this.savedHostScrollTop,
            left: this.savedHostScrollLeft,
            behavior: "instant" as ScrollBehavior
          });
        }
        const newGrid = this.element.querySelector<HTMLElement>(".ticktick-planner-days, .ticktick-planner-month, .ticktick-timeblock-grid-container");
        if (newGrid) {
          if (this.savedGridScrollLeft !== 0) newGrid.scrollLeft = this.savedGridScrollLeft;
          if (this.savedGridScrollTop > 0) newGrid.scrollTop = this.savedGridScrollTop;
        }
        const newDrawer = this.element.querySelector<HTMLElement>(".ticktick-timeblock-drawer");
        if (newDrawer && this.savedDrawerScrollTop > 0) {
          newDrawer.scrollTop = this.savedDrawerScrollTop;
        }
        const newBacklog = this.element.querySelector<HTMLElement>(".ticktick-planner-backlog-cards");
        if (newBacklog && this.savedBacklogScrollTop > 0) {
          newBacklog.scrollTop = this.savedBacklogScrollTop;
        }
      }
    };

    restoreScrolls();
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => {
        restoreScrolls();
        bodySlot.style.minHeight = "";
      });
    } else {
      bodySlot.style.minHeight = "";
    }
    setTimeout(() => restoreScrolls(), 50);
    setTimeout(() => restoreScrolls(), 150);
    setTimeout(() => {
      restoreScrolls();
      this.isRendering = false;
    }, 300);
    setTimeout(() => {
      this.wasRecentlyRendering = false;
    }, 600);

    this.bulkActionBar ??= new BulkActionBar(this.element, {
      app: this.host.app,
      timeZone: this.host.timeZone,
      tasks: () => this.host.tasks(),
      projects: async () => {
        const tasks = this.host.tasks();
        const projs = [...new Set(tasks.map(t => t.projectId).filter(Boolean))];
        return projs.map(id => ({ id: String(id), name: String(tasks.find(t => t.projectId === id)?.projectName || id) } as any));
      },
      executeBulkOperation: async (ids, op, params) => this.host.executeBulkOperation ? this.host.executeBulkOperation(ids, op, params) : null,
      onChanged: async () => {
        await this.host.refresh();
        await this.render(true);
      }
    });
    void this.bulkActionBar.render();
    this.lastRenderedDay = this.day;
    this.lastRenderedMode = this.mode;
    this.lastRenderSignature = currentSignature;
  }

  private renderFilters(root: HTMLElement) {
    const filters = root.createDiv({ cls: "ticktick-planner-filters" });
    const tasks = this.host.tasks();

    const unscheduledCount = unscheduledTasks(this.filteredTasks(), this.host.timeZone).length;
    const backlogBtn = filters.createEl("button", {
      cls: `ticktick-filter-chip ticktick-planner-toggle-btn ${!this.backlogCollapsed ? "is-active is-filtered" : ""}`,
      attr: { type: "button", "aria-label": "تغییر وضعیت نمایش ستون بک‌لاگ", title: "نمایش یا مخفی‌سازی ستون تسک‌های بدون تاریخ" }
    });
    const bIcon = backlogBtn.createSpan({ cls: "ticktick-chip-icon" });
    setIcon(bIcon, "layout-list");
    backlogBtn.createSpan({ text: `بک‌لاگ (${unscheduledCount})` });
    backlogBtn.addEventListener("click", () => {
      this.backlogCollapsed = !this.backlogCollapsed;
      void this.render();
    });

    if (this.mode !== "month") {
      const timeGridBtn = filters.createEl("button", {
        cls: `ticktick-filter-chip ticktick-planner-toggle-btn ${this.showTimeGrid ? "is-active is-filtered" : ""}`,
        attr: { type: "button", "aria-label": "نمایش شبکهٔ ساعتی", title: "تغییر حالت به شبکهٔ ساعتی جهت زمان‌بندی دقیق" }
      });
      const tgIcon = timeGridBtn.createSpan({ cls: "ticktick-chip-icon" });
      setIcon(tgIcon, "clock");
      timeGridBtn.createSpan({ text: this.showTimeGrid ? "ساعت: روشن" : "شبکهٔ ساعتی" });
      timeGridBtn.addEventListener("click", () => {
        this.showTimeGrid = !this.showTimeGrid;
        void this.render();
      });
    }

    const habitsBtn = filters.createEl("button", {
      cls: `ticktick-filter-chip ${this.showHabits ? "is-filtered" : ""}`,
      attr: { type: "button", "aria-pressed": String(this.showHabits) }
    });
    const habitsIcon = habitsBtn.createSpan({ cls: "ticktick-chip-icon" });
    setIcon(habitsIcon, "activity");
    habitsBtn.createSpan({ text: this.showHabits ? "عادت‌ها: روشن" : "نمایش عادت‌ها" });
    habitsBtn.addEventListener("click", () => {
      this.showHabits = !this.showHabits;
      void this.host.setShowHabits(this.showHabits).then(() => this.render());
    });
    if (this.showHabits) {
      const scopeBtn = filters.createEl("button", {
        cls: `ticktick-filter-chip ${this.showHabitsForAllDays ? "is-filtered" : ""}`,
        attr: { type: "button", title: "محدوده نمایش عادت‌ها در تقویم" }
      });
      setIcon(scopeBtn.createSpan({ cls: "ticktick-chip-icon" }), this.showHabitsForAllDays ? "calendar-days" : "calendar-check");
      scopeBtn.createSpan({ text: this.showHabitsForAllDays ? "عادت‌ها: همهٔ روزها" : "عادت‌ها: فقط امروز" });
      scopeBtn.addEventListener("click", () => {
        this.showHabitsForAllDays = !this.showHabitsForAllDays;
        void this.render();
      });
    }
    const recurringBtn = filters.createEl("button", { cls: `ticktick-filter-chip ${this.showAllRecurring ? "is-filtered" : ""}`, attr: { type: "button" } });
    setIcon(recurringBtn.createSpan({ cls: "ticktick-chip-icon" }), "repeat-2");
    recurringBtn.createSpan({ text: this.showAllRecurring ? "تکرارشونده‌ها: همهٔ رخدادها" : "تکرارشونده‌ها: رخداد بعدی" });
    recurringBtn.addEventListener("click", () => { this.showAllRecurring = !this.showAllRecurring; void this.render(); });

    // Sort Menu Button
    const sortLabels: Record<string, string> = {
      ticktick: "ترتیب TickTick",
      time: "ساعت",
      priority: "اولویت",
      title: "عنوان"
    };
    const sortBtn = filters.createDiv({
      cls: "ticktick-filter-select-wrapper",
      attr: { role: "button", tabindex: "0", "aria-label": "مرتب‌سازی تسک‌ها" }
    });
    const sortIcon = sortBtn.createSpan({ cls: "ticktick-select-icon" });
    setIcon(sortIcon, "arrow-up-down");
    sortBtn.createSpan({
      cls: "ticktick-filter-select-label",
      text: `مرتب‌سازی: ${sortLabels[this.sortMode] ?? "ترتیب TickTick"}`
    });
    const sortChevron = sortBtn.createSpan({ cls: "ticktick-select-chevron" });
    setIcon(sortChevron, "chevron-down");

    const openSortMenu = (event: MouseEvent | KeyboardEvent) => {
      const menu = new Menu();
      for (const [value, label] of [["ticktick", "ترتیب TickTick"], ["time", "ساعت"], ["priority", "اولویت"], ["title", "عنوان"]]) {
        menu.addItem(item => {
          item.setTitle(label)
              .setChecked(this.sortMode === value)
              .onClick(() => {
                this.sortMode = value;
                void this.render();
              });
        });
      }
      if (event instanceof MouseEvent) {
        menu.showAtMouseEvent(event);
      } else {
        const rect = sortBtn.getBoundingClientRect();
        menu.showAtPosition({ x: rect.right, y: rect.bottom });
      }
    };
    sortBtn.addEventListener("click", openSortMenu);
    sortBtn.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openSortMenu(event);
      }
    });

    // Color Mode Menu Button
    const colorLabels: Record<string, string> = {
      project: "رنگ: پروژه",
      tag: "رنگ: برچسب",
      priority: "رنگ: اولویت",
      uniform: "رنگ: یکدست"
    };
    const colorBtn = filters.createDiv({
      cls: "ticktick-filter-select-wrapper",
      attr: { role: "button", tabindex: "0", "aria-label": "رنگ‌بندی تسک‌ها" }
    });
    const colorIcon = colorBtn.createSpan({ cls: "ticktick-select-icon" });
    setIcon(colorIcon, "palette");
    colorBtn.createSpan({
      cls: "ticktick-filter-select-label",
      text: colorLabels[this.colorMode] ?? "رنگ: پروژه"
    });
    const colorChevron = colorBtn.createSpan({ cls: "ticktick-select-chevron" });
    setIcon(colorChevron, "chevron-down");

    const openColorMenu = (event: MouseEvent | KeyboardEvent) => {
      const menu = new Menu();
      for (const [value, label] of [["project", "رنگ: پروژه"], ["tag", "رنگ: برچسب"], ["priority", "رنگ: اولویت"], ["uniform", "رنگ: یکدست"]] as Array<[ColorMode, string]>) {
        menu.addItem(item => {
          item.setTitle(label)
              .setChecked(this.colorMode === value)
              .onClick(() => {
                this.colorMode = value;
                void this.render();
              });
        });
      }
      if (event instanceof MouseEvent) {
        menu.showAtMouseEvent(event);
      } else {
        const rect = colorBtn.getBoundingClientRect();
        menu.showAtPosition({ x: rect.right, y: rect.bottom });
      }
    };
    colorBtn.addEventListener("click", openColorMenu);
    colorBtn.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openColorMenu(event);
      }
    });

    // Project filter button
    const projects = [...new Set(tasks.map(task => String(task.projectName ?? task.projectId ?? "ورودی")))].sort((left, right) => left.localeCompare(right, "fa"));
    const projectBtn = filters.createEl("button", {
      cls: `ticktick-filter-chip ${this.projects.size ? "is-filtered" : ""}`,
      attr: { type: "button" }
    });
    const folderIcon = projectBtn.createSpan({ cls: "ticktick-chip-icon" });
    setIcon(folderIcon, "folder");
    projectBtn.createSpan({ text: this.projects.size ? `پروژه (${this.projects.size})` : "پروژه‌ها" });
    projectBtn.addEventListener("click", async () => {
      const value = await new PlannerMultiSelectModal(this.host.app, "پروژه‌ها", projects, this.projects).openAndWait();
      if (value) {
        this.projects = value;
        await this.render();
      }
    });

    // Tag filter button
    const tags = [...new Set(tasks.flatMap(task => task.tags ?? []).map(String))].sort((left, right) => left.localeCompare(right, "fa"));
    const tagBtn = filters.createEl("button", {
      cls: `ticktick-filter-chip ${this.tags.size ? "is-filtered" : ""}`,
      attr: { type: "button" }
    });
    const tagIcon = tagBtn.createSpan({ cls: "ticktick-chip-icon" });
    setIcon(tagIcon, "tag");
    tagBtn.createSpan({ text: this.tags.size ? `برچسب (${this.tags.size})` : "برچسب‌ها" });
    tagBtn.addEventListener("click", async () => {
      const value = await new PlannerMultiSelectModal(this.host.app, "برچسب‌ها", tags, this.tags, "#").openAndWait();
      if (value) {
        this.tags = value;
        await this.render();
      }
    });

    // Clear filters button
    if (this.projects.size || this.tags.size) {
      const clear = filters.createEl("button", {
        cls: "ticktick-filter-clear-btn",
        attr: { type: "button", "aria-label": "پاک‌کردن فیلترها" }
      });
      const clearIcon = clear.createSpan({ cls: "ticktick-chip-icon" });
      setIcon(clearIcon, "x");
      clear.createSpan({ text: "پاک‌کردن فیلترها" });
      clear.addEventListener("click", () => {
        this.projects.clear();
        this.tags.clear();
        void this.render();
      });
    }
  }

  private filteredTasks() {
    return this.host.tasks().filter(task =>
      matchesTaskFilter(task, this.filterState, { timeZone: this.host.timeZone }) &&
      (!this.projects.size || this.projects.has(String(task.projectName ?? task.projectId ?? "ورودی"))) &&
      (!this.tags.size || (task.tags ?? []).some((tag: string) => this.tags.has(String(tag))))
    );
  }

  private renderDayTimeblockView(root: HTMLElement, targetDay: string, tasks: TickTickTask[]) {
    const today = todayInZone(this.host.timeZone);
    const isToday = targetDay === today;

    const workspace = root.createDiv({ cls: `ticktick-planner-workspace ${this.backlogCollapsed ? "is-backlog-collapsed" : ""}` });
    if (!this.backlogCollapsed) {
      this.renderBacklogColumn(workspace, tasks);
    }

    const dayView = workspace.createDiv({ cls: "ticktick-planner-day-timeblock-root" });

    // 1. Sleek Day Header Bar
    const header = dayView.createDiv({ cls: "ticktick-day-timeblock-header", attr: { "data-day": targetDay } });
    const infoCol = header.createDiv({ cls: "ticktick-day-timeblock-header-info" });

    // Round Day Number Badge
    const dayNumber = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { day: "numeric" }).format(new Date(`${targetDay}T12:00:00Z`));
    infoCol.createDiv({
      cls: `ticktick-day-timeblock-badge ${isToday ? "is-today-badge" : ""}`,
      text: dayNumber
    });

    // Date Title & Meta Badges
    const weekdayName = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { weekday: "long" }).format(new Date(`${targetDay}T12:00:00Z`));
    const monthName = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { month: "long" }).format(new Date(`${targetDay}T12:00:00Z`));
    infoCol.createSpan({
      cls: "ticktick-day-timeblock-title",
      text: `${weekdayName}، ${dayNumber} ${monthName}`
    });

    const metaWrap = infoCol.createDiv({ cls: "ticktick-day-timeblock-meta" });
    if (isToday) {
      metaWrap.createSpan({ cls: "ticktick-today-pill", text: "امروز" });
    }

    // 2. Identify Range tasks and Non-range tasks
    const rangeTasks = tasks.filter(task => {
      if (Number(task.status ?? 0) !== 0 && !this.host.showCompleted) return false;
      const range = taskDateRange(task, this.host.timeZone);
      return Boolean(range && range.start <= targetDay && range.end >= targetDay);
    });

    const nonRangeTasks = tasks.filter(task => {
      const range = taskDateRange(task, this.host.timeZone);
      return !range;
    });

    const agendaData = computeDayTimeSlots(nonRangeTasks, targetDay, {
      startHour: 7,
      endHour: 23,
      slotMinutes: 30,
      timeZone: this.host.timeZone,
      showCompleted: this.host.showCompleted
    });

    const totalDayTasksCount = rangeTasks.length + agendaData.timed.length + agendaData.untimed.length;
    metaWrap.createSpan({ cls: "ticktick-day-stat-pill", text: `${totalDayTasksCount} تسک` });
    if (agendaData.timed.length > 0) {
      metaWrap.createSpan({ cls: "ticktick-day-stat-pill is-timed", text: `${agendaData.timed.length} زمان‌دار` });
    }
    if (agendaData.untimed.length > 0) {
      metaWrap.createSpan({ cls: "ticktick-day-stat-pill is-untimed", text: `${agendaData.untimed.length} بدون ساعت` });
    }

    // Header Actions: "+ تسک جدید" Button
    const actions = header.createDiv({ cls: "ticktick-day-timeblock-header-actions" });
    const addBtn = actions.createEl("button", {
      cls: "ticktick-day-add-task-btn",
      attr: { type: "button", "aria-label": `افزودن تسک جدید`, title: `افزودن تسک جدید` }
    });
    const addIcon = addBtn.createSpan({ cls: "ticktick-btn-icon" });
    setIcon(addIcon, "plus");
    addBtn.createSpan({ text: "تسک جدید" });
    addBtn.addEventListener("click", () => void this.addTask(targetDay));

    // 3. Range Tasks Section (Multi-day tasks that span targetDay)
    if (rangeTasks.length > 0) {
      const rangeSection = dayView.createDiv({ cls: "ticktick-planner-day-range-section" });
      const rangeHeader = rangeSection.createDiv({ cls: "ticktick-planner-day-range-header" });
      const iconSpan = rangeHeader.createSpan({ cls: "ticktick-range-header-icon mod-icon" });
      setIcon(iconSpan, "calendar-range");
      rangeHeader.createSpan({ text: `تسک‌های بازه‌ای (${rangeTasks.length})` });

      const rangeLanes = rangeSection.createDiv({ cls: "ticktick-planner-range-lanes is-day-view" });
      for (const task of rangeTasks) {
        const range = taskDateRange(task, this.host.timeZone)!;
        const priority = taskPriority(task.priority);
        const isCompleted = Number(task.status ?? 0) !== 0;
        const tone = this.taskTone(task);

        const bar = rangeLanes.createDiv({
          cls: `ticktick-planner-range-task priority-${priority.value} ${isCompleted ? "is-completed" : ""}`,
          attr: {
            title: `بازهٔ ${range.start} تا ${range.end} · ${task.title}`,
            role: "button",
            tabindex: "0"
          }
        });
        bar.dataset.taskId = String(task.id);
        bar.style.setProperty("--ticktick-task-tone", tone);

        const openDetails = () => new TaskDetailsModal(this.host.app, task, {
          complete: () => this.completeTask(task),
          load: item => this.host.load(item),
          edit: item => this.host.edit(item),
          updateTask: this.host.updateTask ? (m) => this.host.updateTask!(m) : undefined,
          deleteTask: this.host.deleteTask ? (t) => this.host.deleteTask!(t) : undefined,
          createTask: this.host.create ? (d) => this.host.create(d) : undefined,
          changed: async () => {
            await this.host.refresh();
            await this.render();
          },
          allTasks: () => this.host.tasks(),
        }).open();

        if (bulkSelectionStore.isSelected(String(task.id))) {
          bar.addClass("is-bulk-selected");
        }

        bar.addEventListener("click", event => {
          if (event.shiftKey || event.ctrlKey || event.metaKey) {
            event.preventDefault();
            event.stopPropagation();
            const sel = bulkSelectionStore.toggle(String(task.id));
            bar.toggleClass("is-bulk-selected", sel);
            return;
          }
          openDetails();
        });

        const check = bar.createEl("input", { type: "checkbox", cls: "ticktick-range-check", attr: { "aria-label": `تکمیل ${task.title}` } });
        check.checked = isCompleted;
        check.disabled = isCompleted;
        check.addEventListener("click", e => e.stopPropagation());
        check.addEventListener("change", () => void this.completeTask(task, check));

        const rangeIcon = bar.createSpan({ cls: "ticktick-range-indicator mod-icon", attr: { "aria-hidden": "true" } });
        setIcon(rangeIcon, "calendar-range");

        const titleEl = bar.createDiv({
          cls: "ticktick-range-title",
          text: String(task.title ?? "بدون عنوان")
        });
        titleEl.addEventListener("click", event => {
          event.stopPropagation();
          openDetails();
        });

        const pStart = formatPersianDate(range.start);
        const pEnd = formatPersianDate(range.end);
        bar.createSpan({
          cls: "ticktick-range-dates-badge",
          text: `${pStart} تا ${pEnd}`
        });

        bar.draggable = true;
        bar.addEventListener("dragstart", event => {
          bar.addClass("is-dragging");
          this.beginTaskDrag(task, event, bar);
          event.dataTransfer!.effectAllowed = "move";
          event.dataTransfer?.setData("text/ticktick-task", String(task.id));
          event.dataTransfer?.setData("text/plain", String(task.id));
        });
        bar.addEventListener("dragend", () => {
          bar.removeClass("is-dragging");
          this.clearTaskDrag();
        });
      }
    }

    // 4. Main Timeblock Content (Hourly Grid + Side Drawer)
    const content = dayView.createDiv({ cls: "ticktick-timeblock-content" });

    // Grid Container
    const gridContainer = content.createDiv({ cls: "ticktick-timeblock-grid-container" });
    const grid = gridContainer.createDiv({ cls: "ticktick-timeblock-grid" });

    // Time Label Column
    const timeCol = grid.createDiv({ cls: "ticktick-timeblock-time-col" });
    for (const slot of agendaData.slots) {
      const lbl = timeCol.createDiv({
        cls: `ticktick-timeblock-time-label ${slot.isHourMark ? "is-hour" : ""}`
      });
      lbl.setText(slot.isHourMark ? slot.timeLabel : "");
    }

    // Slots Column (Drop targets & Blocks container)
    const slotsCol = grid.createDiv({ cls: "ticktick-timeblock-slots-col" });

    for (const slot of agendaData.slots) {
      const row = slotsCol.createDiv({
        cls: `ticktick-timeblock-slot-row ${slot.isHourMark ? "is-hour" : ""}`
      });
      row.dataset.slotIndex = String(slot.index);
      row.dataset.startMinutes = String(slot.startMinutes);

      row.addEventListener("dragover", e => {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
        row.addClass("is-drag-over");
      });

      row.addEventListener("dragleave", () => {
        row.removeClass("is-drag-over");
      });

      row.addEventListener("drop", async e => {
        e.preventDefault();
        row.removeClass("is-drag-over");
        const taskId = e.dataTransfer?.getData("application/x-ticktick-task-id") ||
                       e.dataTransfer?.getData("text/ticktick-task") ||
                       e.dataTransfer?.getData("text/plain") ||
                       this.draggingTaskId;
        if (!taskId) return;
        const hour = Math.floor(slot.startMinutes / 60);
        const minute = slot.startMinutes % 60;
        await this.handleDropOnTimeSlot(taskId, targetDay, hour, minute);
      });
    }

    // Current Time Red Indicator Line (if today)
    if (isToday) {
      const now = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();
      const dayStartMin = agendaData.startHour * 60;
      const dayEndMin = (agendaData.endHour + 1) * 60;

      if (nowMin >= dayStartMin && nowMin <= dayEndMin) {
        const topPx = ((nowMin - dayStartMin) / agendaData.slotMinutes) * 32;
        const nowLine = slotsCol.createDiv({ cls: "ticktick-timeblock-now-line" });
        nowLine.style.top = `${topPx}px`;
      }
    }

    // Render Timed Cards
    const dayStartMin = agendaData.startHour * 60;
    for (const timedItem of agendaData.timed) {
      this.renderDayTimeblockCard(slotsCol, timedItem, targetDay, dayStartMin, agendaData.slotMinutes);
    }

    // Side Drawer (Untimed & Overdue & Habits)
    const drawer = content.createDiv({ cls: "ticktick-timeblock-drawer" });

    // Section 1: Untimed tasks
    const titleToday = drawer.createDiv({ cls: "ticktick-timeblock-drawer-title" });
    titleToday.createSpan({ text: isToday ? "تسک‌های امروز (بدون ساعت)" : "تسک‌های این روز (بدون ساعت)" });
    titleToday.createSpan({ cls: "ticktick-timeblock-stat-pill", text: String(agendaData.untimed.length) });

    const untimedList = drawer.createDiv({ cls: "ticktick-timeblock-untimed-list" });
    if (agendaData.untimed.length === 0) {
      untimedList.createDiv({ cls: "ticktick-matrix-empty", text: "تسک بدون ساعتی نیست." });
    } else {
      for (const task of agendaData.untimed) {
        this.renderDayDrawerTaskCard(untimedList, task);
      }
    }

    // Section 2: Overdue tasks (if today)
    if (isToday && agendaData.overdue.length > 0) {
      const titleOverdue = drawer.createDiv({ cls: "ticktick-timeblock-drawer-title" });
      titleOverdue.createSpan({ text: "معوقه از قبل" });
      const overdueBadge = titleOverdue.createSpan({ cls: "ticktick-timeblock-stat-pill is-overdue" });
      overdueBadge.setText(String(agendaData.overdue.length));

      const overdueList = drawer.createDiv({ cls: "ticktick-timeblock-untimed-list" });
      for (const task of agendaData.overdue) {
        this.renderDayDrawerTaskCard(overdueList, task, true);
      }
    }

    // Section 3: Habits (عادت‌ها)
    if (this.showHabits) {
      const today = todayInZone(this.host.timeZone);
      const shouldShowHabits = this.showHabitsForAllDays ? targetDay <= today : targetDay === today;
      if (shouldShowHabits) {
        this.renderHabits(drawer, targetDay);
      }
    }

    // Initial scroll to current time or preserve previous scroll
    const isSameView = this.lastRenderedMode === this.mode && this.lastRenderedDay === this.day;
    if (isSameView && this.savedGridScrollTop > 0) {
      gridContainer.scrollTop = this.savedGridScrollTop;
    } else if (!isSameView && isToday) {
      const now = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();
      const targetScroll = Math.max(0, ((nowMin - 60 - agendaData.startHour * 60) / agendaData.slotMinutes) * 32);
      gridContainer.scrollTop = targetScroll;
    }

    gridContainer.addEventListener("scroll", () => {
      if (!this.isRendering && this.mode === "day") {
        this.savedGridScrollTop = gridContainer.scrollTop;
      }
    }, { passive: true });

    drawer.addEventListener("scroll", () => {
      if (!this.isRendering && this.mode === "day") {
        this.savedDrawerScrollTop = drawer.scrollTop;
      }
    }, { passive: true });
  }

  private renderDayTimeblockCard(
    slotsCol: HTMLElement,
    item: { task: TickTickTask; range: any; effectiveStart: number; effectiveEnd: number; laneIndex: number; totalLanes: number },
    targetDay: string,
    dayStartMin: number,
    slotMinutes: number
  ) {
    const card = slotsCol.createDiv({ cls: "ticktick-timeblock-card" });
    card.dataset.taskId = String(item.task.id);
    card.setAttribute("draggable", "true");

    const prio = taskPriority(item.task.priority);
    if (prio.className) card.addClass(prio.className);
    const tone = this.taskTone(item.task);
    card.style.setProperty("--ticktick-task-tone", tone);

    const isCompleted = Number(item.task.status ?? 0) !== 0;
    if (isCompleted) card.addClass("is-completed");

    const topPx = ((item.effectiveStart - dayStartMin) / slotMinutes) * 32;
    const heightPx = Math.max(30, ((item.effectiveEnd - item.effectiveStart) / slotMinutes) * 32 - 2);

    card.style.top = `${topPx}px`;
    card.style.height = `${heightPx}px`;

    const widthPercent = 100 / item.totalLanes;
    const rightPercent = item.laneIndex * widthPercent;
    card.style.width = `calc(${widthPercent}% - 6px)`;
    card.style.right = `${rightPercent}%`;

    if (bulkSelectionStore.isSelected(String(item.task.id))) {
      card.addClass("is-selected");
    }

    card.addEventListener("dragstart", e => {
      this.beginTaskDrag(item.task, e, card);
      if (e.dataTransfer) {
        e.dataTransfer.setData("application/x-ticktick-task-id", String(item.task.id));
        e.dataTransfer.setData("text/ticktick-task", String(item.task.id));
        e.dataTransfer.setData("text/plain", String(item.task.id));
        e.dataTransfer.effectAllowed = "move";
      }
      card.addClass("is-dragging");
    });

    card.addEventListener("dragend", () => {
      card.removeClass("is-dragging");
      this.clearTaskDrag();
    });

    const header = card.createDiv({ cls: "ticktick-timeblock-card-header" });
    const titleEl = header.createDiv({ cls: "ticktick-timeblock-card-title" });
    titleEl.setText(cleanTaskTitle(item.task.title));

    const timeEl = header.createDiv({ cls: "ticktick-timeblock-card-time" });
    timeEl.setText(`${item.range.startTime} - ${item.range.endTime}`);

    card.addEventListener("click", e => {
      if (e.shiftKey || e.ctrlKey || e.metaKey) {
        bulkSelectionStore.toggle(String(item.task.id));
        card.toggleClass("is-selected", bulkSelectionStore.isSelected(String(item.task.id)));
        return;
      }
      new TaskDetailsModal(this.host.app, item.task, {
        complete: () => this.completeTask(item.task),
        load: this.host.load,
        edit: this.host.edit,
        updateTask: this.host.updateTask ? (m) => this.host.updateTask!(m) : undefined,
        deleteTask: this.host.deleteTask ? (t) => this.host.deleteTask!(t) : undefined,
        createTask: this.host.create ? (d) => this.host.create(d) : undefined,
        changed: async () => {
          await this.host.refresh();
          await this.render();
        },
        allTasks: () => this.host.tasks(),
      }).open();
    });

    const resizeHandle = card.createDiv({
      cls: "ticktick-timeblock-resize-handle",
      attr: { title: "تغییر مدت زمان" }
    });

    resizeHandle.addEventListener("click", e => {
      e.stopPropagation();
      const menu = new Menu();
      const durations = [15, 30, 45, 60, 90, 120];
      for (const d of durations) {
        menu.addItem(menuItem => {
          menuItem.setTitle(`${d} دقیقه`).onClick(async () => {
            const mutation = computeResizeBlockMutation(item.task, targetDay, d, this.host.timeZone);
            if (mutation) {
              if (this.host.updateTask) {
                await this.host.updateTask(mutation);
              }
              await this.render();
            }
          });
        });
      }
      menu.showAtMouseEvent(e);
    });
  }

  private renderDayDrawerTaskCard(container: HTMLElement, task: TickTickTask, isOverdue = false) {
    const card = container.createDiv({ cls: "ticktick-timeblock-untimed-card" });
    card.dataset.taskId = String(task.id);
    card.setAttribute("draggable", "true");

    const prio = taskPriority(task.priority);
    const prioDot = card.createSpan({ cls: `ticktick-matrix-priority-dot ${prio.className}` });

    const isCompleted = Number(task.status ?? 0) !== 0;
    const check = card.createEl("input", { type: "checkbox", cls: "ticktick-untimed-check", attr: { "aria-label": `تکمیل ${task.title}` } });
    check.checked = isCompleted;
    check.disabled = isCompleted;
    check.addEventListener("click", e => e.stopPropagation());
    check.addEventListener("change", () => void this.completeTask(task, check));

    const titleEl = card.createSpan({ text: cleanTaskTitle(task.title), cls: "ticktick-untimed-title" });

    if (task.projectName) {
      card.createSpan({ cls: "ticktick-untimed-project-pill", text: task.projectName });
    }

    if (isOverdue) {
      const due = toDateKey(task.dueDate, task.timeZone || this.host.timeZone);
      if (due) {
        card.createSpan({ cls: "ticktick-matrix-meta-pill is-overdue", text: formatPersianDate(due) });
      }
    }

    card.addEventListener("dragstart", e => {
      this.beginTaskDrag(task, e, card);
      if (e.dataTransfer) {
        e.dataTransfer.setData("application/x-ticktick-task-id", String(task.id));
        e.dataTransfer.setData("text/ticktick-task", String(task.id));
        e.dataTransfer.setData("text/plain", String(task.id));
        e.dataTransfer.effectAllowed = "move";
      }
      card.addClass("is-dragging");
    });

    card.addEventListener("dragend", () => {
      card.removeClass("is-dragging");
      this.clearTaskDrag();
    });

    card.addEventListener("click", () => {
      new TaskDetailsModal(this.host.app, task, {
        complete: () => this.completeTask(task),
        load: this.host.load,
        edit: this.host.edit,
        updateTask: this.host.updateTask ? (m) => this.host.updateTask!(m) : undefined,
        deleteTask: this.host.deleteTask ? (t) => this.host.deleteTask!(t) : undefined,
        createTask: this.host.create ? (d) => this.host.create(d) : undefined,
        changed: async () => {
          await this.host.refresh();
          await this.render();
        },
        allTasks: () => this.host.tasks(),
      }).open();
    });
  }

  private async handleDropOnTimeSlot(taskId: string, targetDay: string, hour: number, minute: number) {
    const allTasks = this.host.tasks();
    const task = allTasks.find(t => String(t.id) === taskId);
    if (!task) return;

    try {
      const mutation = computeTimeSlotDropMutation(task, targetDay, hour, minute, 45, this.host.timeZone);
      if (mutation && this.host.updateTask) {
        await this.host.updateTask(mutation);
      } else {
        const timeStr = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
        await this.host.reschedule(task, targetDay, timeStr);
      }
      const timeStr = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
      new Notice(`تسک «${cleanTaskTitle(task.title)}» برای ساعت ${timeStr} زمان‌بندی شد.`);
      await this.render();
    } catch (err) {
      new Notice(err instanceof Error ? err.message : "زمان‌بندی تسک ناموفق بود.");
    }
  }

  private renderDays(root: HTMLElement, days: string[], tasks: TickTickTask[]) {
    const today = todayInZone(this.host.timeZone);
    const workspace = root.createDiv({ cls: `ticktick-planner-workspace ${this.backlogCollapsed ? "is-backlog-collapsed" : ""}` });
    if (!this.backlogCollapsed) {
      this.renderBacklogColumn(workspace, tasks);
    }
    const grid = workspace.createDiv({ cls: `ticktick-planner-days ticktick-planner-days-${days.length}` });
    enhanceHorizontalScroll(grid);
    const isSameView = this.lastRenderedMode === this.mode && this.lastRenderedDay === this.day;
    if (!isSameView) {
      scrollToStart(grid);
    } else if (this.savedGridScrollLeft !== 0) {
      grid.scrollLeft = this.savedGridScrollLeft;
    }
    grid.addEventListener("scroll", () => {
      if (!this.isRendering && this.lastRenderedMode === this.mode && this.lastRenderedDay === this.day) {
        this.savedGridScrollLeft = grid.scrollLeft;
        if (grid.scrollTop > 0) this.savedGridScrollTop = grid.scrollTop;
      }
    }, { passive: true });
    this.bindCalendarDrop(grid, tasks);
    const showRangeBars = days.length > 1;

    const shell = grid.createDiv({ cls: "ticktick-planner-days-shell" });
    const headers = shell.createDiv({ cls: "ticktick-planner-days-headers" });

    for (const day of days) {
      const isToday = day === today;
      const header = headers.createDiv({ cls: `ticktick-planner-day-header ${isToday ? "is-today" : ""}`, attr: { "data-day": day } });

      const dayTop = header.createDiv({ cls: "ticktick-planner-day-top" });
      const weekdayName = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { weekday: "long" }).format(new Date(`${day}T12:00:00Z`));
      dayTop.createSpan({ cls: "ticktick-planner-day-name", text: weekdayName });

      if (isToday) {
        dayTop.createSpan({ cls: "ticktick-today-pill", text: "امروز" });
      }

      const dayDateWrapper = header.createDiv({ cls: "ticktick-planner-day-date-wrap" });
      const dayNumber = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { day: "numeric" }).format(new Date(`${day}T12:00:00Z`));
      const monthName = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { month: "short" }).format(new Date(`${day}T12:00:00Z`));
      dayDateWrapper.createSpan({ cls: `ticktick-day-num-badge ${isToday ? "is-today-badge" : ""}`, text: dayNumber });
      dayDateWrapper.createSpan({ cls: "ticktick-month-name", text: monthName });

      const items = this.itemsForDay(tasks, day);
      const dayBottom = header.createDiv({ cls: "ticktick-planner-day-bottom" });
      dayBottom.createSpan({ cls: "ticktick-planner-counter", text: `${items.length} تسک` });

      const add = dayBottom.createEl("button", {
        cls: "ticktick-planner-add mod-icon",
        attr: { type: "button", "aria-label": `افزودن تسک در ${day}`, title: `افزودن تسک در ${day}` }
      });
      setIcon(add, "plus");
      add.addEventListener("click", () => void this.addTask(day));
    }

    const body = shell.createDiv({ cls: "ticktick-planner-days-body" });
    if (showRangeBars) this.renderRangeLanes(body, days, tasks, "ticktick-planner-range-lanes");
    const columns = body.createDiv({ cls: "ticktick-planner-day-columns" });

    for (const day of days) {
      const isToday = day === today;
      const column = columns.createDiv({ cls: `ticktick-planner-day ${isToday ? "is-today" : ""}`, attr: { "data-day": day } });
      const items = this.itemsForDay(tasks, day);

      column.addEventListener("dragover", event => {
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
        column.addClass("is-drag-over");
      });
      column.addEventListener("dragleave", () => {
        column.removeClass("is-drag-over");
      });
      column.addEventListener("drop", event => {
        event.preventDefault();
        column.removeClass("is-drag-over");
        const task = this.draggedTask(event, tasks);
        if (task) void this.dropTask(task, day);
      });

      const singleDayTasks = items.filter(item => !showRangeBars || !taskDateRange(item, this.host.timeZone));
      if (this.showTimeGrid) {
        this.renderTimeGrid(column, day, singleDayTasks, tasks);
      } else {
        if (!singleDayTasks.length) {
          const emptyHint = column.createDiv({ cls: "ticktick-planner-day-empty" });
          emptyHint.createSpan({ text: "تسکی نیست" });
        } else {
          for (const task of singleDayTasks) this.renderCalendarPill(column, task);
        }
      }
      const shouldShowHabits = this.showHabitsForAllDays ? day <= today : day === today;
      if (shouldShowHabits) this.renderHabits(column, day, true);
    }
  }

  private renderMonth(root: HTMLElement, tasks: TickTickTask[]) {
    const today = todayInZone(this.host.timeZone);
    const workspace = root.createDiv({ cls: `ticktick-planner-workspace ${this.backlogCollapsed ? "is-backlog-collapsed" : ""}` });

    if (!this.backlogCollapsed) {
      this.renderBacklogColumn(workspace, tasks);
    }

    const grid = workspace.createDiv({ cls: "ticktick-planner-month" });
    enhanceHorizontalScroll(grid);
    const isSameView = this.lastRenderedMode === this.mode && this.lastRenderedDay === this.day;
    if (!isSameView) {
      scrollToStart(grid);
    } else if (this.savedGridScrollLeft !== 0) {
      grid.scrollLeft = this.savedGridScrollLeft;
    }
    grid.addEventListener("scroll", () => {
      if (!this.isRendering && this.lastRenderedMode === this.mode && this.lastRenderedDay === this.day) {
        this.savedGridScrollLeft = grid.scrollLeft;
        if (grid.scrollTop > 0) this.savedGridScrollTop = grid.scrollTop;
      }
    }, { passive: true });
    this.bindCalendarDrop(grid, tasks);
    const days = persianMonthRange(this.day, this.host.firstWeekday);

    // Weekday name bar at top of month view
    const weekdayBar = grid.createDiv({ cls: "ticktick-planner-month-weekdays-bar" });
    const sampleWeek = days.slice(0, 7);
    for (const sampleDay of sampleWeek) {
      const weekdayName = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { weekday: "long" }).format(new Date(`${sampleDay}T12:00:00Z`));
      weekdayBar.createDiv({ cls: "ticktick-planner-month-weekday-cell", text: weekdayName });
    }

    for (let index = 0; index < days.length; index += 7) {
      const weekDays = days.slice(index, index + 7);
      const week = grid.createDiv({ cls: "ticktick-planner-month-week" });
      const headers = week.createDiv({ cls: "ticktick-planner-month-headers" });

      for (const day of weekDays) {
        const isToday = day === today;
        const isOutside = !isSamePersianMonth(day, this.day);
        const header = headers.createDiv({
          cls: `ticktick-planner-month-header ${isOutside ? "is-outside" : ""} ${isToday ? "is-today" : ""}`,
          attr: { "data-day": day }
        });

        const numWrapper = header.createDiv({ cls: "ticktick-month-num-wrap" });
        const dayNum = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { day: "numeric" }).format(new Date(`${day}T12:00:00Z`));
        numWrapper.createSpan({ cls: `ticktick-day-num-badge ${isToday ? "is-today-badge" : ""}`, text: dayNum });

        const items = this.itemsForDay(tasks, day);
        if (items.length) {
          header.createSpan({ cls: "ticktick-planner-counter", text: String(items.length) });
        }

        const add = header.createEl("button", {
          cls: "ticktick-planner-add mod-icon",
          attr: { type: "button", "aria-label": `افزودن تسک در ${day}` }
        });
        setIcon(add, "plus");
        add.addEventListener("click", e => {
          e.stopPropagation();
          void this.addTask(day);
        });
      }

      const body = week.createDiv({ cls: "ticktick-planner-month-body" });
      this.renderRangeLanes(body, weekDays, tasks, "ticktick-planner-month-range-lanes");
      const cells = body.createDiv({ cls: "ticktick-planner-month-cells" });

      const weekDayItems = weekDays.map(day => tasksForCalendarDay(tasks, day, this.host.timeZone, this.host.showCompleted, this.sortMode));
      const weekDayCards = weekDayItems.map(items => items.filter(item => !taskDateRange(item, this.host.timeZone)));
      const maxCardsInWeek = Math.max(0, ...weekDayCards.map(c => c.length));
      // Base limit allows cells to fill available space comfortably:
      // at least 5 cards (matching min-height), expanding up to 8 if the week row is taller.
      const visibleLimit = Math.max(5, Math.min(maxCardsInWeek, 8));

      for (let dayIdx = 0; dayIdx < weekDays.length; dayIdx++) {
        const day = weekDays[dayIdx];
        const isToday = day === today;
        const isOutside = !isSamePersianMonth(day, this.day);
        const cell = cells.createDiv({
          cls: `ticktick-planner-month-cell ${isOutside ? "is-outside" : ""} ${isToday ? "is-today" : ""}`,
          attr: { "data-day": day }
        });
        const items = weekDayItems[dayIdx];

        cell.addEventListener("dragover", event => {
          event.preventDefault();
          if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
          cell.addClass("is-drag-over");
        });
        cell.addEventListener("dragleave", () => {
          cell.removeClass("is-drag-over");
        });
        cell.addEventListener("drop", event => {
          event.preventDefault();
          cell.removeClass("is-drag-over");
          const task = this.draggedTask(event, tasks);
          if (task) void this.dropTask(task, day);
        });

        const cards = weekDayCards[dayIdx];
        // If cards only exceed visibleLimit by 1, rendering that 1 card takes the same
        // height as the "+1 تسک دیگر" button, so show all cards instead of an artificial 1-item overflow pill.
        const shouldOverflow = cards.length > visibleLimit + 1;
        const visibleCards = shouldOverflow ? cards.slice(0, visibleLimit) : cards;

        for (const task of visibleCards) this.renderCalendarPill(cell, task);

        if (shouldOverflow) {
          const overflowCount = cards.length - visibleLimit;
          const more = cell.createEl("button", {
            cls: "ticktick-planner-overflow",
            text: `+${overflowCount} تسک دیگر`,
            attr: { type: "button", "aria-label": "نمایش همهٔ تسک‌های روز" }
          });
          const dayLabel = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { weekday: "long", day: "numeric", month: "long" }).format(new Date(`${day}T12:00:00Z`));
          more.addEventListener("click", () => new TaskOverflowModal(
            this.host.app,
            cards,
            task => this.completeTask(task),
            task => this.host.load(task),
            task => this.host.edit(task),
            async () => {
              await this.host.refresh();
              await this.render();
            },
            dayLabel,
            this.host.updateTask ? (m) => this.host.updateTask!(m) : undefined,
            () => this.host.tasks(),
            this.host.deleteTask ? (t) => this.host.deleteTask!(t) : undefined,
            this.host.create ? (d) => this.host.create(d) : undefined
          ).open());
        }
        const shouldShowHabits = this.showHabitsForAllDays ? day <= today : day === today;
        if (shouldShowHabits) this.renderHabits(cell, day, true);
      }
    }
  }

  private renderRangeLanes(parent: HTMLElement, days: string[], tasks: TickTickTask[], cls: string) {
    const rangeTasks = tasks.filter(task => {
      if (Number(task.status ?? 0) !== 0 && !this.host.showCompleted) return false;
      const range = taskDateRange(task, this.host.timeZone);
      return range && range.end >= days[0] && range.start <= days.at(-1)!;
    });
    if (!rangeTasks.length) return;

    const lanes = parent.createDiv({ cls });
    for (const task of rangeTasks) {
      const range = taskDateRange(task, this.host.timeZone)!;
      const first = Math.max(0, days.findIndex(day => day >= range.start));
      const last = Math.max(first, (() => {
        const index = days.findIndex(day => day > range.end);
        return index < 0 ? days.length - 1 : index - 1;
      })());
      const priority = taskPriority(task.priority);
      const isCompleted = Number(task.status ?? 0) !== 0;
      const tone = this.taskTone(task);

      const bar = lanes.createDiv({
        cls: `ticktick-planner-range-task priority-${priority.value} ${isCompleted ? "is-completed" : ""}`,
        attr: {
          title: `بازهٔ ${range.start} تا ${range.end} · ${task.title}`,
          role: "button",
          tabindex: "0"
        }
      });
      bar.dataset.taskId = String(task.id);
      bar.style.gridColumn = `${first + 1} / ${last + 2}`;
      bar.style.setProperty("--ticktick-task-tone", tone);

      const openDetails = () => new TaskDetailsModal(this.host.app, task, {
        complete: () => this.completeTask(task),
        load: item => this.host.load(item),
        edit: item => this.host.edit(item),
        updateTask: this.host.updateTask ? (m) => this.host.updateTask!(m) : undefined,
        deleteTask: this.host.deleteTask ? (t) => this.host.deleteTask!(t) : undefined,
        createTask: this.host.create ? (d) => this.host.create(d) : undefined,
        changed: async () => {
          await this.host.refresh();
          await this.render();
        },
        allTasks: () => this.host.tasks(),
      }).open();

      if (bulkSelectionStore.isSelected(String(task.id))) {
        bar.addClass("is-bulk-selected");
      }

      bar.addEventListener("click", (event) => {
        if (event.shiftKey || event.ctrlKey || event.metaKey) {
          event.preventDefault();
          event.stopPropagation();
          const sel = bulkSelectionStore.toggle(String(task.id));
          bar.toggleClass("is-bulk-selected", sel);
          return;
        }
        openDetails();
      });
      bar.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openDetails();
        }
      });

      const check = bar.createEl("input", { type: "checkbox", cls: "ticktick-range-check", attr: { "aria-label": `تکمیل ${task.title}` } });
      check.checked = isCompleted;
      check.disabled = isCompleted;
      check.addEventListener("click", e => e.stopPropagation());
      check.addEventListener("change", () => void this.completeTask(task, check));

      const rangeIcon = bar.createSpan({ cls: "ticktick-range-indicator mod-icon", attr: { "aria-hidden": "true" } });
      setIcon(rangeIcon, "calendar-range");

      const titleEl = bar.createDiv({
        cls: "ticktick-range-title",
        text: String(task.title ?? "بدون عنوان")
      });
      titleEl.addEventListener("click", event => {
        event.stopPropagation();
        openDetails();
      });

      bar.draggable = true;
      bar.addEventListener("dragstart", event => {
        bar.addClass("is-dragging");
        this.beginTaskDrag(task, event, bar);
        event.dataTransfer!.effectAllowed = "move";
        event.dataTransfer?.setData("text/ticktick-task", String(task.id));
        event.dataTransfer?.setData("text/plain", String(task.id));
      });
      bar.addEventListener("dragend", () => { bar.removeClass("is-dragging"); this.clearTaskDrag(); });
    }
  }

  private itemsForDay(tasks: TickTickTask[], day: string): TickTickTask[] {
    const normal = tasksForCalendarDay(tasks, day, this.host.timeZone, this.host.showCompleted, this.sortMode);
    if (!this.showAllRecurring) return normal;
    const known = new Set(normal.map(task => String(task.id)));
    const extras = tasks.filter(task => !known.has(String(task.id)) && recurringTaskOccursOnDay(task, day, this.host.timeZone));
    return sortPlanningTasks([...normal, ...extras], this.sortMode);
  }

  /** Habits live beside the date they belong to, but remain opt-in so a busy
   * calendar can stay task-only.  They are resolved from the local mirror and
   * therefore do not add a TickTick request while rendering. */
  private renderHabits(parent: HTMLElement, day: string, compact = false) {
    if (!this.showHabits) return;
    const habits = this.host.habits(day);
    if (!habits.length) return;
    const section = parent.createDiv({ cls: `ticktick-planner-habits ${compact ? "is-compact" : ""}` });
    section.createDiv({ cls: "ticktick-planner-habits-label", text: "عادت‌ها" });
for (const habit of habits) {
      renderUnifiedHabitCard(section, {
        habit,
        day,
        variant: "planner",
        onCheckIn: async (h, d) => {
          const goal = Math.max(1, Number(h.checkin?.goal ?? h.goal ?? h.target ?? 1));
          const current = Number(h.checkin?.value ?? 0);
          const complete = Number(h.checkin?.status ?? 0) === 2 || current >= goal;
          await this.host.checkInHabit(h, d);
          new Notice(complete ? "ثبت عادت برداشته شد." : current + 1 >= goal ? "عادت کامل و همگام شد." : `یک مرحله ثبت شد: ${current + 1}/${goal}`);
          await this.render();
        },
        onOpenDetails: (h, d) => {
          new HabitDetailsModal(this.host.app, this.host.habitWithHistory(String(h.id), d) ?? h, {
            ...this.host,
            onEditHabit: (habitItem) => void this.host.openHabitEditor?.(habitItem)
          }, d).open();
        },
        onEditHabit: (h) => void this.host.openHabitEditor?.(h)
      });
    }
  }

  private renderTask(parent: HTMLElement, task: TickTickTask) {
    const bound = this.host.binding(task);
    const priority = taskPriority(task.priority);
    const isCompleted = Number(task.status ?? 0) !== 0;
    const tone = this.taskTone(task);

    const card = parent.createDiv({
      cls: `ticktick-planner-task priority-${priority.value} ${bound ? "is-bound" : ""} ${isCompleted ? "is-completed" : ""}`,
      attr: {
        title: `${String(task.title ?? "")}${task.projectName ? ` · ${task.projectName}` : ""}${bound ? " · (برای جابه‌جایی بکش)" : ""}`,
        role: "button",
        tabindex: "0"
      }
    });
    card.dataset.taskId = String(task.id);
    card.style.setProperty("--ticktick-task-tone", tone);

    const openDetails = () => new TaskDetailsModal(this.host.app, task, {
      complete: () => this.completeTask(task),
      load: item => this.host.load(item),
      edit: item => this.host.edit(item),
      updateTask: this.host.updateTask ? (m) => this.host.updateTask!(m) : undefined,
      deleteTask: this.host.deleteTask ? (t) => this.host.deleteTask!(t) : undefined,
      createTask: this.host.create ? (d) => this.host.create(d) : undefined,
      changed: async () => {
        await this.host.refresh();
        await this.render();
      },
      allTasks: () => this.host.tasks(),
    }).open();

    if (bulkSelectionStore.isSelected(String(task.id))) {
      card.addClass("is-bulk-selected");
    }

    card.addEventListener("click", (event) => {
      if (event.shiftKey || event.ctrlKey || event.metaKey) {
        event.preventDefault();
        event.stopPropagation();
        const sel = bulkSelectionStore.toggle(String(task.id));
        card.toggleClass("is-bulk-selected", sel);
        return;
      }
      openDetails();
    });
    card.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openDetails();
      }
    });

    // Bound grip indicator
    if (bound) {
      const grip = card.createSpan({ cls: "ticktick-task-grip mod-icon", attr: { "aria-hidden": "true" } });
      setIcon(grip, "grip-vertical");
      grip.addEventListener("click", event => event.stopPropagation());
    }

    // Checkbox
    const check = card.createEl("input", { type: "checkbox", cls: "ticktick-task-check", attr: { "aria-label": `تکمیل ${task.title}` } });
    check.checked = isCompleted;
    check.disabled = isCompleted;
    check.addEventListener("click", event => event.stopPropagation());
    check.addEventListener("change", () => void this.completeTask(task, check));

    // Subtask indicator
    if (task.parentId) {
      card.createSpan({ cls: "ticktick-task-subtask-chip", text: "↳" });
    }

    // Task title
    const titleEl = card.createDiv({
      cls: "ticktick-task-title",
      text: String(task.title ?? "بدون عنوان")
    });
    titleEl.addEventListener("click", event => {
      event.stopPropagation();
      openDetails();
    });

    // Project chip
    if (task.projectName) {
      card.createSpan({ cls: "ticktick-task-project-chip", text: task.projectName });
    }

    // Meta chips (Time, Estimate, Priority)
    const timeStr = formatTaskTime(task, this.host.timeZone);
    const estText = formatTaskEstimate(task);
    if (estText) {
      card.createSpan({ cls: "ticktick-task-project-chip mod-est", text: estText });
    }
    if (timeStr) {
      const timeBadge = card.createSpan({ cls: "ticktick-task-time-badge" });
      const clockIcon = timeBadge.createSpan({ cls: "ticktick-time-icon mod-icon" });
      setIcon(clockIcon, "clock");
      timeBadge.createSpan({ text: timeStr });
    }
    if (priority.value > 0) {
      card.createSpan({ cls: `ticktick-task-priority-dot ${priority.className}`, attr: { title: `اولویت: ${priority.label}` } });
    }

    card.draggable = true;
    card.addEventListener("dragstart", event => {
      card.addClass("is-dragging");
      this.beginTaskDrag(task, event, card);
      event.dataTransfer!.effectAllowed = "move";
      event.dataTransfer?.setData("text/ticktick-task", String(task.id));
      event.dataTransfer?.setData("text/plain", String(task.id));
    });
    card.addEventListener("dragend", () => {
      card.removeClass("is-dragging");
      this.clearTaskDrag();
    });
  }

  private renderCalendarPill(parent: HTMLElement, task: TickTickTask) {
    const bound = this.host.binding(task);
    const priority = taskPriority(task.priority);
    const isCompleted = Number(task.status ?? 0) !== 0;
    const tone = this.taskTone(task);

    const pill = parent.createDiv({
      cls: `ticktick-planner-task ticktick-planner-month-task is-calendar-pill priority-${priority.value} ${bound ? "is-bound" : ""} ${isCompleted ? "is-completed" : ""}`,
      attr: {
        title: `${String(task.title ?? "")}${task.projectName ? ` · ${task.projectName}` : ""}${bound ? " · (برای جابه‌جایی بکش)" : ""}`,
        role: "button",
        tabindex: "0"
      }
    });
    pill.dataset.taskId = String(task.id);
    pill.style.setProperty("--ticktick-task-tone", tone);

    const openDetails = () => new TaskDetailsModal(this.host.app, task, {
      complete: () => this.completeTask(task),
      load: item => this.host.load(item),
      edit: item => this.host.edit(item),
      updateTask: this.host.updateTask ? (m) => this.host.updateTask!(m) : undefined,
      deleteTask: this.host.deleteTask ? (t) => this.host.deleteTask!(t) : undefined,
      createTask: this.host.create ? (d) => this.host.create(d) : undefined,
      changed: async () => {
        await this.host.refresh();
        await this.render();
      },
      allTasks: () => this.host.tasks(),
    }).open();

    if (bulkSelectionStore.isSelected(String(task.id))) {
      pill.addClass("is-bulk-selected");
    }

    pill.addEventListener("click", (event) => {
      if (event.shiftKey || event.ctrlKey || event.metaKey) {
        event.preventDefault();
        event.stopPropagation();
        const sel = bulkSelectionStore.toggle(String(task.id));
        pill.toggleClass("is-bulk-selected", sel);
        return;
      }
      openDetails();
    });
    pill.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openDetails();
      }
    });

    // Checkbox (compact circular ring)
    const check = pill.createEl("input", {
      type: "checkbox",
      cls: "ticktick-task-check ticktick-month-check",
      attr: { "aria-label": `تکمیل ${task.title}` }
    });
    check.checked = isCompleted;
    check.disabled = isCompleted;
    check.addEventListener("click", event => event.stopPropagation());
    check.addEventListener("change", () => void this.completeTask(task, check));

    // Optional time indicator
    const timeStr = formatTaskTime(task, this.host.timeZone);
    if (timeStr) {
      const timeBadge = pill.createSpan({ cls: "ticktick-task-time-badge ticktick-month-time" });
      const clockIcon = timeBadge.createSpan({ cls: "ticktick-time-icon mod-icon" });
      setIcon(clockIcon, "clock");
      timeBadge.createSpan({ text: timeStr });
    }

    // Title (single line with ellipsis)
    const titleEl = pill.createDiv({
      cls: "ticktick-task-title ticktick-month-task-title",
      text: String(task.title ?? "بدون عنوان")
    });
    titleEl.addEventListener("click", event => {
      event.stopPropagation();
      openDetails();
    });

    pill.draggable = true;
    pill.addEventListener("dragstart", event => {
      pill.addClass("is-dragging");
      this.beginTaskDrag(task, event, pill);
      event.dataTransfer!.effectAllowed = "move";
      event.dataTransfer?.setData("text/ticktick-task", String(task.id));
      event.dataTransfer?.setData("text/plain", String(task.id));
    });
    pill.addEventListener("dragend", () => {
      pill.removeClass("is-dragging");
      this.clearTaskDrag();
    });
  }

  private renderMonthTask(parent: HTMLElement, task: TickTickTask) {
    this.renderCalendarPill(parent, task);
  }

  private taskTone(task: TickTickTask) {
    if (this.colorMode === "uniform") return "var(--interactive-accent)";
    if (this.colorMode === "priority") {
      return Number(task.priority) === 5
        ? "var(--color-red)"
        : Number(task.priority) === 3
          ? "var(--color-orange)"
          : Number(task.priority) === 1
            ? "var(--color-blue)"
            : "var(--text-muted)";
    }
    const seed = this.colorMode === "tag"
      ? String(task.tags?.[0] ?? task.projectName ?? task.projectId ?? "")
      : String(task.projectName ?? task.projectId ?? "");
    const projectColor = String(task.projectColor ?? "").trim();
    if (this.colorMode === "project" && /^#[0-9a-f]{3,8}$/i.test(projectColor)) return projectColor;
    const palette = ["#7c6cff", "#4aa3df", "#2a9d8f", "#e76f51", "#d36ba6", "#d49a2a", "#5a9b68"];
    const hash = [...seed].reduce((value, char) => ((value * 31) + char.charCodeAt(0)) >>> 0, 0);
    return palette[hash % palette.length];
  }

  private async completeTask(task: TickTickTask, checkbox?: HTMLInputElement) {
    if (checkbox) {
      checkbox.disabled = true;
      checkbox.checked = true;
    }
    const card = (checkbox?.closest(".ticktick-planner-task, .ticktick-planner-month-task") as HTMLElement)
      || this.element.querySelector<HTMLElement>(`[data-task-id="${task.id}"]`);
    if (card) {
      card.addClass("is-completed");
      if (!this.host.showCompleted) {
        card.addClass("is-leaving");
      }
    }
    try {
      await this.host.complete(task);
      task.status = 2;
      new Notice("تسک تکمیل و همگام شد.");
      if (card && !this.host.showCompleted) {
        setTimeout(() => card.remove(), 220);
      }
    } catch (error) {
      if (checkbox) {
        checkbox.checked = false;
        checkbox.disabled = false;
      }
      if (card) {
        card.removeClass("is-completed");
        card.removeClass("is-leaving");
      }
      new Notice(error instanceof Error ? error.message : "تکمیل ناموفق بود.");
    }
  }

  private async addTask(day: string) {
    try {
      const created = await this.host.create({ dueDate: day });
      if (!created) return;
      new Notice("تسک در TickTick اضافه شد.");
      await this.host.refresh();
      await this.render();
    } catch (error) {
      new Notice(error instanceof Error ? error.message : "افزودن تسک ناموفق بود.");
    }
  }

  private renderBacklogColumn(parent: HTMLElement, tasks: TickTickTask[]) {
    const unscheduled = unscheduledTasks(tasks, this.host.timeZone, this.sortMode);
    const col = parent.createDiv({ cls: "ticktick-planner-backlog-column" });

    // Header
    const header = col.createDiv({ cls: "ticktick-planner-backlog-header" });
    const titleWrap = header.createDiv({ cls: "ticktick-planner-backlog-title" });
    const bIcon = titleWrap.createSpan({ cls: "ticktick-backlog-icon" });
    setIcon(bIcon, "layout-list");
    titleWrap.createSpan({ text: "بک‌لاگ" });
    titleWrap.createSpan({ cls: "ticktick-planner-counter", text: `${unscheduled.length} تسک` });

    const headerActions = header.createDiv({ cls: "ticktick-backlog-actions" });
    const addBtn = headerActions.createEl("button", {
      cls: "ticktick-planner-add mod-icon",
      attr: { type: "button", "aria-label": "افزودن تسک در بک‌لاگ", title: "افزودن تسک بدون تاریخ" }
    });
    setIcon(addBtn, "plus");
    addBtn.addEventListener("click", () => void this.addTask(""));

    const collapseBtn = headerActions.createEl("button", {
      cls: "ticktick-backlog-collapse-btn mod-icon",
      attr: { type: "button", "aria-label": "بستن بک‌لاگ", title: "بستن ستون بک‌لاگ" }
    });
    setIcon(collapseBtn, "panel-right-close");
    collapseBtn.addEventListener("click", () => {
      this.backlogCollapsed = true;
      void this.render();
    });

    // Drop target on Backlog
    const cardsContainer = col.createDiv({ cls: "ticktick-planner-backlog-cards" });
    cardsContainer.addEventListener("dragover", event => {
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
      cardsContainer.addClass("is-drag-over");
    });
    cardsContainer.addEventListener("dragleave", event => {
      if (!cardsContainer.contains(event.relatedTarget as Node | null)) {
        cardsContainer.removeClass("is-drag-over");
      }
    });
    cardsContainer.addEventListener("drop", event => {
      event.preventDefault();
      cardsContainer.removeClass("is-drag-over");
      const task = this.draggedTask(event, tasks);
      if (task) void this.dropTaskToBacklog(task);
    });

    if (!unscheduled.length) {
      const emptyBox = cardsContainer.createDiv({ cls: "ticktick-planner-day-empty" });
      emptyBox.createSpan({ text: "تسکی در بک‌لاگ نیست" });
    } else {
      for (const task of unscheduled) {
        this.renderBacklogTask(cardsContainer, task);
      }
    }
  }

  private renderBacklogTask(parent: HTMLElement, task: TickTickTask) {
    const bound = this.host.binding(task);
    const priority = taskPriority(task.priority);
    const isCompleted = Number(task.status ?? 0) !== 0;
    const tone = this.taskTone(task);

    const row = parent.createDiv({
      cls: `ticktick-backlog-task-item priority-${priority.value} ${bound ? "is-bound" : ""} ${isCompleted ? "is-completed" : ""}`,
      attr: {
        title: `${String(task.title ?? "")}${task.projectName ? ` · ${task.projectName}` : ""}${bound ? " · (برای جابه‌جایی بکش)" : ""}`,
        role: "button",
        tabindex: "0"
      }
    });
    row.dataset.taskId = String(task.id);
    row.style.setProperty("--ticktick-task-tone", tone);

    // Draggable
    row.draggable = true;
    row.addEventListener("dragstart", event => {
      row.addClass("is-dragging");
      this.beginTaskDrag(task, event, row);
      event.dataTransfer!.effectAllowed = "move";
      event.dataTransfer?.setData("text/ticktick-task", String(task.id));
      event.dataTransfer?.setData("text/plain", String(task.id));
    });
    row.addEventListener("dragend", () => {
      row.removeClass("is-dragging");
      this.clearTaskDrag();
    });

    const openDetails = () => new TaskDetailsModal(this.host.app, task, {
      complete: () => this.completeTask(task),
      load: item => this.host.load(item),
      edit: item => this.host.edit(item),
      updateTask: this.host.updateTask ? (m) => this.host.updateTask!(m) : undefined,
      deleteTask: this.host.deleteTask ? (t) => this.host.deleteTask!(t) : undefined,
      createTask: this.host.create ? (d) => this.host.create(d) : undefined,
      changed: async () => {
        await this.host.refresh();
        await this.render();
      },
      allTasks: () => this.host.tasks(),
    }).open();

    if (bulkSelectionStore.isSelected(String(task.id))) {
      row.addClass("is-bulk-selected");
    }

    row.addEventListener("click", (event) => {
      if (event.shiftKey || event.ctrlKey || event.metaKey) {
        event.preventDefault();
        event.stopPropagation();
        const sel = bulkSelectionStore.toggle(String(task.id));
        row.toggleClass("is-bulk-selected", sel);
        return;
      }
      openDetails();
    });
    row.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openDetails();
      }
    });

    // Circular check
    const check = row.createEl("input", {
      type: "checkbox",
      cls: "ticktick-task-check ticktick-backlog-check",
      attr: { "aria-label": `تکمیل ${task.title}` }
    });
    check.checked = isCompleted;
    check.disabled = isCompleted;
    check.addEventListener("click", event => event.stopPropagation());
    check.addEventListener("change", () => void this.completeTask(task, check));

    // Priority dot if set
    if (priority.value > 0) {
      row.createSpan({ cls: `ticktick-task-priority-dot ${priority.className}`, attr: { title: `اولویت: ${priority.label}` } });
    }

    // Title (flex: 1, text-align: right, ellipsis)
    const titleEl = row.createSpan({
      cls: "ticktick-backlog-task-title",
      text: String(task.title ?? "بدون عنوان")
    });
    titleEl.addEventListener("click", event => {
      event.stopPropagation();
      openDetails();
    });

    // Subtask indicator
    if (task.parentId) {
      row.createSpan({ cls: "ticktick-backlog-subtask-chip", text: "↳" });
    }

    // Project tag badge
    if (task.projectName) {
      row.createSpan({ cls: "ticktick-backlog-project-badge", text: task.projectName });
    }
  }

  private renderTimeGrid(column: HTMLElement, day: string, dayTasks: TickTickTask[], allTasks: TickTickTask[]) {
    const allDayTasks = dayTasks.filter(item => Boolean(item.isAllDay) || !String(item.dueDate ?? item.startDate ?? "").includes("T"));
    const timedTasks = dayTasks.filter(item => !item.isAllDay && String(item.dueDate ?? item.startDate ?? "").includes("T"));

    // All Day section
    const allDaySection = column.createDiv({ cls: "ticktick-timegrid-allday-section" });
    const allDayHeader = allDaySection.createDiv({ cls: "ticktick-timegrid-allday-header" });
    allDayHeader.createSpan({ cls: "ticktick-timegrid-allday-title", text: "تمام روز" });
    allDayHeader.createSpan({ cls: "ticktick-planner-counter", text: `${allDayTasks.length}` });

    allDaySection.addEventListener("dragover", event => {
      event.preventDefault();
      event.stopPropagation();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
      allDaySection.addClass("is-drag-over");
    });
    allDaySection.addEventListener("dragleave", () => allDaySection.removeClass("is-drag-over"));
    allDaySection.addEventListener("drop", event => {
      event.preventDefault();
      event.stopPropagation();
      allDaySection.removeClass("is-drag-over");
      const task = this.draggedTask(event, allTasks);
      if (task) void this.dropTask(task, day);
    });

    if (allDayTasks.length) {
      for (const task of allDayTasks) this.renderCalendarPill(allDaySection, task);
    }

    // Hourly Slots
    const timeSlotsWrap = column.createDiv({ cls: "ticktick-timegrid-slots" });
    for (const slot of HOURLY_SLOTS) {
      const slotRow = timeSlotsWrap.createDiv({ cls: "ticktick-timegrid-slot" });
      slotRow.dataset.time = slot;

      const slotHead = slotRow.createDiv({ cls: "ticktick-timegrid-slot-head" });
      const pTime = new Intl.DateTimeFormat("fa-IR", { hour: "2-digit", minute: "2-digit", hour12: false })
        .format(new Date(`2026-01-01T${slot}:00Z`));
      slotHead.createSpan({ cls: "ticktick-timegrid-hour-label", text: pTime });

      slotRow.addEventListener("dragover", event => {
        event.preventDefault();
        event.stopPropagation();
        if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
        slotRow.addClass("is-drag-over");
      });
      slotRow.addEventListener("dragleave", () => slotRow.removeClass("is-drag-over"));
      slotRow.addEventListener("drop", event => {
        event.preventDefault();
        event.stopPropagation();
        slotRow.removeClass("is-drag-over");
        const task = this.draggedTask(event, allTasks);
        if (task) void this.dropTaskToTime(task, day, slot);
      });

      const matchingTasks = timedTasks.filter(t => taskHourSlot(t) === slot);
      for (const task of matchingTasks) {
        this.renderCalendarPill(slotRow, task);
      }
    }

    const outsideTasks = timedTasks.filter(t => !HOURLY_SLOTS.includes(taskHourSlot(t) ?? ""));
    if (outsideTasks.length) {
      const extraSection = column.createDiv({ cls: "ticktick-timegrid-extra-section" });
      for (const task of outsideTasks) {
        this.renderCalendarPill(extraSection, task);
      }
    }
  }

  private async dropTask(task: TickTickTask, target: string, visualSourceDay?: string) {
    const currentRange = taskDateRange(task, this.host.timeZone);
    const currentDay = currentRange?.start ?? toDateKey(task.dueDate ?? task.startDate, this.host.timeZone);
    if (!currentDay) {
      try {
        await this.host.reschedule(task, target);
        new Notice(`تسک «${task.title}» برای ${target} زمان‌بندی شد.`);
        await this.render();
      } catch (error) {
        new Notice(error instanceof Error ? error.message : "زمان‌بندی تسک ناموفق بود.");
      }
      return;
    }
    const offset = visualSourceDay
      ? Math.round((Date.parse(`${target}T12:00:00Z`) - Date.parse(`${visualSourceDay}T12:00:00Z`)) / 86400000)
      : Math.round((Date.parse(`${target}T12:00:00Z`) - Date.parse(`${currentDay}T12:00:00Z`)) / 86400000);
    if (!offset) return;
    const taskTarget = shiftCalendarDay(currentDay, offset);
    try {
      await this.host.reschedule(task, taskTarget);
      new Notice(currentRange ? "بازهٔ زمانی تسک جابه‌جا و همگام شد." : "تاریخ تسک جابه‌جا و همگام شد.");
      await this.render();
    } catch (error) {
      new Notice(error instanceof Error ? error.message : "جابه‌جایی ناموفق بود.");
    }
  }

  private async dropTaskToTime(task: TickTickTask, targetDay: string, time: string) {
    try {
      await this.host.reschedule(task, targetDay, time);
      new Notice(`ساعت تسک «${task.title}» به ${time} تغییر کرد.`);
      await this.render();
    } catch (error) {
      new Notice(error instanceof Error ? error.message : "تغییر ساعت تسک ناموفق بود.");
    }
  }

  private async dropTaskToBacklog(task: TickTickTask) {
    const hasDate = Boolean(task.dueDate || task.startDate);
    if (!hasDate) return;
    new UnscheduleConfirmModal(this.host.app, task, async () => {
      try {
        await this.host.unschedule(task);
        new Notice(`تسک «${task.title}» به بک‌لاگ منتقل شد.`);
        await this.render();
      } catch (error) {
        new Notice(error instanceof Error ? error.message : "انتقال به بک‌لاگ ناموفق بود.");
      }
    }).open();
  }

  private draggedTask(event: DragEvent, tasks: TickTickTask[]) {
    const id = event.dataTransfer?.getData("text/ticktick-task")
      || event.dataTransfer?.getData("text/plain")
      || this.draggingTaskId;
    return tasks.find(item => String(item.id) === String(id))
      || this.host.tasks().find(item => String(item.id) === String(id));
  }

  /** Capture drops before a theme, card, or embedded Obsidian view can stop
   * propagation. Cells still keep their local listeners for visual feedback. */
  private bindCalendarDrop(surface: HTMLElement, tasks: TickTickTask[]) {
    const targetDay = (event: DragEvent) => this.visualDropDay(surface, event);
    surface.addEventListener("dragover", event => {
      const day = targetDay(event);
      if (!day) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
      surface.querySelectorAll(".is-drag-over").forEach(item => item.removeClass("is-drag-over"));
      surface.querySelector<HTMLElement>(`[data-day=\"${day}\"]`)?.addClass("is-drag-over");
    }, true);
    surface.addEventListener("drop", event => {
      const day = targetDay(event);
      if (!day) return;
      event.preventDefault();
      event.stopPropagation();
      surface.querySelectorAll(".is-drag-over").forEach(item => item.removeClass("is-drag-over"));
      const task = this.draggedTask(event, tasks);
      const sourceDay = this.draggingSourceDay;
      const targetEl = event.target as HTMLElement | null;
      const slot = targetEl?.closest<HTMLElement>(".ticktick-timegrid-slot")?.dataset.time;
      if (task) {
        if (slot) {
          void this.dropTaskToTime(task, day, slot);
        } else {
          void this.dropTask(task, day, sourceDay);
        }
      } else new Notice("تسکِ در حال جابه‌جایی پیدا نشد؛ دوباره تلاش کن.");
    }, true);
  }

  /** Resolve the destination from the visible date header instead of the DOM
   * ancestry of a card. Range lanes and RTL grids can otherwise make a card
   * appear over a neighbouring day while retaining another column's parent. */
  private visualDropDay(surface: HTMLElement, event: DragEvent) {
    const x = event.clientX, y = event.clientY;
    if (Number.isFinite(x) && x > 0 && Number.isFinite(y) && y > 0) {
      // Month headers repeat for each week.  Matching only the x coordinate
      // always selected the first week's Monday/Tuesday; use the actual cell
      // rectangle first so cross-week drops preserve their intended date.
      const targets = surface.querySelectorAll<HTMLElement>(
        ".ticktick-planner-day[data-day], .ticktick-planner-month-cell[data-day], .ticktick-planner-day-header[data-day], .ticktick-planner-month-header[data-day]",
      );
      for (const target of targets) {
        const rect = target.getBoundingClientRect();
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return target.dataset.day;
      }
    }
    return event.target instanceof Element
      ? event.target.closest<HTMLElement>("[data-day]")?.dataset.day
      : undefined;
  }

  private beginTaskDrag(task: TickTickTask, event: DragEvent, card: HTMLElement) {
    this.draggingTaskId = String(task.id);
    const surface = card.closest<HTMLElement>(".ticktick-planner-days, .ticktick-planner-month");
    this.draggingSourceDay = surface ? this.visualDropDay(surface, event) ?? "" : "";
  }

  private clearTaskDrag() {
    this.draggingTaskId = "";
    this.draggingSourceDay = "";
  }
}

