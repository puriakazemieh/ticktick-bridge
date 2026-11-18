import { setIcon, Notice, Menu } from "obsidian";
import {
  computeDayTimeSlots,
  computeTimeSlotDropMutation,
  computeResizeBlockMutation,
  findCurrentActiveBlock,
  minutesToTimeString
} from "../core/timeblocking.js";
import { todayInZone, toDateKey } from "../core/date.js";
import { shiftCalendarDay } from "../core/calendar-range.js";
import { formatPersianDate } from "../core/persian-date.js";
import { taskPriority } from "./task-priority";
import { bulkSelectionStore } from "./selection-store";
import { BulkActionBar } from "./bulk-action-bar";
import { TaskDetailsModal } from "./task-details-modal";
import { cleanTaskTitle } from "./helpers";
import type { TickTickTask, TickTickProject } from "./types";

export interface TimeblockingPlannerHost {
  app: any;
  timeZone: string;
  tasks: () => TickTickTask[];
  projects: () => Promise<TickTickProject[]> | TickTickProject[];
  savedAt: () => string;
  refresh: () => Promise<void>;
  updateTask: (mutation: Partial<TickTickTask>) => Promise<any>;
  createTask?: (initial: Partial<TickTickTask>) => Promise<any>;
  deleteTask?: (task: TickTickTask) => Promise<any>;
  complete: (task: TickTickTask) => Promise<any>;
  load: (task: TickTickTask) => Promise<TickTickTask | undefined>;
  edit: (task: TickTickTask) => Promise<any>;
  executeBulkOperation?: (taskIds: string[], op: string, params: any) => Promise<any>;
}

export class TimeblockingPlanner {
  private dayOffset = 0;
  private isDrawerOpen = true;
  private bulkActionBar: BulkActionBar | null = null;
  private unsubscribeSelection: (() => void) | null = null;
  private isMutating = false;

  constructor(private element: HTMLElement, private host: TimeblockingPlannerHost) {
    this.element.addClass("ticktick-timeblock-root");
    this.element.style.direction = "rtl";

    this.unsubscribeSelection = bulkSelectionStore.subscribe(() => {
      this.updateSelectionClasses();
    });
  }

  destroy() {
    this.unsubscribeSelection?.();
    this.unsubscribeSelection = null;
    this.bulkActionBar?.destroy();
    this.bulkActionBar = null;
    this.element.empty();
  }

  async render() {
    this.element.empty();

    const today = todayInZone(this.host.timeZone);
    const targetDay = shiftCalendarDay(today, this.dayOffset);
    const allTasks = this.host.tasks();

    const agendaData = computeDayTimeSlots(allTasks, targetDay, {
      startHour: 7,
      endHour: 23,
      slotMinutes: 30,
      timeZone: this.host.timeZone
    });

    // 1. Toolbar
    const toolbar = this.element.createDiv({ cls: "ticktick-timeblock-toolbar" });

    // Date navigation group
    const dateGroup = toolbar.createDiv({ cls: "ticktick-timeblock-date-group" });
    
    const prevBtn = dateGroup.createEl("button", {
      cls: "ticktick-timeblock-nav-btn",
      attr: { "aria-label": "روز قبل", title: "روز قبل" }
    });
    setIcon(prevBtn, "chevron-right");
    prevBtn.addEventListener("click", () => {
      this.dayOffset--;
      void this.render();
    });

    const todayBtn = dateGroup.createEl("button", {
      cls: "ticktick-timeblock-nav-btn",
      text: "امروز"
    });
    todayBtn.addEventListener("click", () => {
      this.dayOffset = 0;
      void this.render();
    });

    const nextBtn = dateGroup.createEl("button", {
      cls: "ticktick-timeblock-nav-btn",
      attr: { "aria-label": "روز بعد", title: "روز بعد" }
    });
    setIcon(nextBtn, "chevron-left");
    nextBtn.addEventListener("click", () => {
      this.dayOffset++;
      void this.render();
    });

    const dateTitle = dateGroup.createDiv({ cls: "ticktick-timeblock-date-title" });
    const calIcon = dateTitle.createSpan();
    setIcon(calIcon, "calendar");
    dateTitle.createSpan({ text: formatPersianDate(targetDay) });

    if (this.dayOffset === 0) {
      const todayBadge = dateGroup.createSpan({ cls: "ticktick-timeblock-stat-pill" });
      todayBadge.setText("امروز");
    }

    const timedCountBadge = dateGroup.createSpan({ cls: "ticktick-timeblock-stat-pill" });
    timedCountBadge.setText(`${agendaData.counts.timed} کار زمان‌دار`);

    const actions = toolbar.createDiv({ cls: "ticktick-timeblock-actions" });

    // Toggle side drawer button
    const drawerToggleBtn = actions.createEl("button", {
      cls: "ticktick-timeblock-nav-btn",
      attr: { "aria-label": "فهرست تسک‌های بدون زمان", title: "تسک‌های بدون زمان" }
    });
    setIcon(drawerToggleBtn, "sidebar");
    drawerToggleBtn.createSpan({ text: ` کارهای امروز (${agendaData.counts.untimed})` });
    drawerToggleBtn.addEventListener("click", () => {
      this.isDrawerOpen = !this.isDrawerOpen;
      void this.render();
    });

    // Refresh button
    const refreshBtn = actions.createEl("button", { cls: "ticktick-timeblock-nav-btn" });
    const refreshIcon = refreshBtn.createSpan();
    setIcon(refreshIcon, "refresh-cw");
    refreshBtn.createSpan({ text: "بروزرسانی" });
    refreshBtn.addEventListener("click", async () => {
      refreshBtn.disabled = true;
      try {
        await this.host.refresh();
        await this.render();
      } finally {
        refreshBtn.disabled = false;
      }
    });

    // Quick add button
    const addBtn = actions.createEl("button", {
      cls: "ticktick-timeblock-btn ticktick-timeblock-btn-primary tb-action-add-task",
      attr: { type: "button", "aria-label": "افزودن تسک جدید" }
    });
    const addIcon = addBtn.createSpan({ cls: "ticktick-btn-icon" });
    setIcon(addIcon, "plus");
    addBtn.createSpan({ text: "+ تسک جدید" });
    addBtn.addEventListener("click", async () => {
      if (!this.host.createTask) return;
      await this.host.createTask({ dueDate: targetDay });
      await this.render();
    });

    // 2. Main Layout Content (Grid + Drawer)
    const content = this.element.createDiv({ cls: "ticktick-timeblock-content" });

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

    // Render Slots as Drop Targets
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
        const taskId = e.dataTransfer?.getData("application/x-ticktick-task-id") || e.dataTransfer?.getData("text/plain");
        if (!taskId) return;
        const hour = Math.floor(slot.startMinutes / 60);
        const minute = slot.startMinutes % 60;
        await this.handleDropOnSlot(taskId, targetDay, hour, minute);
      });
    }

    // Current Time Indicator (if targetDay is today)
    if (targetDay === today) {
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
      this.renderTimedCard(slotsCol, timedItem, targetDay, dayStartMin, agendaData.slotMinutes);
    }

    // 3. Side Drawer (Untimed & Overdue)
    if (this.isDrawerOpen) {
      this.renderDrawer(content, agendaData.untimed, agendaData.overdue, targetDay);
    }

    // 4. Mount Bulk Action Bar
    if (this.host.executeBulkOperation) {
      this.bulkActionBar = new BulkActionBar(this.element, {
        app: this.host.app,
        timeZone: this.host.timeZone,
        tasks: () => this.host.tasks(),
        projects: () => this.host.projects(),
        executeBulkOperation: this.host.executeBulkOperation,
        onChanged: async () => {
          await this.render();
        }
      });
      await this.bulkActionBar.render();
    }

    this.updateSelectionClasses();
  }

  private renderTimedCard(
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

    // Calculate vertical position and height (32px per slot)
    const topPx = ((item.effectiveStart - dayStartMin) / slotMinutes) * 32;
    const heightPx = Math.max(30, ((item.effectiveEnd - item.effectiveStart) / slotMinutes) * 32 - 2);

    card.style.top = `${topPx}px`;
    card.style.height = `${heightPx}px`;

    // Lane width and right offset (for RTL)
    const widthPercent = 100 / item.totalLanes;
    const rightPercent = item.laneIndex * widthPercent;
    card.style.width = `calc(${widthPercent}% - 6px)`;
    card.style.right = `${rightPercent}%`;

    // Drag handlers
    card.addEventListener("dragstart", e => {
      if (e.dataTransfer) {
        e.dataTransfer.setData("application/x-ticktick-task-id", String(item.task.id));
        e.dataTransfer.setData("text/plain", String(item.task.id));
        e.dataTransfer.effectAllowed = "move";
      }
      card.addClass("is-dragging");
    });

    card.addEventListener("dragend", () => {
      card.removeClass("is-dragging");
    });

    // Card Header
    const header = card.createDiv({ cls: "ticktick-timeblock-card-header" });
    const titleEl = header.createDiv({ cls: "ticktick-timeblock-card-title" });
    titleEl.setText(cleanTaskTitle(item.task.title));

    const timeEl = header.createDiv({ cls: "ticktick-timeblock-card-time" });
    timeEl.setText(`${item.range.startTime} - ${item.range.endTime}`);

    // Click card opens details modal
    card.addEventListener("click", e => {
      if (e.shiftKey || e.ctrlKey || e.metaKey) {
        bulkSelectionStore.toggle(String(item.task.id));
        return;
      }
      new TaskDetailsModal(this.host.app, item.task, {
        edit: this.host.edit,
        load: this.host.load,
        complete: async () => {
          await this.host.complete(item.task);
          await this.render();
        },
        updateTask: (m) => this.host.updateTask(m),
        deleteTask: this.host.deleteTask ? (t) => this.host.deleteTask!(t) : undefined,
        createTask: this.host.createTask ? (d) => this.host.createTask!(d) : undefined,
        allTasks: () => this.host.tasks(),
        changed: async () => {
          await this.render();
        }
      }).open();
    });

    // Resize Duration Handle / Context Menu
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
              await this.host.updateTask(mutation);
              await this.render();
            }
          });
        });
      }
      menu.showAtMouseEvent(e);
    });
  }

  private renderDrawer(
    content: HTMLElement,
    untimed: TickTickTask[],
    overdue: TickTickTask[],
    targetDay: string
  ) {
    const drawer = content.createDiv({ cls: "ticktick-timeblock-drawer" });

    // Section 1: Untimed today
    const titleToday = drawer.createDiv({ cls: "ticktick-timeblock-drawer-title" });
    titleToday.createSpan({ text: "تسک‌های امروز (بدون ساعت)" });
    titleToday.createSpan({ cls: "ticktick-timeblock-stat-pill", text: String(untimed.length) });

    const untimedList = drawer.createDiv({ cls: "ticktick-timeblock-untimed-list" });
    if (untimed.length === 0) {
      untimedList.createDiv({ cls: "ticktick-matrix-empty", text: "موردی نیست." });
    } else {
      for (const task of untimed) {
        this.renderDrawerTaskCard(untimedList, task);
      }
    }

    // Section 2: Overdue
    if (overdue.length > 0) {
      const titleOverdue = drawer.createDiv({ cls: "ticktick-timeblock-drawer-title" });
      titleOverdue.createSpan({ text: "معوقه از قبل" });
      const overdueBadge = titleOverdue.createSpan({ cls: "ticktick-timeblock-stat-pill" });
      overdueBadge.setText(String(overdue.length));
      overdueBadge.style.color = "#dc2626";

      const overdueList = drawer.createDiv({ cls: "ticktick-timeblock-untimed-list" });
      for (const task of overdue) {
        this.renderDrawerTaskCard(overdueList, task, true);
      }
    }
  }

  private renderDrawerTaskCard(container: HTMLElement, task: TickTickTask, isOverdue = false) {
    const card = container.createDiv({ cls: "ticktick-timeblock-untimed-card" });
    card.dataset.taskId = String(task.id);
    card.setAttribute("draggable", "true");

    const prio = taskPriority(task.priority);
    const prioDot = card.createSpan({ cls: `ticktick-matrix-priority-dot ${prio.className}` });

    const titleEl = card.createSpan({ text: cleanTaskTitle(task.title) });
    titleEl.style.flex = "1";
    titleEl.style.overflow = "hidden";
    titleEl.style.textOverflow = "ellipsis";
    titleEl.style.whiteSpace = "nowrap";

    if (isOverdue) {
      const due = toDateKey(task.dueDate, task.timeZone || this.host.timeZone);
      if (due) {
        const badge = card.createSpan({ cls: "ticktick-matrix-meta-pill is-overdue", text: formatPersianDate(due) });
      }
    }

    card.addEventListener("dragstart", e => {
      if (e.dataTransfer) {
        e.dataTransfer.setData("application/x-ticktick-task-id", String(task.id));
        e.dataTransfer.setData("text/plain", String(task.id));
        e.dataTransfer.effectAllowed = "move";
      }
      card.addClass("is-dragging");
    });

    card.addEventListener("dragend", () => {
      card.removeClass("is-dragging");
    });

    card.addEventListener("click", () => {
      new TaskDetailsModal(this.host.app, task, {
        edit: this.host.edit,
        load: this.host.load,
        complete: async () => {
          await this.host.complete(task);
          await this.render();
        },
        updateTask: (m) => this.host.updateTask(m),
        deleteTask: this.host.deleteTask ? (t) => this.host.deleteTask!(t) : undefined,
        createTask: this.host.createTask ? (d) => this.host.createTask!(d) : undefined,
        allTasks: () => this.host.tasks(),
        changed: async () => {
          await this.render();
        }
      }).open();
    });
  }

  private async handleDropOnSlot(taskId: string, targetDay: string, hour: number, minute: number) {
    if (this.isMutating) return;
    this.isMutating = true;

    try {
      const allTasks = this.host.tasks();
      const task = allTasks.find(t => String(t.id) === taskId);
      if (!task) return;

      const mutation = computeTimeSlotDropMutation(task, targetDay, hour, minute, 45, this.host.timeZone);
      if (mutation) {
        await this.host.updateTask(mutation);
        const timeStr = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
        new Notice(`تسک «${cleanTaskTitle(task.title)}» برای ساعت ${timeStr} زمان‌بندی شد.`);
        await this.render();
      }
    } catch (err) {
      new Notice(err instanceof Error ? err.message : "زمان‌بندی تسک ناموفق بود.");
    } finally {
      this.isMutating = false;
    }
  }

  private updateSelectionClasses() {
    const selected = new Set(bulkSelectionStore.getSelection());
    const cards = this.element.querySelectorAll<HTMLElement>(".ticktick-timeblock-card");
    cards.forEach(card => {
      const tid = card.dataset.taskId;
      if (tid && selected.has(tid)) {
        card.addClass("is-selected");
      } else {
        card.removeClass("is-selected");
      }
    });
  }
}
