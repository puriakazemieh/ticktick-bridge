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
import { cleanTaskTitle } from "./helpers";
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
  private scrollAreaEl: HTMLElement | null = null;

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

  async render(autoScrollToToday = true) {
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

    // Ensure focused window bounds around today for the current zoom
    this.ensureWindowBounds();

    // Top Controls & Navigation Toolbar (Unified with Calendar Suite)
    this.renderToolbar(partitioned.backlogTasks.length + partitioned.pointTasks.length);

    // Shared Filter Bar
    this.renderFilterBar(projects, enrichedTasks);

    // Main Timeline Surface (Canvas)
    const canvas = this.element.createDiv({ cls: "ticktick-timeline-canvas" });
    this.renderTimelineGrid(canvas, partitioned.rangeTasks, partitioned.pointTasks, projectMap, autoScrollToToday);

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
        await this.render(false);
      }
    });
    void this.bulkActionBar.render();
  }

  private ensureWindowBounds() {
    if (this.windowStart && this.windowEnd) return;
    const today = todayInZone(this.host.timeZone);
    if (this.zoom === "day") {
      // 60-day window centered on today: 14 days in the past, 45 days in the future
      this.windowStart = shiftCalendarDay(today, -14);
      this.windowEnd = shiftCalendarDay(today, 45);
    } else if (this.zoom === "week") {
      // 16-week window (112 days): 4 weeks in the past, 12 weeks in the future
      this.windowStart = shiftCalendarDay(today, -28);
      this.windowEnd = shiftCalendarDay(today, 84);
    } else {
      // 12-month window: 2 months in the past, 10 months in the future
      this.windowStart = shiftCalendarDay(today, -60);
      this.windowEnd = shiftCalendarDay(today, 305);
    }
  }

  private shiftWindow(direction: number) {
    if (!this.windowStart || !this.windowEnd) return;
    const amount = this.zoom === "month" ? direction * 90 : this.zoom === "week" ? direction * 28 : direction * 14;
    this.windowStart = shiftCalendarDay(this.windowStart, amount);
    this.windowEnd = shiftCalendarDay(this.windowEnd, amount);
    void this.render(false);
  }

  private renderToolbar(backlogCount: number) {
    const toolbar = this.element.createDiv({ cls: "ticktick-planner-controls ticktick-timeline-toolbar" });

    // 1. Mode Segmented Control (Unified with PlanningCalendar)
    const modesContainer = toolbar.createDiv({ cls: "ticktick-planner-modes" });
    for (const [mode, label, icon] of [
      ["day", "روز", "calendar"],
      ["week", "هفته", "calendar-days"],
      ["month", "ماه", "calendar-range"]
    ] as Array<[TimelineZoom, string, string]>) {
      const button = modesContainer.createEl("button", {
        cls: `ticktick-planner-mode-btn ${this.zoom === mode ? "is-active" : ""}`,
        attr: { type: "button" }
      });
      const iconSpan = button.createSpan({ cls: "ticktick-mode-icon" });
      setIcon(iconSpan, icon);
      button.createSpan({ text: label });
      button.addEventListener("click", () => {
        if (this.zoom !== mode) {
          this.zoom = mode;
          this.windowStart = null;
          this.windowEnd = null;
          void this.render(true);
        }
      });
    }

    // 2. Date Navigation Controls (‹, امروز, ›, Date Title)
    const nav = toolbar.createDiv({ cls: "ticktick-planner-nav" });

    const prevBtn = nav.createEl("button", {
      cls: "ticktick-nav-btn mod-icon",
      text: "‹",
      attr: { type: "button", "aria-label": "دورهٔ قبل" }
    });
    prevBtn.addEventListener("click", () => this.shiftWindow(-1));

    const todayBtn = nav.createEl("button", {
      cls: "ticktick-nav-today-btn",
      text: "امروز",
      attr: { type: "button" }
    });
    todayBtn.addEventListener("click", () => {
      this.windowStart = null;
      this.windowEnd = null;
      void this.render(true);
    });

    const nextBtn = nav.createEl("button", {
      cls: "ticktick-nav-btn mod-icon",
      text: "›",
      attr: { type: "button", "aria-label": "دورهٔ بعد" }
    });
    nextBtn.addEventListener("click", () => this.shiftWindow(1));

    const titleDiv = nav.createDiv({ cls: "ticktick-planner-date-title" });
    if (this.windowStart && this.windowEnd) {
      titleDiv.setText(`${formatPersianDate(this.windowStart, this.host.timeZone)} تا ${formatPersianDate(this.windowEnd, this.host.timeZone)}`);
    }

    // 3. Action Buttons (Color, Backlog, Sync)
    const actions = toolbar.createDiv({ cls: "ticktick-planner-actions" });

    const colorLabels: Record<TimelineColorMode, string> = {
      project: "رنگ: پروژه",
      tag: "رنگ: برچسب",
      priority: "رنگ: اولویت",
      uniform: "رنگ: یکدست"
    };

    const colorBtn = actions.createEl("button", {
      cls: "ticktick-planner-toggle-btn",
      attr: { type: "button", "aria-label": "پالت رنگ‌بندی" }
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
              void this.render(false);
            });
        });
      }
      menu.showAtMouseEvent(event);
    });

    const backlogBtn = actions.createEl("button", {
      cls: `ticktick-planner-toggle-btn ${this.showBacklog ? "is-active" : ""}`,
      attr: { type: "button", "aria-label": "تسک‌های بدون بازه و نقطه‌ای" }
    });
    const backlogIcon = backlogBtn.createSpan({ cls: "mod-icon" });
    setIcon(backlogIcon, "layers");
    backlogBtn.createSpan({ text: `تسک‌های بدون بازه (${backlogCount})` });
    backlogBtn.addEventListener("click", () => {
      this.showBacklog = !this.showBacklog;
      void this.render(false);
    });

    const refreshBtn = actions.createEl("button", {
      cls: `ticktick-planner-sync-btn mod-icon ${this.isSyncing ? "is-syncing" : ""}`,
      attr: { type: "button", "aria-label": "همگام‌سازی از سرور" }
    });
    setIcon(refreshBtn, "refresh-cw");
    refreshBtn.addEventListener("click", async () => {
      if (this.isSyncing) return;
      this.isSyncing = true;
      refreshBtn.addClass("is-syncing");
      try {
        await this.host.refresh();
      } finally {
        this.isSyncing = false;
        refreshBtn.removeClass("is-syncing");
        await this.render(false);
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
        void this.render(false);
      }
    };

    this.filterBarInstance = new FilterBar(filterContainer, filterHost);
    this.filterBarInstance.render();
  }

  private renderTimelineGrid(
    canvas: HTMLElement,
    rangeItems: Array<{ task: TickTickTask; range: { start: string; end: string } }>,
    pointItems: Array<{ task: TickTickTask; range: { start: string; end: string } }>,
    projectMap: Map<string, TickTickProject>,
    autoScrollToToday: boolean
  ) {
    if (!this.windowStart || !this.windowEnd) return;

    const grid = generateTimelineGrid(this.windowStart, this.windowEnd, this.zoom, this.host.firstWeekday);
    const totalDays = grid.days.length;
    const today = todayInZone(this.host.timeZone);

    // Column width in pixels: generous space for day/week/month
    const colWidthPx = this.zoom === "day" ? 54 : this.zoom === "week" ? 22 : 8;

    const scrollArea = canvas.createDiv({ cls: "ticktick-timeline-scroll-area" });
    this.scrollAreaEl = scrollArea;

    const gridEl = scrollArea.createDiv({ cls: "ticktick-timeline-grid" });
    gridEl.style.direction = "rtl";
    gridEl.style.setProperty("--grid-col-width", `${colWidthPx}px`);
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
      const isColToday = colKey === today;
      const colHeader = headerRow.createDiv({
        cls: `ticktick-timeline-col-header ${isColToday ? "is-today" : ""}`
      });
      colHeader.style.gridColumn = `${col.colStart} / span ${col.colSpan}`;
      if (this.zoom === "day") {
        const jsDate = new Date(`${col.date ?? colKey}T12:00:00Z`);
        const weekdayName = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { weekday: "narrow" }).format(jsDate);
        const dayNum = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { day: "numeric" }).format(jsDate);
        const isWeekend = jsDate.getUTCDay() === 5; // Friday in Iran
        if (isWeekend) colHeader.addClass("is-weekend");
        colHeader.createDiv({ cls: "ticktick-col-weekday", text: weekdayName });
        const dayNumEl = colHeader.createDiv({ cls: "ticktick-col-daynum", text: dayNum });
        if (isColToday) dayNumEl.addClass("is-today-badge");
      } else if (this.zoom === "week") {
        const startDay = col.start ?? colKey;
        const endDay = col.end ?? colKey;
        const pStart = formatPersianDate(startDay, this.host.timeZone).replace(/\s*\d{4}$/, "");
        const pEnd = formatPersianDate(endDay, this.host.timeZone).replace(/\s*\d{4}$/, "");
        colHeader.createDiv({ cls: "ticktick-col-week-title", text: `${pStart} تا ${pEnd}` });
      } else {
        const jsDate = new Date(`${col.start ?? colKey}T12:00:00Z`);
        const monthName = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { month: "long", year: "numeric" }).format(jsDate);
        colHeader.createDiv({ cls: "ticktick-col-month-title", text: monthName });
      }
    }

    // 2. Today Indicator Column Stripe
    const todayIndex = grid.days.indexOf(today);
    if (todayIndex >= 0) {
      const todayStripe = gridEl.createDiv({ cls: "ticktick-timeline-today-stripe" });
      todayStripe.style.gridColumn = `${todayIndex + 1} / span 1`;
      todayStripe.style.gridRow = `1 / -1`;
    }

    // 3. Mouse Wheel Horizontal Scroll Listener
    scrollArea.addEventListener("wheel", (e: WheelEvent) => {
      if (e.ctrlKey || scrollArea.scrollWidth <= scrollArea.clientWidth) return;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; // Native horizontal scroll
      e.preventDefault();
      scrollArea.scrollBy({ left: -e.deltaY * 1.5, behavior: "auto" });
    }, { passive: false });

    // 4. Pointer Drag-to-Pan on Canvas
    this.bindCanvasPan(scrollArea);

    // 5. Project Grouping & Packed Lanes
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
        text: "هیچ تسک زمان‌داری در این بازه یافت نشد. می‌توانید با دکمه‌های «‹» و «›» در زمان جابجا شوید یا از «تسک‌های بدون بازه» تسک‌ها را اضافه کنید."
      });
      if (autoScrollToToday) {
        this.scrollToToday(false);
      }
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

    if (autoScrollToToday) {
      this.scrollToToday(false);
    }
  }

  private bindCanvasPan(scrollArea: HTMLElement) {
    let isPanning = false;
    let startX = 0;
    let initialScrollLeft = 0;

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      if (target.closest(".ticktick-timeline-bar, .ticktick-timeline-handle, button, input, .ticktick-backlog-card")) {
        return;
      }
      isPanning = true;
      startX = e.clientX;
      initialScrollLeft = scrollArea.scrollLeft;
      scrollArea.addClass("is-panning");
      try { scrollArea.setPointerCapture(e.pointerId); } catch {}
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isPanning) return;
      const dx = e.clientX - startX;
      scrollArea.scrollLeft = initialScrollLeft - dx;
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!isPanning) return;
      isPanning = false;
      scrollArea.removeClass("is-panning");
      try { scrollArea.releasePointerCapture(e.pointerId); } catch {}
    };

    scrollArea.addEventListener("pointerdown", onPointerDown);
    scrollArea.addEventListener("pointermove", onPointerMove);
    scrollArea.addEventListener("pointerup", onPointerUp);
    scrollArea.addEventListener("pointercancel", onPointerUp);
  }

  private scrollToToday(smooth = false) {
    requestAnimationFrame(() => {
      if (!this.scrollAreaEl) return;
      const todayMarker = this.scrollAreaEl.querySelector(".ticktick-timeline-col-header.is-today, .ticktick-timeline-today-stripe");
      if (todayMarker && typeof (todayMarker as HTMLElement).scrollIntoView === "function") {
        (todayMarker as HTMLElement).scrollIntoView({
          behavior: smooth ? "smooth" : "auto",
          inline: "center",
          block: "nearest"
        });
      }
    });
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
      cls: `ticktick-timeline-bar ticktick-planner-range-task priority-${priority.value} ${isCompleted ? "is-completed" : ""}`,
      attr: {
        role: "button",
        tabindex: "0",
        title: `${task.title} · ${formatPersianDate(range.start, this.host.timeZone)} تا ${formatPersianDate(range.end, this.host.timeZone)}`
      }
    });
    bar.dataset.taskId = String(task.id);
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

    // Checkbox (circular, unified with planning calendar)
    const check = bar.createEl("input", {
      type: "checkbox",
      cls: "ticktick-range-check",
      attr: { "aria-label": `تکمیل ${task.title}` }
    });
    check.checked = isCompleted;
    check.disabled = isCompleted;
    check.addEventListener("click", e => e.stopPropagation());
    check.addEventListener("pointerdown", e => e.stopPropagation());
    check.addEventListener("change", async () => {
      await this.host.complete(task);
      await this.render(false);
    });

    // Title
    bar.createSpan({
      cls: "ticktick-range-title",
      text: cleanTaskTitle(task.title || "بدون عنوان")
    });

    // Date Badge (only when bar has sufficient width to avoid overflow)
    const minSpanForBadge = this.zoom === "day" ? 3 : this.zoom === "week" ? 6 : 14;
    if (placement.colSpan >= minSpanForBadge) {
      const pStart = formatPersianDate(range.start, this.host.timeZone);
      const pEnd = formatPersianDate(range.end, this.host.timeZone);
      bar.createSpan({
        cls: "ticktick-range-dates-badge",
        text: `${pStart} تا ${pEnd}`
      });
    }

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
          await this.render(false);
        },
        load: item => this.host.load(item),
        edit: item => this.host.edit(item),
        changed: async () => {
          await this.host.refresh();
          await this.render(false);
        },
        allTasks: () => this.host.tasks(),
      }).open();
    };

    bar.addEventListener("click", (e) => {
      if (this.activeDrag || this.wasDraggedRecently) return;
      const target = e.target as HTMLElement;
      if (target.closest(".ticktick-range-check, .ticktick-timeline-handle")) return;
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
      const pInitStart = formatPersianDate(range.start, this.host.timeZone);
      const pInitDue = formatPersianDate(range.end, this.host.timeZone);
      previewEl.setText(`بازه: ${pInitStart} تا ${pInitDue}`);
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

        const edgeLabel = edge === "both" ? "جابجایی بازه" : edge === "start" ? "تنظیم تاریخ شروع" : "تنظیم سررسید";
        const pStart = newStart ? formatPersianDate(newStart, this.host.timeZone) : "—";
        const pDue = newDue ? formatPersianDate(newDue, this.host.timeZone) : "—";
        previewEl.setText(`${edgeLabel}: ${pStart} تا ${pDue} (${deltaDays >= 0 ? `+${deltaDays}` : deltaDays} روز)`);
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
            const pStart = nextStart ? formatPersianDate(nextStart, this.host.timeZone) : "—";
            const pDue = nextDue ? formatPersianDate(nextDue, this.host.timeZone) : "—";
            new Notice(`در حال بروزرسانی بازهٔ تسک به ${pStart} تا ${pDue}...`);
            await this.host.rescheduleRange(task, nextStart, nextDue);
            new Notice("بازه با موفقیت تنظیم شد.");
            await this.render(false);
          } catch (err) {
            new Notice(`خطا در ذخیرهٔ بازه: ${err instanceof Error ? err.message : String(err)}`);
            await this.render(false);
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
    header.createSpan({ cls: "ticktick-backlog-title", text: "تسک‌های بدون بازه و نقطه‌ای" });

    const closeBtn = header.createEl("button", { cls: "ticktick-backlog-close mod-icon" });
    setIcon(closeBtn, "x");
    closeBtn.addEventListener("click", () => {
      this.showBacklog = false;
      void this.render(false);
    });

    const cardsContainer = drawer.createDiv({ cls: "ticktick-backlog-cards" });

    // 1. Point tasks (have single due date)
    for (const item of pointTasks) {
      const card = cardsContainer.createDiv({ cls: "ticktick-backlog-card is-point" });
      card.dataset.taskId = String(item.task.id);
      if (bulkSelectionStore.isSelected(String(item.task.id))) {
        card.addClass("is-bulk-selected");
      }

      card.addEventListener("click", (e) => {
        if (e.shiftKey || e.ctrlKey || e.metaKey) {
          e.preventDefault();
          e.stopPropagation();
          bulkSelectionStore.toggle(String(item.task.id));
        }
      });

      card.createDiv({ cls: "ticktick-card-title", text: cleanTaskTitle(item.task.title) });
      const pDue = formatPersianDate(item.range.end, this.host.timeZone);
      card.createDiv({ cls: "ticktick-card-date", text: `سررسید: ${pDue}` });
      
      const planBtn = card.createEl("button", {
        cls: "ticktick-card-plan-btn",
        text: "ایجاد بازهٔ ۳ روزه"
      });
      planBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const start = item.range.end;
        const due = shiftCalendarDay(start, 3);
        await this.host.rescheduleRange(item.task, start, due);
        await this.render(false);
      });
    }

    // 2. Unscheduled backlog tasks
    for (const task of backlogTasks) {
      const card = cardsContainer.createDiv({ cls: "ticktick-backlog-card is-unscheduled" });
      card.dataset.taskId = String(task.id);
      if (bulkSelectionStore.isSelected(String(task.id))) {
        card.addClass("is-bulk-selected");
      }

      card.addEventListener("click", (e) => {
        if (e.shiftKey || e.ctrlKey || e.metaKey) {
          e.preventDefault();
          e.stopPropagation();
          bulkSelectionStore.toggle(String(task.id));
        }
      });

      card.createDiv({ cls: "ticktick-card-title", text: cleanTaskTitle(task.title) });
      card.createDiv({ cls: "ticktick-card-badge", text: "بدون تاریخ" });

      const planBtn = card.createEl("button", {
        cls: "ticktick-card-plan-btn",
        text: "برنامه‌ریزی از امروز"
      });
      planBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const today = todayInZone(this.host.timeZone);
        const due = shiftCalendarDay(today, 2);
        await this.host.rescheduleRange(task, today, due);
        await this.render(false);
      });
    }

    if (pointTasks.length === 0 && backlogTasks.length === 0) {
      cardsContainer.createDiv({
        cls: "ticktick-backlog-empty",
        text: "تمام تسک‌های این فیلتر دارای بازهٔ زمانی روی تایم‌لاین هستند."
      });
    }
  }
}
