import { Menu, setIcon, Notice } from "obsidian";
import {
  daysBetween,
  taskTimelineRange,
  computeTimelineBounds,
  generateTimelineGrid,
  packTimelineLanes,
  computeBarGridPlacement,
  getTimelineTaskTone,
  shiftTimelineEndpoints,
  partitionTimelineTasks
} from "../core/timeline.js";
import { toDateKey, todayInZone } from "../core/date.js";
import { shiftCalendarDay } from "../core/calendar-range.js";
import { formatPersianDate } from "../core/persian-date.js";
import { FilterBar, type FilterBarHost } from "./filter-bar";
import { taskPriority } from "./task-priority";
import { TaskDetailsModal } from "./task-details-modal";
import { bulkSelectionStore } from "./selection-store";
import { BulkActionBar } from "./bulk-action-bar";
import type { TickTickTask, TickTickProject, SavedView, TaskFilterState } from "./types";

export type TimelineZoom = "day" | "week" | "month";
export type TimelineColorMode = "project" | "tag" | "priority" | "uniform";

export interface TimelineHost {
  app: any;
  timeZone: string;
  firstWeekday: number;
  tasks: () => TickTickTask[];
  projects: () => Promise<TickTickProject[]> | TickTickProject[];
  refresh: () => Promise<void>;
  rescheduleRange: (task: TickTickTask, newStart: string | null, newDue: string | null) => Promise<TickTickTask>;
  complete: (task: TickTickTask) => Promise<any>;
  edit: (task: TickTickTask) => Promise<any>;
  load: (task: TickTickTask) => Promise<TickTickTask | undefined>;
  showCompleted: () => boolean;
  savedViews?: () => SavedView[];
  saveSavedViews?: (views: SavedView[]) => Promise<void>;
  executeBulkOperation?: (taskIds: string[], op: string, params: any) => Promise<any>;
}

export class ProjectTimeline {
  private zoom: TimelineZoom = "day";
  private colorMode: TimelineColorMode = "project";
  private showBacklog = false;
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

  private windowStart: string | null = null;
  private windowEnd: string | null = null;
  private filterBarInstance: FilterBar | null = null;
  private isSyncing = false;

  // Active drag state
  private activeDrag: {
    task: TickTickTask;
    edge: "both" | "start" | "due";
    startX: number;
    initialStart: string | null;
    initialDue: string | null;
    deltaDays: number;
    previewEl: HTMLElement | null;
    barEl: HTMLElement;
  } | null = null;

  private wasDraggedRecently = false;
  private bulkActionBar: BulkActionBar | null = null;

  constructor(private element: HTMLElement, private host: TimelineHost) {}

  async render() {
    this.element.empty();
    this.element.addClass("ticktick-timeline-workspace");

    const allTasks = this.host.tasks();
    const rawProjects = await this.host.projects();
    const projects = Array.isArray(rawProjects) ? rawProjects : [];
    const projectMap = new Map(projects.map(p => [String(p.id), p]));

    // Attach project names and colors to tasks
    const enrichedTasks = allTasks.map(t => {
      const proj = projectMap.get(String(t.projectId));
      return {
        ...t,
        projectName: proj?.name ?? t.projectName,
        projectColor: proj?.color ?? t.projectColor
      };
    });

    const partitioned = partitionTimelineTasks(enrichedTasks, this.filterState, {
      timeZone: this.host.timeZone,
      showCompleted: this.host.showCompleted()
    });

    // Compute or reuse window bounds
    if (!this.windowStart || !this.windowEnd) {
      const bounds = computeTimelineBounds(enrichedTasks, {
        timeZone: this.host.timeZone,
        marginDays: this.zoom === "month" ? 30 : this.zoom === "week" ? 14 : 7
      });
      this.windowStart = bounds.startDate;
      this.windowEnd = bounds.endDate;
    }

    // Top Controls & Navigation Toolbar
    this.renderToolbar(partitioned.backlogTasks.length + partitioned.pointTasks.length);

    // Shared Filter Bar
    this.renderFilterBar(projects, enrichedTasks);

    // Main Timeline Surface (Canvas)
    const canvas = this.element.createDiv({ cls: "ticktick-timeline-canvas" });
    this.renderTimelineGrid(canvas, partitioned.rangeTasks, partitioned.pointTasks, projectMap);

    // Optional Non-range / Backlog Lane
    if (this.showBacklog) {
      this.renderBacklogDrawer(partitioned.pointTasks, partitioned.backlogTasks);
    }

    // Floating Bulk Action Bar
    this.bulkActionBar ??= new BulkActionBar(this.element, {
      app: this.host.app,
      timeZone: this.host.timeZone,
      tasks: () => this.host.tasks(),
      projects: () => this.host.projects(),
      executeBulkOperation: async (ids, op, params) => this.host.executeBulkOperation ? this.host.executeBulkOperation(ids, op, params) : null,
      onChanged: async () => {
        await this.host.refresh();
        await this.render();
      }
    });
    void this.bulkActionBar.render();
  }

  private renderToolbar(backlogCount: number) {
    const toolbar = this.element.createDiv({ cls: "ticktick-timeline-toolbar" });

    // Right side: View modes & Navigation
    const navGroup = toolbar.createDiv({ cls: "ticktick-timeline-tool-group" });

    // Zoom Toggle (Day / Week / Month)
    const zoomSelector = navGroup.createDiv({ cls: "ticktick-timeline-zoom-group" });
    for (const [mode, label] of [["day", "روز"], ["week", "هفته"], ["month", "ماه"]] as Array<[TimelineZoom, string]>) {
      const btn = zoomSelector.createEl("button", {
        cls: `ticktick-timeline-zoom-btn ${this.zoom === mode ? "is-active" : ""}`,
        text: label
      });
      btn.addEventListener("click", () => {
        this.zoom = mode;
        this.windowStart = null;
        this.windowEnd = null;
        void this.render();
      });
    }

    // Date Navigation (Previous, Today, Next)
    const navButtons = navGroup.createDiv({ cls: "ticktick-timeline-nav-group" });
    
    const prevBtn = navButtons.createEl("button", {
      cls: "ticktick-timeline-nav-btn mod-icon",
      attr: { "aria-label": "دورهٔ قبل" }
    });
    setIcon(prevBtn, "chevron-right"); // RTL: chevron-right navigates to previous
    prevBtn.addEventListener("click", () => this.shiftWindow(-1));

    const todayBtn = navButtons.createEl("button", {
      cls: "ticktick-timeline-nav-btn",
      text: "امروز"
    });
    todayBtn.addEventListener("click", () => {
      this.windowStart = null;
      this.windowEnd = null;
      void this.render();
    });

    const nextBtn = navButtons.createEl("button", {
      cls: "ticktick-timeline-nav-btn mod-icon",
      attr: { "aria-label": "دورهٔ بعد" }
    });
    setIcon(nextBtn, "chevron-left"); // RTL: chevron-left navigates to next
    nextBtn.addEventListener("click", () => this.shiftWindow(1));

    // Center: Date Range Title
    const titleSpan = toolbar.createDiv({ cls: "ticktick-timeline-title-span" });
    if (this.windowStart && this.windowEnd) {
      titleSpan.setText(`${formatPersianDate(this.windowStart, this.host.timeZone)} تا ${formatPersianDate(this.windowEnd, this.host.timeZone)}`);
    }

    // Left side: Color Mode, Backlog Toggle, Sync
    const actionsGroup = toolbar.createDiv({ cls: "ticktick-timeline-tool-group" });

    // Color Mode Menu
    const colorLabels: Record<TimelineColorMode, string> = {
      project: "رنگ: پروژه",
      tag: "رنگ: برچسب",
      priority: "رنگ: اولویت",
      uniform: "رنگ: یکدست"
    };

    const colorBtn = actionsGroup.createEl("button", {
      cls: "ticktick-timeline-tool-btn",
      attr: { "aria-label": "پالت رنگ‌بندی" }
    });
    const paletteIcon = colorBtn.createSpan({ cls: "mod-icon" });
    setIcon(paletteIcon, "palette");
    colorBtn.createSpan({ text: colorLabels[this.colorMode] });

    colorBtn.addEventListener("click", (event) => {
      const menu = new Menu();
      for (const [mode, label] of [
        ["project", "بر اساس پروژه"],
        ["tag", "بر اساس برچسب"],
        ["priority", "بر اساس اولویت"],
        ["uniform", "رنگ یکدست"]
      ] as Array<[TimelineColorMode, string]>) {
        menu.addItem(item => {
          item.setTitle(label)
              .setChecked(this.colorMode === mode)
              .onClick(() => {
                this.colorMode = mode;
                void this.render();
              });
        });
      }
      menu.showAtMouseEvent(event);
    });

    // Backlog / Point Tasks Toggle
    const backlogBtn = actionsGroup.createEl("button", {
      cls: `ticktick-timeline-tool-btn ${this.showBacklog ? "is-active" : ""}`,
      attr: { "aria-label": "تسک‌های بدون بازه و نقطه‌ای" }
    });
    const backlogIcon = backlogBtn.createSpan({ cls: "mod-icon" });
    setIcon(backlogIcon, "layers");
    backlogBtn.createSpan({ text: `تسک‌های بدون بازه (${backlogCount})` });
    backlogBtn.addEventListener("click", () => {
      this.showBacklog = !this.showBacklog;
      void this.render();
    });

    // Manual Refresh Button
    const refreshBtn = actionsGroup.createEl("button", {
      cls: `ticktick-timeline-tool-btn mod-icon ${this.isSyncing ? "is-loading" : ""}`,
      attr: { "aria-label": "همگام‌سازی از سرور" }
    });
    setIcon(refreshBtn, "refresh-cw");
    refreshBtn.addEventListener("click", async () => {
      if (this.isSyncing) return;
      this.isSyncing = true;
      refreshBtn.addClass("is-loading");
      try {
        await this.host.refresh();
      } finally {
        this.isSyncing = false;
        refreshBtn.removeClass("is-loading");
        await this.render();
      }
    });
  }

  private renderFilterBar(projects: TickTickProject[], tasks: TickTickTask[]) {
    const filterContainer = this.element.createDiv({ cls: "ticktick-timeline-filter-container" });
    const filterHost: FilterBarHost = {
      app: this.host.app,
      scope: "timeline",
      projects: () => projects.map(p => ({ id: String(p.id), name: p.name })),
      tags: () => [...new Set(tasks.flatMap(t => t.tags ?? []).map(String))],
      savedViews: () => this.host.savedViews ? this.host.savedViews() : [],
      saveSavedViews: async (views) => {
        if (this.host.saveSavedViews) await this.host.saveSavedViews(views);
      },
      filterState: () => this.filterState,
      onFilterChange: (state) => {
        this.filterState = state;
        void this.render();
      }
    };

    this.filterBarInstance = new FilterBar(filterContainer, filterHost);
    this.filterBarInstance.render();
  }

  private renderTimelineGrid(
    canvas: HTMLElement,
    rangeItems: Array<{ task: TickTickTask; range: { start: string; end: string } }>,
    pointItems: Array<{ task: TickTickTask; range: { start: string; end: string } }>,
    projectMap: Map<string, TickTickProject>
  ) {
    if (!this.windowStart || !this.windowEnd) return;

    const grid = generateTimelineGrid(this.windowStart, this.windowEnd, this.zoom, this.host.firstWeekday);
    const totalDays = grid.days.length;
    const today = todayInZone(this.host.timeZone);

    // Calculate column width in pixels based on zoom (daily precision across all modes)
    const colWidthPx = this.zoom === "day" ? 38 : this.zoom === "week" ? 18 : 7;

    const scrollArea = canvas.createDiv({ cls: "ticktick-timeline-scroll-area" });
    const gridEl = scrollArea.createDiv({ cls: "ticktick-timeline-grid" });
    gridEl.style.direction = "rtl";
    gridEl.style.gridTemplateColumns = `repeat(${totalDays}, ${colWidthPx}px)`;

    // 1. Header Row
    const headerRow = gridEl.createDiv({ cls: "ticktick-timeline-header-row" });
    headerRow.style.gridColumn = `1 / span ${totalDays}`;
    headerRow.style.display = "grid";
    headerRow.style.direction = "rtl";
    headerRow.style.gridTemplateColumns = gridEl.style.gridTemplateColumns;

    for (const rawCol of grid.columns) {
      const col = rawCol as any;
      const colKey = String(col.key ?? "");
      const colHeader = headerRow.createDiv({
        cls: `ticktick-timeline-col-header ${colKey === today ? "is-today" : ""}`
      });
      colHeader.style.gridColumn = `${col.colStart} / span ${col.colSpan}`;
      if (this.zoom === "day") {
        const jsDate = new Date(`${col.date ?? colKey}T12:00:00Z`);
        const weekdayName = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { weekday: "narrow" }).format(jsDate);
        const dayNum = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { day: "numeric" }).format(jsDate);
        colHeader.createDiv({ cls: "ticktick-col-weekday", text: weekdayName });
        colHeader.createDiv({ cls: "ticktick-col-daynum", text: dayNum });
      } else if (this.zoom === "week") {
        colHeader.createDiv({ cls: "ticktick-col-week-title", text: String(col.label ?? "") });
      } else {
        const jsDate = new Date(`${col.start ?? colKey}T12:00:00Z`);
        const monthName = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { month: "long", year: "2-digit" }).format(jsDate);
        colHeader.createDiv({ cls: "ticktick-col-month-title", text: monthName });
      }
    }

    // 2. Today Indicator Line
    const todayIndex = grid.days.indexOf(today);
    if (todayIndex >= 0) {
      const todayMarker = gridEl.createDiv({ cls: "ticktick-timeline-today-line" });
      todayMarker.style.gridColumnStart = `${todayIndex + 1}`;
    }

    // 3. Project Grouping & Packed Lanes
    // Filter to tasks that intersect the visible window
    const visibleRangeItems = rangeItems.filter(item => {
      return item.range.end >= this.windowStart! && item.range.start <= this.windowEnd!;
    });

    const byProject = new Map<string, Array<{ task: TickTickTask; range: { start: string; end: string } }>>();
    for (const item of visibleRangeItems) {
      const pId = String(item.task.projectId || "inbox");
      if (!byProject.has(pId)) byProject.set(pId, []);
      byProject.get(pId)!.push(item);
    }

    if (byProject.size === 0) {
      const emptyState = gridEl.createDiv({ cls: "ticktick-timeline-empty" });
      emptyState.style.gridColumn = `1 / span ${totalDays}`;
      emptyState.createDiv({
        cls: "ticktick-empty-desc",
        text: "هیچ تسک زمان‌داری با فیلترهای فعلی یافت نشد. می‌توانید از پنل «تسک‌های بدون بازه» تسک‌ها را اضافه کنید."
      });
      return;
    }

    for (const [projectId, items] of byProject.entries()) {
      const project = projectMap.get(projectId);
      const projName = project?.name ?? (projectId === "inbox" ? "صندوق ورودی" : "پروژه");
      const projColor = project?.color ?? "#7c6cff";

      // Project Header Bar spanning full width
      const projHeader = gridEl.createDiv({ cls: "ticktick-timeline-project-row" });
      projHeader.style.gridColumn = `1 / span ${totalDays}`;
      const colorDot = projHeader.createSpan({ cls: "ticktick-project-dot" });
      colorDot.style.backgroundColor = projColor;
      projHeader.createSpan({ cls: "ticktick-project-name", text: projName });
      projHeader.createSpan({ cls: "ticktick-project-count", text: `(${items.length})` });

      // Pack overlapping tasks into non-overlapping tracks/lanes
      const packed = packTimelineLanes(items);

      for (let laneIdx = 0; laneIdx < packed.totalLanes; laneIdx++) {
        const laneTasks = packed.assignments.filter(a => a.laneIndex === laneIdx);
        const laneRow = gridEl.createDiv({ cls: "ticktick-timeline-lane-row" });
        laneRow.style.gridColumn = `1 / span ${totalDays}`;
        laneRow.style.display = "grid";
        laneRow.style.direction = "rtl";
        laneRow.style.gridTemplateColumns = gridEl.style.gridTemplateColumns;

        for (const assignment of laneTasks) {
          this.renderRangeBar(laneRow, assignment.task, assignment.range, grid.days[0], totalDays, colWidthPx);
        }
      }
    }
  }

  private renderRangeBar(
    container: HTMLElement,
    task: TickTickTask,
    range: { start: string; end: string },
    gridStartDay: string,
    totalGridDays: number,
    colWidthPx: number
  ) {
    const placement = computeBarGridPlacement(range, gridStartDay, totalGridDays);
    const tone = getTimelineTaskTone(task, this.colorMode);
    const priority = taskPriority(task.priority);
    const isCompleted = Number(task.status ?? 0) !== 0;

    const bar = container.createDiv({
      cls: `ticktick-timeline-bar priority-${priority.value} ${isCompleted ? "is-completed" : ""}`,
      attr: {
        role: "button",
        tabindex: "0",
        title: `${task.title} · ${range.start} تا ${range.end}`
      }
    });

    bar.style.gridColumn = placement.gridColumn;
    if (bulkSelectionStore.isSelected(String(task.id))) {
      bar.addClass("is-bulk-selected");
    }
    bar.style.setProperty("--ticktick-task-tone", tone);

    // Left Handle (Start Date in RTL)
    const handleStart = bar.createDiv({
      cls: "ticktick-timeline-handle handle-start",
      attr: { "data-edge": "start", title: "تغییر تاریخ شروع" }
    });

    // Content: Checkbox + Title + Date Chip
    const contentWrapper = bar.createDiv({ cls: "ticktick-timeline-bar-content" });

    const check = contentWrapper.createEl("input", {
      type: "checkbox",
      cls: "ticktick-timeline-bar-check",
      attr: { "aria-label": `تکمیل ${task.title}` }
    });
    check.checked = isCompleted;
    check.disabled = isCompleted;
    check.addEventListener("click", e => e.stopPropagation());
    check.addEventListener("pointerdown", e => e.stopPropagation());
    check.addEventListener("change", async () => {
      await this.host.complete(task);
      await this.render();
    });

    const titleEl = contentWrapper.createSpan({
      cls: "ticktick-timeline-bar-title",
      text: String(task.title || "بدون عنوان")
    });

    const dateChip = contentWrapper.createSpan({
      cls: "ticktick-timeline-bar-date-chip",
      text: `${range.start.slice(5)} → ${range.end.slice(5)}`
    });

    // Right Handle (Due Date in RTL)
    const handleDue = bar.createDiv({
      cls: "ticktick-timeline-handle handle-due",
      attr: { "data-edge": "due", title: "تغییر تاریخ پایان" }
    });

    // Click on bar content opens details modal
    const openDetails = () => {
      new TaskDetailsModal(this.host.app, task, {
        complete: async () => {
          await this.host.complete(task);
          await this.render();
        },
        load: item => this.host.load(item),
        edit: item => this.host.edit(item),
        changed: async () => {
          await this.host.refresh();
          await this.render();
        }
      }).open();
    };

    contentWrapper.addEventListener("click", (e) => {
      if (this.activeDrag || this.wasDraggedRecently) return;
      if (e.shiftKey || e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        const sel = bulkSelectionStore.toggle(String(task.id));
        bar.toggleClass("is-bulk-selected", sel);
        return;
      }
      openDetails();
    });

    bar.addEventListener("keydown", (e) => {
      if (e.key === "x" || ((e.key === "Enter" || e.key === " ") && (e.shiftKey || e.ctrlKey))) {
        e.preventDefault();
        e.stopPropagation();
        const sel = bulkSelectionStore.toggle(String(task.id));
        bar.toggleClass("is-bulk-selected", sel);
        return;
      }
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openDetails();
      }
    });

    // Attach Pointer Drag / Resize Listeners
    this.bindPointerInteractions(bar, handleStart, handleDue, task, range, colWidthPx);
  }

  private bindPointerInteractions(
    bar: HTMLElement,
    handleStart: HTMLElement,
    handleDue: HTMLElement,
    task: TickTickTask,
    range: { start: string; end: string },
    colWidthPx: number
  ) {
    const onPointerDown = (event: PointerEvent, edge: "both" | "start" | "due") => {
      if (event.button !== 0) return; // Only primary mouse button
      event.stopPropagation();
      event.preventDefault();

      const startX = event.clientX;
      let deltaDays = 0;

      // Create floating preview tooltip
      const previewEl = document.body.createDiv({ cls: "ticktick-timeline-drag-preview" });
      previewEl.setText(`بازه: ${range.start} تا ${range.end}`);
      previewEl.style.left = `${event.clientX + 16}px`;
      previewEl.style.top = `${event.clientY + 16}px`;

      bar.addClass("is-dragging");

      this.activeDrag = {
        task,
        edge,
        startX,
        initialStart: range.start,
        initialDue: range.end,
        deltaDays: 0,
        previewEl,
        barEl: bar
      };

      const onPointerMove = (moveEvent: PointerEvent) => {
        if (!this.activeDrag) return;

        // In RTL: moving pointer to the Left (moveEvent.clientX < startX) advances forward in time (positive days)
        // moving pointer to the Right (moveEvent.clientX > startX) goes backward in time (negative days)
        const dx = startX - moveEvent.clientX;
        deltaDays = Math.round(dx / colWidthPx);
        this.activeDrag.deltaDays = deltaDays;

        // Compute candidate dates preview
        const shifted = shiftTimelineEndpoints(task, deltaDays, edge, this.host.timeZone);
        const newStart = toDateKey(shifted.startDate, this.host.timeZone);
        const newDue = toDateKey(shifted.dueDate, this.host.timeZone);

        const edgeLabel = edge === "both" ? "جابجایی کل بازه" : edge === "start" ? "تنظیم تاریخ شروع" : "تنظیم سررسید";
        previewEl.setText(`${edgeLabel}: ${newStart ?? "—"} تا ${newDue ?? "—"} (${deltaDays >= 0 ? `+${deltaDays}` : deltaDays} روز)`);
        previewEl.style.left = `${moveEvent.clientX + 16}px`;
        previewEl.style.top = `${moveEvent.clientY + 16}px`;
      };

      const onPointerUp = async (upEvent: PointerEvent) => {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("keydown", onKeyDown);

        if (!this.activeDrag) return;

        previewEl.remove();
        bar.removeClass("is-dragging");

        const finalDelta = this.activeDrag.deltaDays;
        const activeEdge = this.activeDrag.edge;
        this.activeDrag = null;

        if (finalDelta !== 0) {
          this.wasDraggedRecently = true;
          setTimeout(() => { this.wasDraggedRecently = false; }, 250);
          const shifted = shiftTimelineEndpoints(task, finalDelta, activeEdge, this.host.timeZone);
          const nextStart = toDateKey(shifted.startDate, this.host.timeZone);
          const nextDue = toDateKey(shifted.dueDate, this.host.timeZone);

          try {
            new Notice(`در حال بروزرسانی بازهٔ تسک به ${nextStart} تا ${nextDue}...`);
            await this.host.rescheduleRange(task, nextStart, nextDue);
            new Notice("بازه با موفقیت تنظیم شد.");
            await this.render();
          } catch (err) {
            new Notice(`خطا در ذخیرهٔ بازه: ${err instanceof Error ? err.message : String(err)}`);
            await this.render();
          }
        }
      };

      const onKeyDown = (keyEvent: KeyboardEvent) => {
        if (keyEvent.key === "Escape") {
          window.removeEventListener("pointermove", onPointerMove);
          window.removeEventListener("pointerup", onPointerUp);
          window.removeEventListener("keydown", onKeyDown);

          previewEl.remove();
          bar.removeClass("is-dragging");
          this.activeDrag = null;
          new Notice("جابجایی لغو شد.");
        }
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("keydown", onKeyDown);
    };

    // Body drag moves both endpoints
    bar.addEventListener("pointerdown", (e) => onPointerDown(e, "both"));

    // Handle drags resize single endpoint
    handleStart.addEventListener("pointerdown", (e) => onPointerDown(e, "start"));
    handleDue.addEventListener("pointerdown", (e) => onPointerDown(e, "due"));
  }

  private renderBacklogDrawer(
    pointTasks: Array<{ task: TickTickTask; range: { start: string; end: string } }>,
    backlogTasks: TickTickTask[]
  ) {
    const drawer = this.element.createDiv({ cls: "ticktick-timeline-backlog-drawer" });
    const header = drawer.createDiv({ cls: "ticktick-backlog-header" });
    header.createSpan({ cls: "ticktick-backlog-title", text: "تسک‌های نقطه‌ای و بدون بازهٔ مشخص" });

    const closeBtn = header.createEl("button", { cls: "ticktick-backlog-close mod-icon" });
    setIcon(closeBtn, "x");
    closeBtn.addEventListener("click", () => {
      this.showBacklog = false;
      void this.render();
    });

    const cardsContainer = drawer.createDiv({ cls: "ticktick-backlog-cards" });

    // 1. Point tasks (have single due date)
    for (const item of pointTasks) {
      const card = cardsContainer.createDiv({ cls: "ticktick-backlog-card is-point" });
      card.createDiv({ cls: "ticktick-card-title", text: item.task.title });
      card.createDiv({ cls: "ticktick-card-date", text: `سررسید: ${item.range.end}` });
      
      const planBtn = card.createEl("button", {
        cls: "ticktick-card-plan-btn",
        text: "ایجاد بازهٔ ۳ روزه"
      });
      planBtn.addEventListener("click", async () => {
        const start = item.range.end;
        const due = shiftCalendarDay(start, 3);
        await this.host.rescheduleRange(item.task, start, due);
        await this.render();
      });
    }

    // 2. Unscheduled backlog tasks
    for (const task of backlogTasks) {
      const card = cardsContainer.createDiv({ cls: "ticktick-backlog-card is-unscheduled" });
      card.createDiv({ cls: "ticktick-card-title", text: task.title });
      card.createDiv({ cls: "ticktick-card-badge", text: "بدون تاریخ" });

      const planBtn = card.createEl("button", {
        cls: "ticktick-card-plan-btn",
        text: "برنامه‌ریزی از امروز"
      });
      planBtn.addEventListener("click", async () => {
        const today = todayInZone(this.host.timeZone);
        const due = shiftCalendarDay(today, 2);
        await this.host.rescheduleRange(task, today, due);
        await this.render();
      });
    }

    if (pointTasks.length === 0 && backlogTasks.length === 0) {
      cardsContainer.createDiv({
        cls: "ticktick-backlog-empty",
        text: "تمام تسک‌های این فیلتر دارای بازهٔ زمانی روی تایم‌لاین هستند."
      });
    }
  }

  private shiftWindow(direction: number) {
    if (!this.windowStart || !this.windowEnd) return;
    const amount = this.zoom === "month" ? direction * 30 : this.zoom === "week" ? direction * 7 : direction * 14;
    this.windowStart = shiftCalendarDay(this.windowStart, amount);
    this.windowEnd = shiftCalendarDay(this.windowEnd, amount);
    void this.render();
  }
}
