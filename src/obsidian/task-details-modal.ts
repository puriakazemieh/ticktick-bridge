import { App, Component, MarkdownRenderer, Modal, Notice } from "obsidian";
import { checklistSummary, normalizeChecklist } from "../core/checklist.js";
import { taskPriority } from "./task-priority";
import { mergeTaskDetails, taskDescription } from "../core/task-description.js";
import { formatPersianDate } from "../core/persian-date.js";
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
    for (const value of [this.task.projectName, this.task.dueDate ? `📅 ${formatPersianDate(this.task.dueDate, this.task.timeZone)}` : "بدون تاریخ", `${priority.icon} اولویت ${priority.label}`, repeatSummary(this.task.repeatFlag)]) if (value) meta.createSpan({ text: String(value) });
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
