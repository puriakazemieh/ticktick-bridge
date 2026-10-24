import { App, Modal, Notice } from "obsidian";
import { checklistSummary, normalizeChecklist } from "../core/checklist.js";
import { taskPriority } from "./task-priority";
import { mergeTaskDetails, taskDescription } from "../core/task-description.js";

type TaskActions = {
  complete?: () => Promise<void>;
  edit?: (task: any) => Promise<any>;
  load?: (task: any) => Promise<any>;
  changed?: () => Promise<void>;
};

export class TaskDetailsModal extends Modal {
  constructor(app: App, private task: any, private actions: TaskActions = {}) { super(app); }
  onOpen() {
    this.modalEl.addClass("ticktick-task-details-modal");
    // Full descriptions live in the local cache, so opening a task never
    // waits on the network. A read is only needed for an incomplete record.
    this.render();
    if (this.actions.load && !taskDescription(this.task)) void this.loadAndRender();
  }
  private async loadAndRender() {
    this.contentEl.empty();
    this.titleEl.setText("جزئیات تسک");
    if (this.actions.load) {
      this.contentEl.createDiv({ cls: "ticktick-task-details-loading", text: "در حال دریافت جزئیات کامل از TickTick…" });
      try {
        const fresh = await this.actions.load(this.task);
        if (fresh?.id) this.task = mergeTaskDetails(this.task, fresh);
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
    for (const value of [this.task.projectName, this.task.dueDate ? `📅 ${String(this.task.dueDate).slice(0, 10)}` : "بدون تاریخ", `${priority.icon} اولویت ${priority.label}`, this.task.repeatFlag ? "🔁 تکرار" : ""]) if (value) meta.createSpan({ text: String(value) });
    const description = taskDescription(this.task);
    const descriptionBox = this.contentEl.createDiv({ cls: "ticktick-task-details-description" });
    descriptionBox.createEl("strong", { text: "توضیحات" });
    descriptionBox.createDiv({ text: description || "توضیحی برای این تسک ثبت نشده است." });
    const items = normalizeChecklist(this.task.items); if (items.length) { const box = this.contentEl.createDiv({ cls: "ticktick-task-details-checklist" }); const summary = checklistSummary(items); box.createEl("strong", { text: `Checklist · ${summary.completed}/${summary.total}` }); for (const item of items) box.createDiv({ text: `${item.completed ? "☑" : "☐"} ${item.title}` }); }
    const tags = this.task.tags ?? []; if (tags.length) this.contentEl.createDiv({ cls: "ticktick-task-details-tags", text: tags.map((tag: string) => `#${tag}`).join("  ") });
    const actions = this.contentEl.createDiv({ cls: "ticktick-task-details-actions" });
    if (this.actions.edit) {
      const edit = actions.createEl("button", { text: "ویرایش کامل", cls: "mod-cta" });
      edit.addEventListener("click", async () => { edit.disabled = true; try { const updated = await this.actions.edit!(this.task); if (!updated) { edit.disabled = false; return; } if (updated.id) this.task = { ...this.task, ...updated }; await this.actions.changed?.(); new Notice("تغییرات در TickTick ذخیره شد."); await this.loadAndRender(); } catch (error) { edit.disabled = false; new Notice(error instanceof Error ? error.message : "ویرایش تسک ناموفق بود."); } });
    }
    if (this.actions.complete && Number(this.task.status ?? 0) === 0) { const button = actions.createEl("button", { text: "تکمیل تسک" }); button.addEventListener("click", async () => { button.disabled = true; try { await this.actions.complete!(); await this.actions.changed?.(); new Notice("تسک تکمیل و همگام شد."); this.close(); } catch (error) { button.disabled = false; new Notice(error instanceof Error ? error.message : "تکمیل ناموفق بود."); } }); }
  }
  onClose() { this.contentEl.empty(); }
}
