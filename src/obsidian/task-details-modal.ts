import { App, Component, MarkdownRenderer, Modal, Notice, setIcon } from "obsidian";
import { checklistSummary, normalizeChecklist } from "../core/checklist.js";
import { taskPriority } from "./task-priority";
import { mergeTaskDetails, taskDescription } from "../core/task-description.js";
import { formatPersianDate } from "../core/persian-date.js";
import { resolveTaskDependencies, formatTaskEstimate } from "../core/task-hierarchy.js";
import { cleanTaskTitle } from "./helpers";
import { confirmDelete } from "./modals/task-editor-modal";
import type { TickTickTask } from "./types";

function repeatSummary(flag: unknown) {
  const rule = String(flag ?? "").toUpperCase().replace(/^RRULE:/, "");
  if (!rule) return "";
  const fields = Object.fromEntries(rule.split(";").map(part => part.split("=", 2)).filter(([key, value]) => key && value));
  const labels: Record<string, string> = { MO: "دوشنبه", TU: "سه‌شنبه", WE: "چهارشنبه", TH: "پنجشنبه", FR: "جمعه", SA: "شنبه", SU: "یکشنبه" };
  const days = String(fields.BYDAY ?? "").split(",").map(day => labels[day.replace(/^[-+]?\d+/, "")]).filter(Boolean);
  if (days.length) return `🔁 تکرار: ${days.join("، ")}`;
  return ({ DAILY: "🔁 هر روز", WEEKLY: "🔁 هر هفته", MONTHLY: "🔁 هر ماه", YEARLY: "🔁 هر سال" } as Record<string, string>)[fields.FREQ] ?? "🔁 تکرارشونده";
}

/** Toggles the i-th markdown checkbox in text from [ ] to [x] or vice versa */
function toggleMarkdownCheckboxAtIndex(markdown: string, index: number): string {
  let count = 0;
  const regex = /^([ \t]*[-*+]\s+\[)([ xX])(\].*)$/gm;
  return markdown.replace(regex, (match, prefix, checkChar, suffix) => {
    if (count === index) {
      count++;
      const nextChar = checkChar.trim().toLowerCase() === "x" ? " " : "x";
      return `${prefix}${nextChar}${suffix}`;
    }
    count++;
    return match;
  });
}

export type TaskActions = {
  complete?: (task?: TickTickTask) => Promise<void>;
  edit?: (task: TickTickTask) => Promise<unknown>;
  load?: (task: TickTickTask) => Promise<TickTickTask | undefined>;
  changed?: () => Promise<void>;
  allTasks?: () => TickTickTask[];
  experimentalWritesEnabled?: boolean;
  updateTask?: (mutation: Partial<TickTickTask>) => Promise<any>;
  deleteTask?: (task: TickTickTask) => Promise<any>;
  createTask?: (draft: Partial<TickTickTask>) => Promise<any>;
};

export class TaskDetailsModal extends Modal {
  private markdownComponent = new Component();

  constructor(app: App, private task: TickTickTask, private actions: TaskActions = {}) {
    super(app);
  }

  onOpen() {
    this.modalEl.addClass("ticktick-task-details-modal");
    this.markdownComponent.load();
    this.render();
  }

  private async loadAndRender() {
    this.contentEl.empty();
    this.titleEl.setText("جزئیات تسک");
    if (this.actions.load) {
      this.contentEl.createDiv({ cls: "ticktick-task-details-loading", text: "در حال دریافت جزئیات کامل از TickTick…" });
      try {
        const fresh = await this.actions.load(this.task);
        if (fresh?.id) this.task = mergeTaskDetails(this.task, fresh) as TickTickTask;
      } catch {
        // The cached card remains useful if TickTick cannot be reached.
      }
    }
    this.render();
  }

  private render() {
    this.contentEl.empty();
    this.titleEl.empty();
    this.titleEl.style.display = "none";

    const isCompleted = Number(this.task.status ?? 0) !== 0;

    // 1. Header with interactive circular completion checkbox and title
    const headerRow = this.contentEl.createDiv({ cls: "ticktick-modal-header-row" });

    const completeBtn = headerRow.createEl("button", {
      cls: `ticktick-modal-complete-btn ${isCompleted ? "is-completed" : ""}`,
      attr: {
        type: "button",
        "aria-label": isCompleted ? "بازگشت به حالت انجام‌نشده" : "تکمیل تسک",
        title: isCompleted ? "تکمیل شده (کلیک برای لغو)" : "کلیک برای تکمیل تسک"
      }
    });

    if (isCompleted) {
      completeBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
    }

    completeBtn.addEventListener("click", async () => {
      try {
        if (this.actions.complete) {
          await this.actions.complete();
          this.task.status = isCompleted ? 0 : 2;
          this.render();
        } else if (this.actions.updateTask) {
          const nextStatus = isCompleted ? 0 : 2;
          await this.actions.updateTask({ id: this.task.id, projectId: this.task.projectId, status: nextStatus });
          this.task.status = nextStatus;
          new Notice(nextStatus === 2 ? "تسک تکمیل شد" : "تسک فعال شد");
          await this.actions.changed?.();
          this.render();
        }
      } catch (error) {
        new Notice(error instanceof Error ? error.message : "تغییر وضعیت تسک ناموفق بود.");
      }
    });

    const titleEl = headerRow.createDiv({
      cls: `ticktick-modal-task-title ${isCompleted ? "is-completed" : ""}`,
      text: String(this.task.title ?? "بدون عنوان")
    });

    // 2. Comprehensive Metadata Chips Row
    const metaWrap = this.contentEl.createDiv({ cls: "ticktick-task-details-meta" });
    const priority = taskPriority(this.task.priority);
    const estimate = formatTaskEstimate(this.task);

    // Project Chip
    if (this.task.projectName) {
      const projChip = metaWrap.createSpan({ cls: "ticktick-modal-meta-chip is-project" });
      const fIcon = projChip.createSpan({ cls: "ticktick-chip-icon mod-icon" });
      setIcon(fIcon, "folder");
      projChip.createSpan({ text: this.task.projectName });
    }

    // Due Date Chip
    if (this.task.dueDate) {
      const dateChip = metaWrap.createSpan({ cls: "ticktick-modal-meta-chip is-date" });
      const dIcon = dateChip.createSpan({ cls: "ticktick-chip-icon mod-icon" });
      setIcon(dIcon, "calendar");
      dateChip.createSpan({ text: `سررسید: ${formatPersianDate(this.task.dueDate, this.task.timeZone)}` });
    } else {
      const noDateChip = metaWrap.createSpan({ cls: "ticktick-modal-meta-chip is-date-empty" });
      const dIcon = noDateChip.createSpan({ cls: "ticktick-chip-icon mod-icon" });
      setIcon(dIcon, "calendar-off");
      noDateChip.createSpan({ text: "بدون تاریخ سررسید" });
    }

    // Start Date Chip (if distinct)
    if (this.task.startDate && this.task.startDate !== this.task.dueDate) {
      const startChip = metaWrap.createSpan({ cls: "ticktick-modal-meta-chip is-start-date" });
      const sIcon = startChip.createSpan({ cls: "ticktick-chip-icon mod-icon" });
      setIcon(sIcon, "play");
      startChip.createSpan({ text: `شروع: ${formatPersianDate(this.task.startDate, this.task.timeZone)}` });
    }

    // Priority Chip
    if (priority.value > 0) {
      const prioChip = metaWrap.createSpan({ cls: `ticktick-modal-meta-chip is-priority prio-${priority.value}` });
      prioChip.createSpan({ cls: `ticktick-task-priority-dot ${priority.className}` });
      prioChip.createSpan({ text: `اولویت: ${priority.label}` });
    }

    // Tags Chips
    if (this.task.tags && this.task.tags.length > 0) {
      for (const tag of this.task.tags) {
        const tagChip = metaWrap.createSpan({ cls: "ticktick-modal-meta-chip is-tag" });
        const tIcon = tagChip.createSpan({ cls: "ticktick-chip-icon mod-icon" });
        setIcon(tIcon, "tag");
        tagChip.createSpan({ text: `${tag}` });
      }
    }

    // Repeat Flag
    const repText = repeatSummary(this.task.repeatFlag);
    if (repText) {
      const repChip = metaWrap.createSpan({ cls: "ticktick-modal-meta-chip is-repeat" });
      repChip.createSpan({ text: repText });
    }

    // Estimate Chip
    if (estimate) {
      const estChip = metaWrap.createSpan({ cls: "ticktick-modal-meta-chip is-estimate" });
      estChip.createSpan({ text: `⏱ ${estimate}` });
    }

    // 3. Description & Interactive Checklist Section
    const description = taskDescription(this.task);
    if (description && description.trim()) {
      const descriptionBox = this.contentEl.createDiv({ cls: "ticktick-task-details-description" });
      const descHeader = descriptionBox.createDiv({ cls: "ticktick-section-header" });
      const dIcon = descHeader.createSpan({ cls: "mod-icon" });
      setIcon(dIcon, "file-text");
      descHeader.createEl("strong", { text: "توضیحات و چک‌لیست" });

      const descriptionContent = descriptionBox.createDiv({ cls: "markdown-rendered ticktick-rendered-desc" });
      void MarkdownRenderer.render(this.app, description, descriptionContent, "", this.markdownComponent).then(() => {
        // Make markdown checkboxes interactive
        const checkboxes = descriptionContent.querySelectorAll<HTMLInputElement>("input[type='checkbox']");
        checkboxes.forEach((cb, index) => {
          cb.disabled = false;
          cb.removeAttribute("disabled");
          cb.style.cursor = "pointer";
          cb.addEventListener("change", async (event) => {
            event.stopPropagation();
            const currentDesc = taskDescription(this.task);
            const updatedDesc = toggleMarkdownCheckboxAtIndex(currentDesc, index);
            this.task.desc = updatedDesc;
            this.task.content = updatedDesc;

            if (this.actions.updateTask) {
              try {
                await this.actions.updateTask({
                  id: this.task.id,
                  projectId: this.task.projectId,
                  desc: updatedDesc,
                  content: updatedDesc
                });
                new Notice("چک‌لیست تسک به‌روز شد");
                await this.actions.changed?.();
              } catch (err) {
                new Notice(err instanceof Error ? err.message : "خطا در به‌روزرسانی چک‌لیست");
              }
            }
          });
        });
      });
    }

    // Structured items checklist (TickTick native checklist items)
    const items = normalizeChecklist(this.task.items);
    if (items.length) {
      const box = this.contentEl.createDiv({ cls: "ticktick-task-details-checklist" });
      const summary = checklistSummary(items);
      const chHeader = box.createDiv({ cls: "ticktick-section-header" });
      const cIcon = chHeader.createSpan({ cls: "mod-icon" });
      setIcon(cIcon, "check-square");
      chHeader.createEl("strong", { text: `موارد چک‌لیست (${summary.completed}/${summary.total})` });

      const itemsList = box.createDiv({ cls: "ticktick-structured-checklist-list" });
      items.forEach((item, idx) => {
        const itemRow = itemsList.createDiv({ cls: `ticktick-checklist-item-row ${item.completed ? "is-done" : ""}` });
        const itemCheck = itemRow.createEl("input", {
          type: "checkbox",
          cls: "ticktick-checklist-item-checkbox",
          attr: { "aria-label": item.title }
        });
        itemCheck.checked = Boolean(item.completed);
        itemCheck.addEventListener("change", async (event) => {
          event.stopPropagation();
          const targetStatus = itemCheck.checked ? 1 : 0;
          if (Array.isArray(this.task.items) && this.task.items[idx]) {
            this.task.items[idx].status = targetStatus;
            if (this.actions.updateTask) {
              try {
                await this.actions.updateTask({
                  id: this.task.id,
                  projectId: this.task.projectId,
                  items: this.task.items
                });
                new Notice("مورد چک‌لیست به‌روز شد");
                await this.actions.changed?.();
                this.render();
              } catch (err) {
                new Notice(err instanceof Error ? err.message : "خطا در ذخیره چک‌لیست");
              }
            }
          }
        });
        itemRow.createSpan({ cls: "ticktick-checklist-item-text", text: item.title });
      });
    }

    // Dependencies (blockedBy / blocks)
    const allTasks = this.actions.allTasks ? this.actions.allTasks() : [];
    const deps = resolveTaskDependencies(this.task, allTasks);
    if (deps.blockedBy.length > 0 || deps.blocks.length > 0) {
      const depBox = this.contentEl.createDiv({ cls: "ticktick-task-details-deps" });
      const depHeader = depBox.createDiv({ cls: "ticktick-section-header" });
      const depIcon = depHeader.createSpan({ cls: "mod-icon" });
      setIcon(depIcon, "git-branch");
      depHeader.createEl("strong", { text: "وابستگی‌ها و پیش‌نیازها" });

      if (deps.isBlocked) {
        depBox.createDiv({ cls: "ticktick-task-blocked-alert", text: "⛔ این تسک به دلیل تکمیل نشدن پیش‌نیازها مسدود است." });
      }
      for (const b of deps.blockedBy) {
        depBox.createDiv({
          cls: `ticktick-task-dep-item ${b.completed ? "is-done" : "is-pending"}`,
          text: `${b.completed ? "✅" : "⏳"} وابسته به: ${b.title}`
        });
      }
      for (const b of deps.blocks) {
        depBox.createDiv({
          cls: "ticktick-task-dep-item is-blocks",
          text: `↳ پیش‌نیاز برای: ${b.title}`
        });
      }
    }

    // 4. Subtasks Section (زیرتسک‌ها)
    const allTasksList = this.actions.allTasks ? this.actions.allTasks() : [];
    const currentTaskId = String(this.task.id);
    const existingSubtasks = allTasksList.filter(t => String(t.parentId) === currentTaskId);

    if (existingSubtasks.length > 0 || this.actions.createTask) {
      const subtasksSection = this.contentEl.createDiv({ cls: "ticktick-editor-subtasks-section ticktick-details-subtasks" });
      const subHeader = subtasksSection.createDiv({ cls: "ticktick-editor-subtasks-header" });
      subHeader.createSpan({ text: `📑 زیرتسک‌ها (${existingSubtasks.length})`, cls: "ticktick-subtasks-title" });

      const subtasksList = subtasksSection.createDiv({ cls: "ticktick-editor-subtasks-list" });

      const renderDetailsSubtaskItem = (st: TickTickTask) => {
        const itemRow = subtasksList.createDiv({ cls: "ticktick-editor-subtask-item" });
        let isDone = Number(st.status ?? 0) !== 0;

        // Checkbox
        const cb = itemRow.createEl("input", {
          type: "checkbox",
          cls: "ticktick-subtask-checkbox",
          attr: { title: isDone ? "علامت‌گذاری به عنوان انجام نشده" : "علامت‌گذاری به عنوان تکمیل شده" }
        });
        cb.checked = isDone;

        const titleSpan = itemRow.createSpan({
          text: cleanTaskTitle(st.title) || "بدون عنوان",
          cls: `ticktick-subtask-title-text${isDone ? " is-completed" : ""}`
        });

        cb.addEventListener("change", async (e) => {
          e.stopPropagation();
          const targetState = cb.checked;
          cb.disabled = true;
          try {
            const nextStatus = targetState ? 2 : 0;
            if (this.actions.updateTask) {
              await this.actions.updateTask({ id: st.id, projectId: st.projectId, status: nextStatus });
            } else if (this.actions.complete && targetState) {
              await this.actions.complete(st);
            }
            st.status = nextStatus;
            isDone = targetState;
            titleSpan.toggleClass("is-completed", isDone);
            cb.title = isDone ? "علامت‌گذاری به عنوان انجام نشده" : "علامت‌گذاری به عنوان تکمیل شده";
            new Notice(targetState ? "زیرتسک تکمیل شد" : "زیرتسک فعال شد");
            await this.actions.changed?.();
          } catch (err) {
            cb.checked = !targetState;
            new Notice(err instanceof Error ? err.message : "تغییر وضعیت زیرتسک ناموفق بود.");
          } finally {
            cb.disabled = false;
          }
        });

        // Subtask Actions (Edit & Delete)
        const actionsDiv = itemRow.createDiv({ cls: "ticktick-subtask-actions" });

        // Edit button: Opens the full TaskEditorModal for this subtask!
        if (this.actions.edit) {
          const editBtn = actionsDiv.createEl("button", {
            cls: "ticktick-subtask-action-btn mod-edit",
            attr: { type: "button", title: "ویرایش کامل زیرتسک" }
          });
          setIcon(editBtn, "pencil");

          editBtn.addEventListener("click", async (e) => {
            e.preventDefault();
            e.stopPropagation();
            try {
              await this.actions.edit!(st);
              await this.actions.changed?.();
              this.render();
            } catch (err) {
              new Notice(err instanceof Error ? err.message : "ویرایش زیرتسک ناموفق بود.");
            }
          });
        }

        // Delete button
        if (this.actions.deleteTask || this.actions.updateTask) {
          const delBtn = actionsDiv.createEl("button", {
            cls: "ticktick-subtask-action-btn mod-delete",
            attr: { type: "button", title: "حذف زیرتسک" }
          });
          setIcon(delBtn, "trash-2");

          delBtn.addEventListener("click", async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const confirmed = await confirmDelete(this.app, String(st.title || "زیرتسک"));
            if (!confirmed) return;

            delBtn.disabled = true;
            try {
              if (this.actions.deleteTask) {
                await this.actions.deleteTask(st);
              } else if (this.actions.updateTask) {
                await this.actions.updateTask({ id: st.id, status: -1 });
              }
              itemRow.remove();
              new Notice(`زیرتسک «${st.title}» حذف شد.`);
              await this.actions.changed?.();
              const count = subtasksList.querySelectorAll(".ticktick-editor-subtask-item").length;
              if (count === 0) {
                subtasksList.createSpan({ cls: "ticktick-no-tags-hint", text: "بدون زیرتسک" });
              }
              subHeader.querySelector(".ticktick-subtasks-title")?.setText(`📑 زیرتسک‌ها (${count})`);
            } catch (err) {
              new Notice(err instanceof Error ? err.message : "حذف زیرتسک ناموفق بود.");
              delBtn.disabled = false;
            }
          });
        }
      };

      if (existingSubtasks.length === 0) {
        subtasksList.createSpan({ cls: "ticktick-no-tags-hint", text: "بدون زیرتسک" });
      } else {
        for (const st of existingSubtasks) {
          renderDetailsSubtaskItem(st);
        }
      }

      // Add subtask row if createTask is available
      if (this.actions.createTask) {
        const addSubRow = subtasksSection.createDiv({ cls: "ticktick-add-subtask-row" });
        const subInput = addSubRow.createEl("input", {
          type: "text",
          cls: "ticktick-subtask-input",
          placeholder: "عنوان زیرتسک جدید... (Enter برای افزودن)"
        });
        subInput.dir = "rtl";

        const addSubBtn = addSubRow.createEl("button", {
          type: "button",
          cls: "ticktick-subtask-add-btn",
          text: "+ افزودن زیرتسک"
        });

        const handleCreate = async () => {
          const title = subInput.value.trim();
          if (!title) return;
          addSubBtn.disabled = true;
          try {
            const res = await this.actions.createTask!({
              title,
              parentId: currentTaskId,
              projectId: this.task.projectId
            });
            new Notice(`زیرتسک «${title}» اضافه شد.`);
            subInput.value = "";
            const hint = subtasksList.querySelector(".ticktick-no-tags-hint");
            if (hint) hint.remove();
            const newSt: TickTickTask = res && typeof res === "object" && res.id ? res : {
              id: `temp-${Date.now()}`,
              title,
              parentId: currentTaskId,
              projectId: this.task.projectId,
              status: 0
            } as any;
            renderDetailsSubtaskItem(newSt);
            await this.actions.changed?.();
            const count = subtasksList.querySelectorAll(".ticktick-editor-subtask-item").length;
            subHeader.querySelector(".ticktick-subtasks-title")?.setText(`📑 زیرتسک‌ها (${count})`);
          } catch (err) {
            new Notice(err instanceof Error ? err.message : "ایجاد زیرتسک ناموفق بود.");
          } finally {
            addSubBtn.disabled = false;
          }
        };

        addSubBtn.addEventListener("click", (e) => {
          e.preventDefault();
          void handleCreate();
        });
        subInput.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void handleCreate();
          }
        });
      }
    }

    // 4. Sleek Modern Action Buttons Footer
    const actions = this.contentEl.createDiv({ cls: "ticktick-task-details-actions" });

    if (this.actions.edit) {
      const editBtn = actions.createEl("button", { cls: "ticktick-modal-btn mod-edit" });
      const pIcon = editBtn.createSpan({ cls: "mod-icon" });
      setIcon(pIcon, "pencil");
      editBtn.createSpan({ text: "ویرایش تسک" });
      editBtn.addEventListener("click", async () => {
        try {
          await this.actions.edit?.(this.task);
          await this.actions.changed?.();
          this.close();
        } catch (error) {
          new Notice(error instanceof Error ? error.message : "ویرایش تسک ناموفق بود.");
        }
      });
    }

    if (this.actions.load) {
      const refreshBtn = actions.createEl("button", { cls: "ticktick-modal-btn mod-refresh" });
      const rIcon = refreshBtn.createSpan({ cls: "mod-icon" });
      setIcon(rIcon, "refresh-cw");
      refreshBtn.createSpan({ text: "همگام‌سازی و بروزرسانی" });
      refreshBtn.addEventListener("click", () => void this.loadAndRender());
    }
  }

  onClose() {
    this.markdownComponent.unload();
    this.contentEl.empty();
  }
}
