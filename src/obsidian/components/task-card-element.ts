import { setIcon } from "obsidian";
import { taskPriority } from "../task-priority";
import { taskDescription } from "../../core/task-description.js";
import { formatPersianDate } from "../../core/persian-date.js";
import { formatTaskEstimate } from "../../core/task-hierarchy.js";
import { toDateKey, todayInZone } from "../../core/date.js";
import { cleanTaskTitle } from "../helpers";
import { bulkSelectionStore } from "../selection-store";
import type { TickTickTask } from "../types";

export interface TaskCardOptions {
  task: TickTickTask;
  timeZone: string;
  projectColor?: string;
  projectName?: string;
  movable?: boolean;
  dragType?: string;
  isBound?: boolean;
  onComplete?: (task: TickTickTask) => Promise<void> | void;
  onOpenDetails?: (task: TickTickTask) => void;
  onStartPomodoro?: (task: TickTickTask) => void;
  onSchedule?: (task: TickTickTask, mouseEvent: MouseEvent) => void;
  onContextMenu?: (task: TickTickTask, mouseEvent: MouseEvent) => void;
  isBulkSelected?: boolean;
  onToggleBulkSelect?: (taskId: string) => void;
  showProjectPill?: boolean;
  showEstimate?: boolean;
  variant?: "board" | "matrix" | "agenda" | "list" | "compact";
  subtasks?: TickTickTask[];
  onCompleteSubtask?: (subtask: TickTickTask) => Promise<void> | void;
  onOpenSubtaskDetails?: (subtask: TickTickTask) => void;
  onAddSubtask?: (task: TickTickTask) => void;
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

function renderDueDateChip(container: HTMLElement, task: TickTickTask, timeZone: string, isCompleted: boolean): HTMLElement | null {
  const today = todayInZone(timeZone);
  const dueDay = toDateKey(task.dueDate || task.startDate, task.timeZone || timeZone);
  if (!dueDay) return null;

  const isOverdue = dueDay < today && !isCompleted;
  const isToday = dueDay === today;
  const isTomorrow = dueDay === toDateKey(new Date(Date.now() + 86400000), timeZone);

  let dueBadgeClass = "tb-badge-slate";
  let dueText = formatPersianDate(dueDay);

  if (isOverdue) {
    dueBadgeClass = "tb-badge-coral";
    dueText = `معوقه: ${dueText}`;
  } else if (isToday) {
    dueBadgeClass = "tb-badge-mint";
    dueText = "امروز";
  } else if (isTomorrow) {
    dueBadgeClass = "tb-badge-cobalt";
    dueText = "فردا";
  }

  const timeStr = formatTaskTime(task, timeZone);
  if (timeStr) {
    dueText = `${dueText} ${timeStr}`;
  }

  const dueChip = container.createSpan({ cls: `tb-badge ${dueBadgeClass}` });
  const calIcon = dueChip.createSpan({ cls: "tb-chip-icon" });
  setIcon(calIcon, timeStr ? "clock" : "calendar");
  dueChip.createSpan({ text: dueText });
  return dueChip;
}

export function renderTaskCard(parent: HTMLElement, options: TaskCardOptions): HTMLElement {
  const {
    task,
    timeZone,
    projectColor,
    projectName,
    movable = true,
    dragType = "text/ticktick-task",
    onComplete,
    onOpenDetails,
    onStartPomodoro,
    onSchedule,
    onContextMenu,
    isBulkSelected = false,
    onToggleBulkSelect,
    showProjectPill = true,
    variant = "board",
    isBound = false,
    subtasks = [],
    onCompleteSubtask,
    onOpenSubtaskDetails,
    onAddSubtask
  } = options;

  const isCompleted = Number(task.status ?? 0) !== 0;
  const isNote = String(task.kind ?? task.type ?? task.taskType ?? "").toUpperCase() === "NOTE";
  const isPinned = Boolean(task.pinned ?? task.isPinned ?? task.pin ?? task.pinnedTime ?? task.pinnedAt ?? task.pinTime);
  const priority = taskPriority(task.priority);
  const prioNum = Number(task.priority ?? 0);

  // Palette Playground tone class mapping
  let toneClass = "tb-tone-slate";
  if (isNote) {
    toneClass = "tb-tone-orchid";
  } else if (prioNum === 5) {
    toneClass = "tb-tone-coral";
  } else if (prioNum === 3) {
    toneClass = "tb-tone-amber";
  } else if (prioNum === 1) {
    toneClass = "tb-tone-cobalt";
  }

  const selectedInStore = isBulkSelected || bulkSelectionStore.isSelected(String(task.id));

  const card = parent.createDiv({
    cls: `tb-task-card ticktick-project-card ${toneClass} priority-${priority.value} ${isCompleted ? "is-completed" : ""} ${isNote ? "is-note" : ""} ${selectedInStore ? "is-bulk-selected" : ""} mod-${variant}`,
    attr: {
      role: "button",
      tabindex: "0",
      "data-task-id": String(task.id),
      "aria-label": `${cleanTaskTitle(task.title)}, ${priority.label}`,
      title: "برای مشاهده جزئیات کلیک کنید"
    }
  });

  if (projectColor) {
    card.style.setProperty("--ticktick-task-tone", projectColor);
  }

  // ── Drag & Drop ──
  if (movable) {
    card.setAttribute("draggable", "true");
    card.addEventListener("dragstart", (e) => {
      card.addClass("is-dragging");
      e.dataTransfer?.setData(dragType, String(task.id));
      e.dataTransfer?.setData("text/ticktick-task", String(task.id));
      e.dataTransfer!.effectAllowed = "move";
    });
    card.addEventListener("dragend", () => {
      card.removeClass("is-dragging");
    });
  }

  // ── Card Header Row ──
  const headerRow = card.createDiv({ cls: "tb-card-header-row" });

  const hasSubtasks = Boolean(subtasks && subtasks.length > 0);
  let subtasksContainer: HTMLElement | null = null;
  let isSubtasksExpanded = true;
  let chevIcon: HTMLElement | null = null;

  if (hasSubtasks) {
    const expandBtn = headerRow.createEl("button", {
      cls: "tb-card-expand-btn",
      attr: {
        type: "button",
        "aria-label": "تغییر وضعیت نمایش زیرتسک‌ها",
        title: "نمایش یا بستن زیرتسک‌ها"
      }
    });
    chevIcon = expandBtn.createSpan({ cls: "tb-expand-icon" });
    setIcon(chevIcon, "chevron-down");
    expandBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      isSubtasksExpanded = !isSubtasksExpanded;
      if (chevIcon) {
        setIcon(chevIcon, isSubtasksExpanded ? "chevron-down" : "chevron-left");
      }
      if (subtasksContainer) {
        subtasksContainer.style.display = isSubtasksExpanded ? "flex" : "none";
      }
      card.toggleClass("is-subtasks-collapsed", !isSubtasksExpanded);
    });
  }

  // 1. Tactile Checkbox / Note Icon
  if (isNote) {
    const noteIcon = headerRow.createSpan({ cls: "tb-card-note-icon", attr: { title: "یادداشت TickTick" } });
    setIcon(noteIcon, "file-text");
  } else {
    const checkEl = headerRow.createDiv({
      cls: `tb-checkbox tb-card-checkbox ${isCompleted ? "is-checked" : ""}`,
      attr: {
        role: "checkbox",
        "aria-checked": isCompleted ? "true" : "false",
        "aria-label": `تکمیل ${cleanTaskTitle(task.title)}`,
        tabindex: "0"
      }
    });

    const svg = checkEl.createSvg("svg", {
      attr: { viewBox: "0 0 16 16", fill: "none", stroke: "currentColor" }
    });
    svg.createSvg("path", {
      attr: {
        d: "M3.5 8.5L6.5 11.5L12.5 4.5",
        "stroke-linecap": "round",
        "stroke-linejoin": "round"
      }
    });

    checkEl.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (checkEl.hasClass("is-busy")) return;
      checkEl.addClass("is-busy");
      checkEl.addClass("is-checked");

      try {
        if (onComplete) {
          await onComplete(task);
        }
      } catch {
        checkEl.removeClass("is-checked");
        checkEl.removeClass("is-busy");
      }
    });

    checkEl.addEventListener("keydown", (e) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        checkEl.click();
      }
    });
  }

  // 2. Title Element
  const titleEl = headerRow.createDiv({
    cls: "tb-card-title",
    text: cleanTaskTitle(task.title) || "بدون عنوان"
  });

  titleEl.addEventListener("click", (e) => {
    e.stopPropagation();
    if (onOpenDetails) onOpenDetails(task);
  });

  // 3. Priority & Pin Badges
  if (isPinned) {
    const pin = headerRow.createSpan({ cls: "tb-card-pin-icon", attr: { title: "پین‌شده" } });
    setIcon(pin, "pin");
  }

  if (prioNum > 0) {
    let prioBadgeClass = "tb-badge-slate";
    if (prioNum === 5) prioBadgeClass = "tb-badge-coral";
    else if (prioNum === 3) prioBadgeClass = "tb-badge-amber";
    else if (prioNum === 1) prioBadgeClass = "tb-badge-cobalt";

    headerRow.createSpan({
      cls: `tb-badge ${prioBadgeClass} tb-card-priority-badge is-${priority.value}`,
      text: priority.label,
      attr: { title: `اولویت: ${priority.label}` }
    });
  }

  // ── Nested Subtasks List (TickTick native app style) ──
  if (hasSubtasks) {
    subtasksContainer = card.createDiv({ cls: "tb-card-subtasks-container" });
    for (const child of subtasks) {
      const childDone = Number(child.status ?? 0) !== 0;
      const childPrio = taskPriority(child.priority);
      const childPrioNum = Number(child.priority ?? 0);

      const subRow = subtasksContainer.createDiv({
        cls: `tb-card-subtask-row ${childDone ? "is-completed" : ""}`,
        attr: {
          "data-task-id": String(child.id),
          role: "button",
          tabindex: "0",
          title: "مشاهده و ویرایش جزئیات زیرتسک (یا درگ برای جابه‌جایی)"
        }
      });

      if (movable) {
        subRow.setAttribute("draggable", "true");
        subRow.addEventListener("dragstart", (e) => {
          subRow.addClass("is-dragging");
          e.dataTransfer?.setData(dragType, String(child.id));
          e.dataTransfer?.setData("text/ticktick-board-task", String(child.id));
          e.dataTransfer?.setData("text/ticktick-task", String(child.id));
          e.dataTransfer?.setData("text/task-parent-id", String(task.id));
          e.dataTransfer!.effectAllowed = "move";
        });
        subRow.addEventListener("dragend", () => {
          subRow.removeClass("is-dragging");
        });
      }

      // 1. Top row: Checkbox, Title, and Priority
      const subTop = subRow.createDiv({ cls: "tb-card-subtask-top" });

      const subCheck = subTop.createDiv({
        cls: `tb-checkbox tb-card-checkbox tb-card-subtask-check ${childDone ? "is-checked" : ""}`,
        attr: {
          role: "checkbox",
          "aria-checked": childDone ? "true" : "false",
          "aria-label": `تکمیل ${cleanTaskTitle(child.title)}`,
          tabindex: "0"
        }
      });

      const svg = subCheck.createSvg("svg", {
        attr: { viewBox: "0 0 16 16", fill: "none", stroke: "currentColor" }
      });
      svg.createSvg("path", {
        attr: {
          d: "M3.5 8.5L6.5 11.5L12.5 4.5",
          "stroke-linecap": "round",
          "stroke-linejoin": "round"
        }
      });

      subCheck.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (subCheck.hasClass("is-busy")) return;
        subCheck.addClass("is-busy");
        const nextDone = !subCheck.hasClass("is-checked");
        subCheck.toggleClass("is-checked", nextDone);
        subRow.toggleClass("is-completed", nextDone);

        try {
          if (onCompleteSubtask) {
            await onCompleteSubtask(child);
          }
        } catch {
          subCheck.toggleClass("is-checked", !nextDone);
          subRow.toggleClass("is-completed", !nextDone);
        } finally {
          subCheck.removeClass("is-busy");
        }
      });

      subCheck.addEventListener("keydown", (e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          subCheck.click();
        }
      });

      const subHeaderContent = subTop.createDiv({ cls: "tb-card-subtask-header-content" });

      subHeaderContent.createSpan({
        cls: "tb-card-subtask-title",
        text: cleanTaskTitle(child.title) || "بدون عنوان"
      });

      if (childPrioNum > 0) {
        let childPrioClass = "tb-badge-slate";
        if (childPrioNum === 5) childPrioClass = "tb-badge-coral";
        else if (childPrioNum === 3) childPrioClass = "tb-badge-amber";
        else if (childPrioNum === 1) childPrioClass = "tb-badge-cobalt";

        subHeaderContent.createSpan({
          cls: `tb-badge ${childPrioClass} tb-card-priority-badge is-${childPrio.value}`,
          text: childPrio.label,
          attr: { title: `اولویت: ${childPrio.label}` }
        });
      }

      // 2. Description snippet if any
      const childDesc = taskDescription(child);
      if (childDesc) {
        subRow.createDiv({
          cls: "tb-card-subtask-desc",
          text: childDesc.slice(0, 90)
        });
      }

      // 3. Metadata Chips row: due date/time, tags, checklist, etc.
      const childChipsRow = subRow.createDiv({ cls: "tb-card-subtask-chips" });

      // Due date & time chip
      renderDueDateChip(childChipsRow, child, timeZone, childDone);

      // Tags chips
      const childTags = child.tags ?? [];
      for (const tag of childTags) {
        childChipsRow.createSpan({
          cls: "tb-badge tb-badge-slate is-tag",
          text: `#${tag}`
        });
      }

      // Checklist items progress chip if any
      const childChecklist = (child as { items?: Array<{ status?: number }> }).items;
      if (Array.isArray(childChecklist) && childChecklist.length > 0) {
        const totalItems = childChecklist.length;
        const completedItems = childChecklist.filter((i) => Number(i.status ?? 0) !== 0).length;
        const isAllDone = completedItems === totalItems;
        const chkChip = childChipsRow.createSpan({
          cls: `tb-badge tb-chip mod-checklist ${isAllDone ? "tb-badge-mint is-all-done" : "tb-badge-slate"}`,
          attr: { title: `چک‌لیست: ${completedItems} از ${totalItems} تکمیل شده` }
        });
        const chkIcon = chkChip.createSpan({ cls: "tb-chip-icon" });
        setIcon(chkIcon, isAllDone ? "check-check" : "list-checks");
        chkChip.createSpan({ text: `${completedItems}/${totalItems}` });
      }

      // Estimate / Pomodoro
      const childEst = formatTaskEstimate(child);
      if (childEst) {
        const estChip = childChipsRow.createSpan({ cls: "tb-badge tb-badge-cyan" });
        estChip.createSpan({ text: childEst });
      }

      // Repeat badge
      if (child.repeatFlag) {
        const repChip = childChipsRow.createSpan({ cls: "tb-badge tb-badge-slate" });
        const repIcon = repChip.createSpan({ cls: "tb-chip-icon" });
        setIcon(repIcon, "repeat");
        repChip.createSpan({ text: "تکرار" });
      }

      if (!childChipsRow.children.length) {
        childChipsRow.remove();
      }

      subRow.addEventListener("click", (e) => {
        e.stopPropagation();
        if (onOpenSubtaskDetails) onOpenSubtaskDetails(child);
      });
      subRow.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          if ((e.target as HTMLElement).closest(".tb-card-subtask-check")) return;
          e.preventDefault();
          if (onOpenSubtaskDetails) onOpenSubtaskDetails(child);
        }
      });
    }
  }

  // ── Description / Snippet ──
  const description = taskDescription(task);
  if (description) {
    card.createDiv({
      cls: "tb-card-desc",
      text: description.slice(0, 110)
    });
  }

  // ── Metadata Chips Row ──
  const chipsRow = card.createDiv({ cls: "tb-card-chips" });

  // Due Date Chip (with time when timed)
  renderDueDateChip(chipsRow, task, timeZone, isCompleted);

  // Project Pill
  const projDisplay = projectName || task.projectName;
  if (showProjectPill && projDisplay) {
    const projChip = chipsRow.createSpan({ cls: "tb-badge tb-badge-slate is-project" });
    if (projectColor) {
      const dot = projChip.createSpan({ cls: "tb-project-dot" });
      dot.style.backgroundColor = projectColor;
    }
    projChip.createSpan({ text: projDisplay });
  }

  // Subtask Indicator (for standalone/orphaned subtasks)
  if (task.parentId) {
    const subChip = chipsRow.createSpan({ cls: "tb-badge tb-badge-slate" });
    subChip.createSpan({ text: "↳ زیرتسک" });
  }

  // Subtasks Progress Chip (for parent tasks with nested subtasks)
  if (hasSubtasks) {
    const totalSubs = subtasks.length;
    const completedSubs = subtasks.filter(s => Number(s.status ?? 0) !== 0).length;
    const subChip = chipsRow.createSpan({
      cls: `tb-badge tb-chip mod-checklist ${completedSubs === totalSubs ? "tb-badge-mint is-all-done" : "tb-badge-slate"}`,
      attr: { title: `زیرتسک‌ها: ${completedSubs} از ${totalSubs} تکمیل شده` }
    });
    const sIcon = subChip.createSpan({ cls: "tb-chip-icon" });
    setIcon(sIcon, completedSubs === totalSubs ? "check-check" : "list-tree");
    subChip.createSpan({ text: `${completedSubs}/${totalSubs} زیرتسک` });
  }

  // Checklist Progress Chip (TaskFlow inspiration)
  const checklistItems = (task as { items?: Array<{ status?: number }> }).items;
  if (Array.isArray(checklistItems) && checklistItems.length > 0) {
    const totalItems = checklistItems.length;
    const completedItems = checklistItems.filter((i) => Number(i.status ?? 0) !== 0).length;
    const isAllDone = completedItems === totalItems;
    const chkChip = chipsRow.createSpan({
      cls: `tb-badge tb-chip mod-checklist ${isAllDone ? "tb-badge-mint is-all-done" : "tb-badge-slate"}`,
      attr: { title: `چک‌لیست: ${completedItems} از ${totalItems} تکمیل شده` }
    });
    const chkIcon = chkChip.createSpan({ cls: "tb-chip-icon" });
    setIcon(chkIcon, isAllDone ? "check-check" : "list-checks");
    chkChip.createSpan({ text: `${completedItems}/${totalItems}` });
  }

  // Estimate / Pomodoro Badge
  const estText = formatTaskEstimate(task);
  if (estText) {
    const estChip = chipsRow.createSpan({ cls: "tb-badge tb-badge-cyan" });
    estChip.createSpan({ text: estText });
  }

  // Repeat Badge
  if (task.repeatFlag) {
    const repChip = chipsRow.createSpan({ cls: "tb-badge tb-badge-slate" });
    const repIcon = repChip.createSpan({ cls: "tb-chip-icon" });
    setIcon(repIcon, "repeat");
    repChip.createSpan({ text: "تکرار" });
  }

  // Blocked / Dependency Badge
  if (Array.isArray(task.blockedBy) && task.blockedBy.length > 0) {
    const depChip = chipsRow.createSpan({ cls: "tb-badge tb-badge-coral" });
    depChip.createSpan({ text: "⛔ وابسته" });
  }

  // Tags
  const tags = task.tags ?? [];
  for (const tag of tags.slice(0, 3)) {
    chipsRow.createSpan({
      cls: "tb-badge tb-badge-slate is-tag",
      text: `#${tag}`
    });
  }

  // Markdown Sync Binding
  if (isBound) {
    const mdChip = chipsRow.createSpan({ cls: "tb-badge tb-badge-slate is-bound" });
    const mdIcon = mdChip.createSpan({ cls: "tb-chip-icon" });
    setIcon(mdIcon, "file-text");
    mdChip.createSpan({ text: "Markdown" });
  }

  // ── Hover Action Bar (Zero-Layout Shift) ──
  const hoverActions = card.createDiv({ cls: "tb-card-hover-actions" });

  if (onStartPomodoro && !isCompleted) {
    const pomoBtn = hoverActions.createEl("button", {
      cls: "tb-btn-icon tb-card-action-btn",
      attr: { type: "button", "aria-label": "شروع فوکوس پومودورو", title: "شروع تمرکز پومودورو" }
    });
    setIcon(pomoBtn, "timer");
    pomoBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      onStartPomodoro(task);
    });
  }

  if (onSchedule) {
    const schedBtn = hoverActions.createEl("button", {
      cls: "tb-btn-icon tb-card-action-btn",
      attr: { type: "button", "aria-label": "زمان‌بندی سریع", title: "زمان‌بندی سریع" }
    });
    setIcon(schedBtn, "calendar-plus");
    schedBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      onSchedule(task, e);
    });
  }

  if (onOpenDetails) {
    const editBtn = hoverActions.createEl("button", {
      cls: "tb-btn-icon tb-card-action-btn",
      attr: { type: "button", "aria-label": "ویرایش جزئیات", title: "ویرایش جزئیات" }
    });
    setIcon(editBtn, "pencil");
    editBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      onOpenDetails(task);
    });
  }

  if (onAddSubtask && !isCompleted) {
    const addSubBtn = hoverActions.createEl("button", {
      cls: "tb-btn-icon tb-card-action-btn",
      attr: { type: "button", "aria-label": "افزودن زیرتسک", title: "افزودن زیرتسک به این تسک" }
    });
    setIcon(addSubBtn, "list-plus");
    addSubBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      onAddSubtask(task);
    });
  }

  if (onContextMenu) {
    const moreBtn = hoverActions.createEl("button", {
      cls: "tb-btn-icon tb-card-action-btn",
      attr: { type: "button", "aria-label": "گزینه‌های بیشتر", title: "گزینه‌های بیشتر" }
    });
    setIcon(moreBtn, "more-horizontal");
    moreBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      onContextMenu(task, e);
    });
  }

  // ── Click Handlers for Card (Details & Bulk Selection) ──
  card.addEventListener("click", (e) => {
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      e.preventDefault();
      e.stopPropagation();
      if (onToggleBulkSelect) {
        onToggleBulkSelect(String(task.id));
      } else {
        bulkSelectionStore.toggle(String(task.id));
      }
      card.toggleClass("is-bulk-selected", bulkSelectionStore.isSelected(String(task.id)));
      return;
    }

    if (onOpenDetails) {
      onOpenDetails(task);
    }
  });

  card.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (onOpenDetails) onOpenDetails(task);
    }
  });

  return card;
}
