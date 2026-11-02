import { setIcon, Notice, Menu } from "obsidian";
import {
  QUADRANTS,
  QUADRANT_IDS,
  partitionEisenhowerMatrix,
  computeQuadrantDropMutation
} from "../core/eisenhower-matrix.js";
import { todayInZone, toDateKey } from "../core/date.js";
import { shiftCalendarDay } from "../core/calendar-range.js";
import { formatPersianDate } from "../core/persian-date.js";
import { taskPriority } from "./task-priority";
import { bulkSelectionStore } from "./selection-store";
import { BulkActionBar } from "./bulk-action-bar";
import { TaskDetailsModal } from "./task-details-modal";
import { formatTaskEstimate } from "../core/task-hierarchy.js";
import { cleanTaskTitle } from "./helpers";
import type { TickTickTask, TickTickProject } from "./types";

export interface EisenhowerMatrixHost {
  app: any;
  timeZone: string;
  tasks: () => TickTickTask[];
  projects: () => Promise<TickTickProject[]> | TickTickProject[];
  savedAt: () => string;
  refresh: () => Promise<void>;
  updateTask: (mutation: Partial<TickTickTask>) => Promise<any>;
  createTask?: (initial: Partial<TickTickTask>) => Promise<any>;
  complete: (task: TickTickTask) => Promise<any>;
  load: (task: TickTickTask) => Promise<TickTickTask | undefined>;
  edit: (task: TickTickTask) => Promise<any>;
  executeBulkOperation?: (taskIds: string[], op: string, params: any) => Promise<any>;
}

export class EisenhowerMatrix {
  private searchFilter = "";
  private selectedProjectId = "";
  private bulkActionBar: BulkActionBar | null = null;
  private unsubscribeSelection: (() => void) | null = null;
  private isMutating = false;

  constructor(private element: HTMLElement, private host: EisenhowerMatrixHost) {
    this.element.addClass("ticktick-matrix-root");
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
    let allTasks = this.host.tasks();

    // Apply project filter
    if (this.selectedProjectId) {
      allTasks = allTasks.filter(t => String(t.projectId) === this.selectedProjectId);
    }

    // Apply search filter
    if (this.searchFilter.trim()) {
      const q = this.searchFilter.trim().toLowerCase();
      allTasks = allTasks.filter(t => {
        const title = String(t.title ?? "").toLowerCase();
        const desc = String(t.content ?? "").toLowerCase();
        const tags = Array.isArray(t.tags) ? t.tags.join(" ").toLowerCase() : "";
        return title.includes(q) || desc.includes(q) || tags.includes(q);
      });
    }

    const matrixData = partitionEisenhowerMatrix(allTasks, {
      today,
      timeZone: this.host.timeZone
    });

    // 1. Header Toolbar
    const toolbar = this.element.createDiv({ cls: "ticktick-matrix-toolbar" });
    const titleGroup = toolbar.createDiv({ cls: "ticktick-matrix-toolbar-title-group" });
    const title = titleGroup.createDiv({ cls: "ticktick-matrix-toolbar-title" });
    const iconEl = title.createSpan();
    setIcon(iconEl, "grid");
    title.createSpan({ text: "ماتریس تصمیم‌گیری آیزنهاور" });

    const totalPill = titleGroup.createSpan({ cls: "ticktick-matrix-total-pill" });
    totalPill.setText(`${matrixData.counts.totalOpen} تسک فعال`);

    const controls = toolbar.createDiv({ cls: "ticktick-matrix-toolbar-controls" });

    // Search Input
    const searchInput = controls.createEl("input", {
      type: "search",
      cls: "ticktick-matrix-search-input",
      placeholder: "جستجو در ماتریس…"
    });
    searchInput.value = this.searchFilter;
    searchInput.addEventListener("input", () => {
      this.searchFilter = searchInput.value;
      void this.render();
    });

    // Project Dropdown
    const projectSelect = controls.createEl("select", { cls: "ticktick-matrix-project-select" });
    const defaultOpt = projectSelect.createEl("option", { text: "همهٔ پروژه‌ها", value: "" });
    defaultOpt.selected = !this.selectedProjectId;

    Promise.resolve(this.host.projects()).then(projects => {
      if (Array.isArray(projects)) {
        for (const proj of projects) {
          const opt = projectSelect.createEl("option", { text: proj.name, value: String(proj.id) });
          if (String(proj.id) === this.selectedProjectId) opt.selected = true;
        }
      }
    });

    projectSelect.addEventListener("change", () => {
      this.selectedProjectId = projectSelect.value;
      void this.render();
    });

    // Refresh Button
    const refreshBtn = controls.createEl("button", { cls: "ticktick-matrix-btn" });
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

    // Quick Add Button
    const addBtn = controls.createEl("button", { cls: "ticktick-matrix-btn ticktick-matrix-btn-accent" });
    const addIcon = addBtn.createSpan();
    setIcon(addIcon, "plus");
    addBtn.createSpan({ text: "افزودن تسک" });
    addBtn.addEventListener("click", () => {
      void this.promptAddTask("q1", today);
    });

    // 2. 2x2 Matrix Grid
    const grid = this.element.createDiv({ cls: "ticktick-matrix-grid" });

    // Render Quadrants in order: Q1, Q2, Q3, Q4
    this.renderQuadrant(grid, "q1", matrixData.q1, today);
    this.renderQuadrant(grid, "q2", matrixData.q2, today);
    this.renderQuadrant(grid, "q3", matrixData.q3, today);
    this.renderQuadrant(grid, "q4", matrixData.q4, today);

    // 3. Mount Bulk Action Bar
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

  private renderQuadrant(
    grid: HTMLElement,
    qid: "q1" | "q2" | "q3" | "q4",
    tasks: TickTickTask[],
    today: string
  ) {
    const meta = QUADRANTS[qid];
    const quad = grid.createDiv({ cls: `ticktick-matrix-quadrant is-${qid}` });
    quad.dataset.quadrantId = qid;

    // Header
    const header = quad.createDiv({ cls: "ticktick-matrix-quadrant-header" });
    const titleGroup = header.createDiv({ cls: "ticktick-matrix-quadrant-title-group" });

    const badge = titleGroup.createSpan({ cls: "ticktick-matrix-quadrant-badge" });
    badge.setText(qid.toUpperCase());

    const namesDiv = titleGroup.createDiv();
    const nameEl = namesDiv.createDiv({ cls: "ticktick-matrix-quadrant-name" });
    nameEl.setText(meta.title);
    const descEl = namesDiv.createDiv({ cls: "ticktick-matrix-quadrant-desc" });
    descEl.setText(meta.subtitle);

    const actions = header.createDiv({ cls: "ticktick-matrix-quadrant-actions" });
    const countBadge = actions.createSpan({ cls: "ticktick-matrix-count-badge" });
    countBadge.setText(String(tasks.length));

    const addBtn = actions.createEl("button", {
      cls: "ticktick-matrix-add-btn",
      attr: { "aria-label": `افزودن تسک به ${meta.shortName}`, title: `افزودن تسک به ${meta.shortName}` }
    });
    setIcon(addBtn, "plus");
    addBtn.addEventListener("click", e => {
      e.stopPropagation();
      void this.promptAddTask(qid, today);
    });

    // Task List Container
    const list = quad.createDiv({ cls: "ticktick-matrix-task-list" });

    // Drag-over handlers on quadrant
    quad.addEventListener("dragover", e => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = "move";
      }
      quad.addClass("is-drag-over");
    });

    quad.addEventListener("dragleave", e => {
      const rect = quad.getBoundingClientRect();
      if (
        e.clientX < rect.left ||
        e.clientX >= rect.right ||
        e.clientY < rect.top ||
        e.clientY >= rect.bottom
      ) {
        quad.removeClass("is-drag-over");
      }
    });

    quad.addEventListener("drop", async e => {
      e.preventDefault();
      quad.removeClass("is-drag-over");
      const taskId = e.dataTransfer?.getData("application/x-ticktick-task-id") || e.dataTransfer?.getData("text/plain");
      if (!taskId) return;
      await this.handleDropOnQuadrant(taskId, qid, today);
    });

    if (tasks.length === 0) {
      const empty = list.createDiv({ cls: "ticktick-matrix-empty" });
      empty.setText("تسکی در این بخش نیست");
      return;
    }

    for (const task of tasks) {
      this.renderTaskCard(list, task, qid, today);
    }
  }

  private renderTaskCard(
    list: HTMLElement,
    task: TickTickTask,
    qid: string,
    today: string
  ) {
    const card = list.createDiv({ cls: "ticktick-matrix-card" });
    card.dataset.taskId = String(task.id);
    card.dataset.quadrant = qid;
    card.setAttribute("draggable", "true");

    // Drag events
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

    // Bulk selection button
    const selectBtn = card.createEl("button", {
      cls: "ticktick-matrix-select-btn",
      attr: { "aria-label": "انتخاب تسک", title: "انتخاب چندتایی" }
    });
    selectBtn.addEventListener("click", e => {
      e.stopPropagation();
      bulkSelectionStore.toggle(String(task.id));
    });

    // Checkbox for completion
    const checkbox = card.createEl("input", {
      type: "checkbox",
      cls: "ticktick-matrix-checkbox",
      attr: { "aria-label": "تکمیل تسک" }
    });
    checkbox.checked = Number(task.status ?? 0) !== 0;
    checkbox.addEventListener("click", async e => {
      e.stopPropagation();
      checkbox.disabled = true;
      try {
        await this.host.complete(task);
        new Notice(`تسک «${cleanTaskTitle(task.title)}» تکمیل شد.`);
        await this.render();
      } catch (err) {
        new Notice(err instanceof Error ? err.message : "تکمیل تسک ناموفق بود.");
        checkbox.disabled = false;
      }
    });

    // Priority dot
    const prio = taskPriority(task.priority);
    const prioDot = card.createSpan({ cls: `ticktick-matrix-priority-dot ${prio.className}` });
    prioDot.setAttribute("title", `اولویت: ${prio.label}`);

    // Card Body
    const body = card.createDiv({ cls: "ticktick-matrix-card-body" });
    const titleEl = body.createDiv({ cls: "ticktick-matrix-card-title" });
    titleEl.setText(cleanTaskTitle(task.title));

    // Metadata pills
    const meta = body.createDiv({ cls: "ticktick-matrix-card-meta" });

    // Due date
    const dueDay = toDateKey(task.dueDate || task.startDate, task.timeZone || this.host.timeZone);
    if (dueDay) {
      const isOverdue = dueDay < today;
      const datePill = meta.createSpan({
        cls: `ticktick-matrix-meta-pill ${isOverdue ? "is-overdue" : ""}`
      });
      const calIcon = datePill.createSpan();
      setIcon(calIcon, "calendar");
      datePill.createSpan({ text: formatPersianDate(dueDay) });
      if (isOverdue) datePill.setAttribute("title", "معوقه");
    }

    // Project Name
    if (task.projectName) {
      const projPill = meta.createSpan({ cls: "ticktick-matrix-meta-pill is-project" });
      projPill.setText(task.projectName);
    }

    // First tag
    if (Array.isArray(task.tags) && task.tags.length > 0) {
      const tagPill = meta.createSpan({ cls: "ticktick-matrix-meta-pill is-tag" });
      tagPill.setText(`#${task.tags[0]}`);
    }

    // Estimate
    const est = task.timeEstimate ? formatTaskEstimate(task.timeEstimate) : null;
    if (est) {
      const estPill = meta.createSpan({ cls: "ticktick-matrix-meta-pill is-estimate" });
      estPill.setText(est);
    }

    // Click to open details
    card.addEventListener("click", e => {
      if (e.shiftKey || e.ctrlKey || e.metaKey) {
        bulkSelectionStore.toggle(String(task.id));
        return;
      }
      new TaskDetailsModal(this.host.app, task, {
        edit: this.host.edit,
        load: this.host.load,
        complete: async () => {
          await this.host.complete(task);
          await this.render();
        },
        changed: async () => {
          await this.render();
        }
      }).open();
    });
  }

  private async handleDropOnQuadrant(
    taskId: string,
    targetQuadrant: "q1" | "q2" | "q3" | "q4",
    today: string
  ) {
    if (this.isMutating) return;
    this.isMutating = true;

    try {
      const allTasks = this.host.tasks();
      const taskMap = new Map(allTasks.map(t => [String(t.id), t]));
      const draggedTask = taskMap.get(taskId);
      if (!draggedTask) return;

      const selected = bulkSelectionStore.getSelection();
      const isSelected = selected.includes(taskId);
      const targetTasks = (isSelected && selected.length > 1)
        ? selected.map(id => taskMap.get(id)).filter(Boolean) as TickTickTask[]
        : [draggedTask];

      for (const t of targetTasks) {
        const mutation = computeQuadrantDropMutation(t, targetQuadrant, today, this.host.timeZone);
        if (mutation) {
          await this.host.updateTask(mutation);
        }
      }

      const qMeta = QUADRANTS[targetQuadrant];
      if (targetTasks.length > 1) {
        new Notice(`${targetTasks.length} تسک به بخش «${qMeta.shortName}» منتقل شدند.`);
        bulkSelectionStore.clear();
      } else {
        new Notice(`تسک «${cleanTaskTitle(draggedTask.title)}» به «${qMeta.shortName}» منتقل شد.`);
      }

      await this.render();
    } catch (err) {
      new Notice(err instanceof Error ? err.message : "انتقال تسک ناموفق بود.");
    } finally {
      this.isMutating = false;
    }
  }

  private async promptAddTask(qid: "q1" | "q2" | "q3" | "q4", today: string) {
    if (!this.host.createTask) {
      new Notice("افزودن تسک در این محیط پشتیبانی نمی‌شود.");
      return;
    }

    let initial: Partial<TickTickTask> = {};
    switch (qid) {
      case "q1":
        initial = { priority: 5, dueDate: today };
        break;
      case "q2":
        initial = { priority: 5, dueDate: shiftCalendarDay(today, 3) };
        break;
      case "q3":
        initial = { priority: 1, dueDate: today };
        break;
      case "q4":
        initial = { priority: 0 };
        break;
    }

    try {
      await this.host.createTask(initial);
      await this.render();
    } catch (err) {
      new Notice(err instanceof Error ? err.message : "ایجاد تسک ناموفق بود.");
    }
  }

  private updateSelectionClasses() {
    const selected = new Set(bulkSelectionStore.getSelection());
    const cards = this.element.querySelectorAll<HTMLElement>(".ticktick-matrix-card");
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
