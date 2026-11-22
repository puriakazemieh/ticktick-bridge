import { setIcon, Notice } from "obsidian";
import { todayInZone } from "../core/date.js";
import { formatPersianDate } from "../core/persian-date.js";
import {
  computeWeeklyReviewRange,
  computeWeeklyReviewMetrics,
  planMoveOverdueAction,
  planClearWeeklyAction,
  planNextWeekAction
} from "../core/weekly-review.js";
import { taskPriority } from "./task-priority";
import { bulkSelectionStore } from "./selection-store";
import { BulkActionBar } from "./bulk-action-bar";
import { BulkConfirmModal } from "./modals/bulk-confirm-modal";
import { TaskDetailsModal } from "./task-details-modal";
import { formatTaskEstimate } from "../core/task-hierarchy.js";
import type { TickTickTask, TickTickProject } from "./types";

export interface WeeklyReviewHost {
  app: any;
  timeZone: string;
  firstWeekday: number;
  tasks: () => TickTickTask[];
  savedAt: () => string;
  projects: () => Promise<TickTickProject[]> | TickTickProject[];
  executeBulkOperation: (taskIds: string[], op: string, params: any) => Promise<any>;
  refresh: () => Promise<void>;
  load: (task: TickTickTask) => Promise<TickTickTask | undefined>;
  edit: (task: TickTickTask) => Promise<any>;
  complete: (task: TickTickTask) => Promise<any>;
  deleteTask?: (task: TickTickTask) => Promise<any>;
}

export type ReviewTab = "completed" | "overdue" | "scheduled" | "moved" | "unscheduled";

export class WeeklyReview {
  private weekOffset = 0;
  private activeTab: ReviewTab = "completed";
  private selectedTagFilter: string | null = null;
  private isSyncing = false;
  private bulkActionBar: BulkActionBar | null = null;

  constructor(private element: HTMLElement, private host: WeeklyReviewHost) {
    this.element.addClass("ticktick-weekly-review-root");
  }

  destroy() {
    this.bulkActionBar?.destroy();
    this.bulkActionBar = null;
    this.element.empty();
  }

  async render() {
    this.element.empty();

    const today = todayInZone(this.host.timeZone);
    const range = computeWeeklyReviewRange(today, this.weekOffset);
    const allTasks = this.host.tasks();
    const metrics = computeWeeklyReviewMetrics(allTasks, range, { today, timeZone: this.host.timeZone });

    // 1. Header Toolbar
    this.renderHeader(range, today);

    // 2. Metrics KPI Cards
    this.renderMetricsCards(metrics, today, range.nextWeekAnchor);

    // 3. Most Used Tags Section
    this.renderTagsSection(metrics.mostUsedTags);

    // 4. Tab Navigation & Task List
    this.renderTabsAndTaskList(metrics);

    // 5. Mount Bulk Action Bar
    this.bulkActionBar ??= new BulkActionBar(this.element, {
      app: this.host.app,
      timeZone: this.host.timeZone,
      tasks: () => this.host.tasks(),
      projects: () => this.host.projects(),
      executeBulkOperation: async (ids, op, params) => this.host.executeBulkOperation(ids, op, params),
      onChanged: async () => {
        await this.render();
      }
    });
    void this.bulkActionBar.render();
  }

  private renderHeader(range: { start: string; end: string }, today: string) {
    const header = this.element.createDiv({ cls: "ticktick-review-header" });

    // Title & Icon
    const titleGroup = header.createDiv({ cls: "ticktick-review-title-group" });
    const iconSpan = titleGroup.createSpan({ cls: "ticktick-review-main-icon mod-icon" });
    setIcon(iconSpan, "bar-chart-2");
    titleGroup.createEl("h2", { text: "مرور هفتگی و داشبورد اجرا" });

    // Week Navigator
    const navGroup = header.createDiv({ cls: "ticktick-review-nav-group" });
    
    // Prev Week (Go back 7 days)
    const prevBtn = navGroup.createEl("button", {
      cls: "ticktick-review-nav-btn mod-icon",
      attr: { "aria-label": "هفته قبل" }
    });
    setIcon(prevBtn, "chevron-right");
    prevBtn.addEventListener("click", () => {
      this.weekOffset--;
      void this.render();
    });

    // Week Date Range Label
    const dateLabel = navGroup.createSpan({ cls: "ticktick-review-week-label" });
    dateLabel.setText(`${formatPersianDate(range.start)} تا ${formatPersianDate(range.end)}`);

    // Next Week (Go forward 7 days)
    const nextBtn = navGroup.createEl("button", {
      cls: "ticktick-review-nav-btn mod-icon",
      attr: { "aria-label": "هفته بعد" }
    });
    setIcon(nextBtn, "chevron-left");
    nextBtn.addEventListener("click", () => {
      this.weekOffset++;
      void this.render();
    });

    // Current Week button if offset != 0
    if (this.weekOffset !== 0) {
      const todayBtn = navGroup.createEl("button", {
        cls: "ticktick-review-today-btn",
        text: "این هفته"
      });
      todayBtn.addEventListener("click", () => {
        this.weekOffset = 0;
        void this.render();
      });
    }

    // Data Status & Manual Sync
    const syncGroup = header.createDiv({ cls: "ticktick-review-sync-group" });
    const savedAt = this.host.savedAt();
    let statusText = "داده‌ها از کش محلی";
    if (savedAt) {
      const dt = new Date(savedAt);
      if (!Number.isNaN(dt.getTime())) {
        statusText = `داده‌ها تا: ${dt.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" })}`;
      }
    }
    syncGroup.createSpan({ cls: "ticktick-review-saved-at", text: statusText });

    const syncBtn = syncGroup.createEl("button", {
      cls: `ticktick-review-sync-btn ${this.isSyncing ? "is-syncing" : ""}`,
      attr: { "aria-label": "همگام‌سازی دستی" }
    });
    const syncIcon = syncBtn.createSpan({ cls: "mod-icon" });
    setIcon(syncIcon, "refresh-cw");
    syncBtn.createSpan({ text: "همگام‌سازی" });
    syncBtn.addEventListener("click", async () => {
      if (this.isSyncing) return;
      this.isSyncing = true;
      syncBtn.addClass("is-syncing");
      new Notice("در حال همگام‌سازی با TickTick...");
      try {
        await this.host.refresh();
        new Notice("همگام‌سازی با موفقیت انجام شد.");
      } catch (err) {
        new Notice(`خطا در همگام‌سازی: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        this.isSyncing = false;
        syncBtn.removeClass("is-syncing");
        await this.render();
      }
    });
  }

  private renderMetricsCards(metrics: ReturnType<typeof computeWeeklyReviewMetrics>, today: string, nextWeekStart: string) {
    const grid = this.element.createDiv({ cls: "ticktick-review-cards-grid" });

    // 1. Completed Card
    const completedCard = grid.createDiv({ cls: "ticktick-metric-card mod-completed" });
    const compHeader = completedCard.createDiv({ cls: "ticktick-metric-header" });
    compHeader.createSpan({ cls: "ticktick-metric-title", text: "تکمیل‌شده در این هفته" });
    const compIcon = compHeader.createSpan({ cls: "mod-icon" });
    setIcon(compIcon, "check-circle-2");

    const compBody = completedCard.createDiv({ cls: "ticktick-metric-body" });
    compBody.createDiv({ cls: "ticktick-metric-val", text: String(metrics.summary.completedCount) });
    const compRate = compBody.createDiv({ cls: "ticktick-metric-badge", text: `نرخ انجام: ${metrics.summary.completionRate}٪` });

    const progBar = completedCard.createDiv({ cls: "ticktick-metric-progress" });
    const progFill = progBar.createDiv({ cls: "ticktick-metric-progress-fill" });
    progFill.style.width = `${metrics.summary.completionRate}%`;

    // 2. Overdue Card
    const overdueCard = grid.createDiv({ cls: "ticktick-metric-card mod-overdue" });
    const ovHeader = overdueCard.createDiv({ cls: "ticktick-metric-header" });
    ovHeader.createSpan({ cls: "ticktick-metric-title", text: "معوق / نیازمند پیگیری" });
    const ovIcon = ovHeader.createSpan({ cls: "mod-icon" });
    setIcon(ovIcon, "alert-circle");

    const ovBody = overdueCard.createDiv({ cls: "ticktick-metric-body" });
    ovBody.createDiv({ cls: "ticktick-metric-val", text: String(metrics.summary.overdueCount) });
    ovBody.createDiv({ cls: "ticktick-metric-sub", text: "تسک‌های گذشته از سررسید" });

    const moveOvBtn = overdueCard.createEl("button", {
      cls: "ticktick-metric-action-btn",
      text: "انتقال معوق‌ها به امروز"
    });
    moveOvBtn.addEventListener("click", () => void this.actionMoveOverdue(metrics.overdue, today));

    // 3. Scheduled in Week Card
    const schedCard = grid.createDiv({ cls: "ticktick-metric-card mod-scheduled" });
    const scHeader = schedCard.createDiv({ cls: "ticktick-metric-header" });
    scHeader.createSpan({ cls: "ticktick-metric-title", text: "برنامه‌ریزی این هفته" });
    const scIcon = scHeader.createSpan({ cls: "mod-icon" });
    setIcon(scIcon, "calendar");

    const scBody = schedCard.createDiv({ cls: "ticktick-metric-body" });
    scBody.createDiv({ cls: "ticktick-metric-val", text: String(metrics.summary.scheduledCount) });
    scBody.createDiv({ cls: "ticktick-metric-sub", text: `${metrics.summary.movedCount} تسک بازه‌دار یا جابجاشده` });

    const clearSchedBtn = schedCard.createEl("button", {
      cls: "ticktick-metric-action-btn",
      text: "پاکسازی برنامه این هفته"
    });
    clearSchedBtn.addEventListener("click", () => void this.actionClearWeekly(metrics.scheduledInWeek));

    // 4. Backlog / Unscheduled Card
    const backlogCard = grid.createDiv({ cls: "ticktick-metric-card mod-unscheduled" });
    const blHeader = backlogCard.createDiv({ cls: "ticktick-metric-header" });
    blHeader.createSpan({ cls: "ticktick-metric-title", text: "بک‌لاگ / بدون تاریخ" });
    const blIcon = blHeader.createSpan({ cls: "mod-icon" });
    setIcon(blIcon, "inbox");

    const blBody = backlogCard.createDiv({ cls: "ticktick-metric-body" });
    blBody.createDiv({ cls: "ticktick-metric-val", text: String(metrics.summary.unscheduledCount) });
    blBody.createDiv({ cls: "ticktick-metric-sub", text: "تسک‌های بدون تاریخ مشخص" });

    const planNextBtn = backlogCard.createEl("button", {
      cls: "ticktick-metric-action-btn",
      text: "برنامه‌ریزی هفته آینده"
    });
    planNextBtn.addEventListener("click", () => void this.actionPlanNextWeek(metrics.unscheduled, nextWeekStart));
  }

  private renderTagsSection(tags: Array<{ tag: string; count: number }>) {
    if (!tags.length) return;

    const section = this.element.createDiv({ cls: "ticktick-review-tags-section" });
    const title = section.createDiv({ cls: "ticktick-review-tags-title" });
    const tagIcon = title.createSpan({ cls: "mod-icon" });
    setIcon(tagIcon, "tag");
    title.createSpan({ text: "پرتکرارترین برچسب‌های هفته:" });

    const list = section.createDiv({ cls: "ticktick-review-tags-list" });

    if (this.selectedTagFilter) {
      const allTagPill = list.createEl("button", {
        cls: "ticktick-review-tag-pill mod-clear",
        text: "نمایش همه"
      });
      allTagPill.addEventListener("click", () => {
        this.selectedTagFilter = null;
        void this.render();
      });
    }

    for (const item of tags.slice(0, 10)) {
      const isSelected = this.selectedTagFilter === item.tag;
      const pill = list.createEl("button", {
        cls: `ticktick-review-tag-pill ${isSelected ? "is-selected" : ""}`,
        text: `#${item.tag} (${item.count})`
      });
      pill.addEventListener("click", () => {
        this.selectedTagFilter = isSelected ? null : item.tag;
        void this.render();
      });
    }
  }

  private renderTabsAndTaskList(metrics: ReturnType<typeof computeWeeklyReviewMetrics>) {
    const container = this.element.createDiv({ cls: "ticktick-review-tasks-container" });

    // Tabs Bar
    const tabBar = container.createDiv({ cls: "ticktick-review-tabs-bar" });

    const tabs: Array<{ id: ReviewTab; label: string; count: number }> = [
      { id: "completed", label: "تکمیل‌شده", count: metrics.completed.length },
      { id: "overdue", label: "معوق", count: metrics.overdue.length },
      { id: "scheduled", label: "برنامه هفتگی", count: metrics.scheduledInWeek.length },
      { id: "moved", label: "جابجاشده / بازه‌دار", count: metrics.moved.length },
      { id: "unscheduled", label: "بک‌لاگ", count: metrics.unscheduled.length },
    ];

    for (const tab of tabs) {
      const tabBtn = tabBar.createEl("button", {
        cls: `ticktick-review-tab-btn ${this.activeTab === tab.id ? "is-active" : ""}`
      });
      tabBtn.createSpan({ text: tab.label });
      tabBtn.createSpan({ cls: "ticktick-review-tab-count", text: String(tab.count) });
      tabBtn.addEventListener("click", () => {
        this.activeTab = tab.id;
        void this.render();
      });
    }

    // Task List Container
    const listWrapper = container.createDiv({ cls: "ticktick-review-task-list" });

    let tasksToShow: TickTickTask[] = [];
    switch (this.activeTab) {
      case "completed": tasksToShow = metrics.completed; break;
      case "overdue": tasksToShow = metrics.overdue; break;
      case "scheduled": tasksToShow = metrics.scheduledInWeek; break;
      case "moved": tasksToShow = metrics.moved; break;
      case "unscheduled": tasksToShow = metrics.unscheduled; break;
    }

    if (this.selectedTagFilter) {
      tasksToShow = tasksToShow.filter(t => Array.isArray(t.tags) && t.tags.some(tag => String(tag).trim().replace(/^#/, "") === this.selectedTagFilter));
    }

    if (tasksToShow.length === 0) {
      const emptyBox = listWrapper.createDiv({ cls: "ticktick-review-empty" });
      const emptyIcon = emptyBox.createSpan({ cls: "mod-icon" });
      setIcon(emptyIcon, "inbox");
      emptyBox.createSpan({ text: "تسکی در این بخش وجود ندارد." });
      return;
    }

    for (const task of tasksToShow) {
      this.renderTaskRow(listWrapper, task);
    }
  }

  private renderTaskRow(parent: HTMLElement, task: TickTickTask) {
    const priority = taskPriority(task.priority);
    const isCompleted = Number(task.status ?? 0) !== 0;

    const row = parent.createDiv({
      cls: `ticktick-review-task-row priority-${priority.value} ${isCompleted ? "is-completed" : ""}`,
      attr: {
        role: "button",
        tabindex: "0"
      }
    });
    row.dataset.taskId = String(task.id);

    if (bulkSelectionStore.isSelected(String(task.id))) {
      row.addClass("is-bulk-selected");
    }

    // Checkbox
    const checkWrap = row.createDiv({ cls: "ticktick-review-task-check" });
    const check = checkWrap.createEl("input", { type: "checkbox" });
    check.checked = isCompleted;
    check.addEventListener("mousedown", e => e.stopPropagation());
    check.addEventListener("click", e => e.stopPropagation());
    check.addEventListener("change", async () => {
      check.disabled = true;
      try {
        if (check.checked) {
          await this.host.complete(task);
        } else {
          await this.host.executeBulkOperation([String(task.id)], "reopen", {});
        }
        await this.render();
      } catch (err) {
        new Notice(`خطا در تغییر وضعیت: ${err instanceof Error ? err.message : String(err)}`);
        check.checked = !check.checked;
        check.disabled = false;
      }
    });

    // Content
    const body = row.createDiv({ cls: "ticktick-review-task-body" });
    body.createSpan({ cls: "ticktick-review-task-title", text: task.title || "بدون عنوان" });

    // Meta Badges
    const meta = row.createDiv({ cls: "ticktick-review-task-meta" });
    if (task.projectName) {
      meta.createSpan({ cls: "ticktick-review-task-proj", text: task.projectName });
    }

    if (task.dueDate) {
      meta.createSpan({
        cls: "ticktick-review-task-date",
        text: formatPersianDate(task.dueDate, this.host.timeZone)
      });
    }

    if (task.parentId) {
      meta.createSpan({ cls: "ticktick-review-task-proj", text: "↳ زیرتسک" });
    }

    const estText = formatTaskEstimate(task);
    if (estText) {
      meta.createSpan({ cls: "ticktick-review-task-date", text: estText });
    }

    if (Array.isArray(task.blockedBy) && task.blockedBy.length > 0) {
      meta.createSpan({ cls: "ticktick-review-task-tag", text: "⛔ وابسته" });
    }

    if (Array.isArray(task.tags) && task.tags.length > 0) {
      for (const tag of task.tags.slice(0, 3)) {
        meta.createSpan({ cls: "ticktick-review-task-tag", text: `#${tag}` });
      }
    }

    // Click / Selection Interactions
    const openDetails = () => new TaskDetailsModal(this.host.app, task, {
      complete: () => this.host.complete(task),
      load: item => this.host.load(item),
      edit: item => this.host.edit(item),
      deleteTask: this.host.deleteTask ? (t) => this.host.deleteTask!(t) : undefined,
      changed: async () => {
        await this.render();
      },
      allTasks: () => this.host.tasks(),
    }).open();

    row.addEventListener("click", (e) => {
      if (e.shiftKey || e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        bulkSelectionStore.toggle(String(task.id));
        return;
      }
      openDetails();
    });

    row.addEventListener("keydown", (e) => {
      if (e.key === "x" || ((e.key === "Enter" || e.key === " ") && (e.shiftKey || e.ctrlKey))) {
        e.preventDefault();
        e.stopPropagation();
        bulkSelectionStore.toggle(String(task.id));
        return;
      }
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openDetails();
      }
    });
  }

  // Action 1: Move Overdue to Today
  private async actionMoveOverdue(overdueTasks: TickTickTask[], today: string) {
    if (!overdueTasks.length) {
      new Notice("هیچ تسک معوقی برای انتقال وجود ندارد.");
      return;
    }

    const plan = planMoveOverdueAction(overdueTasks, today);
    const confirmed = await new BulkConfirmModal(this.host.app, overdueTasks, {
      title: "انتقال تسک‌های معوق به امروز",
      description: `آیا مایلید تاریخ سررسید ${overdueTasks.length} تسک معوق زیر را به امروز (${formatPersianDate(today)}) منتقل کنید؟`,
      confirmLabel: "انتقال به امروز",
      isDestructive: false
    }).openAndWait();

    if (confirmed) {
      await this.host.executeBulkOperation(overdueTasks.map(t => String(t.id)), plan.operationType, plan.parameters);
      await this.render();
    }
  }

  // Action 2: Clear Weekly Plan
  private async actionClearWeekly(scheduledTasks: TickTickTask[]) {
    if (!scheduledTasks.length) {
      new Notice("هیچ تسک برنامه‌ریزی‌شده‌ای در این هفته وجود ندارد.");
      return;
    }

    const plan = planClearWeeklyAction(scheduledTasks);
    const confirmed = await new BulkConfirmModal(this.host.app, scheduledTasks, {
      title: "پاکسازی برنامه این هفته",
      description: `آیا مایلید تاریخ سررسید ${scheduledTasks.length} تسک این هفته را لغو کرده و آن‌ها را به بک‌لاگ منتقل کنید؟`,
      confirmLabel: "پاکسازی و انتقال به بک‌لاگ",
      isDestructive: false
    }).openAndWait();

    if (confirmed) {
      await this.host.executeBulkOperation(scheduledTasks.map(t => String(t.id)), plan.operationType, plan.parameters);
      await this.render();
    }
  }

  // Action 3: Plan Next Week
  private async actionPlanNextWeek(backlogTasks: TickTickTask[], nextWeekStart: string) {
    if (!backlogTasks.length) {
      new Notice("هیچ تسک بدون تاریخی در بک‌لاگ برای برنامه‌ریزی هفته آینده موجود نیست.");
      return;
    }

    const candidates = backlogTasks.slice(0, 10);
    const plan = planNextWeekAction(candidates, nextWeekStart);
    const confirmed = await new BulkConfirmModal(this.host.app, candidates, {
      title: "برنامه‌ریزی برای آغاز هفته آینده",
      description: `آیا مایلید ${candidates.length} تسک نمونه از بک‌لاگ را برای روز شنبه هفته آینده (${formatPersianDate(nextWeekStart)}) زمان‌بندی کنید؟`,
      confirmLabel: "زمان‌بندی برای شنبه بعد",
      isDestructive: false
    }).openAndWait();

    if (confirmed) {
      await this.host.executeBulkOperation(candidates.map(t => String(t.id)), plan.operationType, plan.parameters);
      await this.render();
    }
  }
}
