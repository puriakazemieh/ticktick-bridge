import { App, Component, MarkdownRenderer, Modal, Notice } from "obsidian";
import { checklistSummary, normalizeChecklist } from "../core/checklist.js";
import { taskPriority } from "./task-priority";
import { mergeTaskDetails, taskDescription } from "../core/task-description.js";
import { formatPersianDate } from "../core/persian-date.js";
import { buildTaskHierarchy, calculateHierarchyProgress, resolveTaskDependencies, formatTaskEstimate } from "../core/task-hierarchy.js";
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

export type TaskActions = {
  complete?: () => Promise<void>;
  edit?: (task: TickTickTask) => Promise<unknown>;
  load?: (task: TickTickTask) => Promise<TickTickTask | undefined>;
  changed?: () => Promise<void>;
  allTasks?: () => TickTickTask[];
  experimentalWritesEnabled?: boolean;
};

export class TaskDetailsModal extends Modal {
  private markdownComponent = new Component();
  constructor(app: App, private task: TickTickTask, private actions: TaskActions = {}) { super(app); }
  onOpen() {
    this.modalEl.addClass("ticktick-task-details-modal");
    this.markdownComponent.load();
    // Opening a card is always local and instantaneous. Network reads are an
    // explicit user action, never a hidden click-time request.
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
    this.titleEl.setText(String(this.task.title ?? "بدون عنوان"));
    const meta = this.contentEl.createDiv({ cls: "ticktick-task-details-meta" });
    const priority = taskPriority(this.task.priority);
    const estimate = formatTaskEstimate(this.task);
    for (const value of [this.task.projectName, this.task.dueDate ? `📅 ${formatPersianDate(this.task.dueDate, this.task.timeZone)}` : "بدون تاریخ", `${priority.icon} اولویت ${priority.label}`, repeatSummary(this.task.repeatFlag), estimate]) if (value) meta.createSpan({ text: String(value) });
    const description = taskDescription(this.task);
    const descriptionBox = this.contentEl.createDiv({ cls: "ticktick-task-details-description" });
    descriptionBox.createEl("strong", { text: "توضیحات" });
    const descriptionContent = descriptionBox.createDiv({ cls: "markdown-rendered" });
    if (description) void MarkdownRenderer.render(this.app, description, descriptionContent, "", this.markdownComponent);
    else descriptionContent.setText("توضیحی برای این تسک ثبت نشده است.");
    const items = normalizeChecklist(this.task.items);
    if (items.length) {
      const box = this.contentEl.createDiv({ cls: "ticktick-task-details-checklist" });
      const summary = checklistSummary(items);
      box.createEl("strong", { text: `Checklist · ${summary.completed}/${summary.total}` });
      for (const item of items) box.createDiv({ text: `${item.completed ? "☑" : "☐"} ${item.title}` });
    }

    const allTasks = this.actions.allTasks ? this.actions.allTasks() : [];
    
    // Dependencies (blockedBy / blocks)
    const deps = resolveTaskDependencies(this.task, allTasks);
    if (deps.blockedBy.length > 0 || deps.blocks.length > 0) {
      const depBox = this.contentEl.createDiv({ cls: "ticktick-task-details-deps" });
      depBox.createEl("strong", { text: "وابستگی‌ها و پیش‌نیازها" });
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

    // Hierarchy & Subtasks
    const hierarchy = buildTaskHierarchy(allTasks);
    const parentTask = hierarchy.getParentTask(this.task);
    const childTasks = hierarchy.getChildTasks(this.task.id);
    const progress = calculateHierarchyProgress(this.task, childTasks);

    if (parentTask || childTasks.length > 0 || progress) {
      const hierBox = this.contentEl.createDiv({ cls: "ticktick-task-details-hierarchy" });
      const hierHeader = hierBox.createDiv({ cls: "ticktick-task-hier-header" });
      hierHeader.createEl("strong", { text: "ساختار سلسله‌مراتبی و زیرتسک‌ها" });
      if (!this.actions.experimentalWritesEnabled) {
        hierHeader.createSpan({ cls: "ticktick-task-readonly-badge", text: "آزمایشی: فقط‌خواندنی" });
      }

      if (parentTask) {
        hierBox.createDiv({
          cls: "ticktick-task-parent-link",
          text: `↳ تسک والد: ${parentTask.title || "بدون عنوان"}`
        });
      }

      if (progress && progress.total > 0) {
        const progRow = hierBox.createDiv({ cls: "ticktick-task-progress-row" });
        progRow.createSpan({ text: `پیشرفت: ${progress.completed}/${progress.total} (${progress.percent}٪)` });
        const progBar = progRow.createDiv({ cls: "ticktick-metric-progress" });
        const progFill = progBar.createDiv({ cls: "ticktick-metric-progress-fill" });
        progFill.style.width = `${progress.percent}%`;
      }

      if (childTasks.length > 0) {
        const subtaskList = hierBox.createDiv({ cls: "ticktick-task-subtasks-list" });
        for (const child of childTasks) {
          const childDone = Number(child.status ?? 0) !== 0;
          const row = subtaskList.createDiv({ cls: `ticktick-task-subtask-item ${childDone ? "is-completed" : ""}` });
          row.createSpan({ text: childDone ? "☑" : "☐" });
          row.createSpan({ text: child.title || "بدون عنوان", cls: "ticktick-subtask-title" });
        }
      }
    }
    const actions = this.contentEl.createDiv({ cls: "ticktick-task-details-actions" });
    if (this.actions.complete) actions.createEl("button", { text: "تکمیل تسک", cls: "mod-cta" }).addEventListener("click", async () => {
      try {
        await this.actions.complete?.();
        this.close();
      } catch (error) {
        new Notice(error instanceof Error ? error.message : "تکمیل تسک ناموفق بود.");
      }
    });
    if (this.actions.edit) actions.createEl("button", { text: "ویرایش" }).addEventListener("click", async () => {
      try {
        await this.actions.edit?.(this.task);
        await this.actions.changed?.();
        this.close();
      } catch (error) {
        new Notice(error instanceof Error ? error.message : "ویرایش تسک ناموفق بود.");
      }
    });
    if (this.actions.load) actions.createEl("button", { text: "بروزرسانی جزئیات" }).addEventListener("click", () => void this.loadAndRender());
  }
  onClose() {
    this.markdownComponent.unload();
    this.contentEl.empty();
  }
}
