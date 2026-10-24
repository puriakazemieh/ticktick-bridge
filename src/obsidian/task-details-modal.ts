import { App, Modal, Notice } from "obsidian";
import { checklistSummary, normalizeChecklist } from "../core/checklist.js";

export class TaskDetailsModal extends Modal {
  constructor(app: App, private task: any, private onComplete?: () => Promise<void>) { super(app); }
  onOpen() {
    this.modalEl.addClass("ticktick-task-details-modal");
    this.titleEl.setText(String(this.task.title ?? "بدون عنوان"));
    const meta = this.contentEl.createDiv({ cls: "ticktick-task-details-meta" });
    for (const value of [this.task.projectName, this.task.dueDate ? `📅 ${String(this.task.dueDate).slice(0, 10)}` : "", this.task.repeatFlag ? "🔁 تکرار" : ""]) if (value) meta.createSpan({ text: String(value) });
    const description = String(this.task.desc ?? this.task.content ?? "").trim();
    if (description) this.contentEl.createDiv({ cls: "ticktick-task-details-description", text: description });
    const items = normalizeChecklist(this.task.items); if (items.length) { const box = this.contentEl.createDiv({ cls: "ticktick-task-details-checklist" }); const summary = checklistSummary(items); box.createEl("strong", { text: `Checklist · ${summary.completed}/${summary.total}` }); for (const item of items) box.createDiv({ text: `${item.completed ? "☑" : "☐"} ${item.title}` }); }
    const tags = this.task.tags ?? []; if (tags.length) this.contentEl.createDiv({ cls: "ticktick-task-details-tags", text: tags.map((tag: string) => `#${tag}`).join("  ") });
    if (this.onComplete && Number(this.task.status ?? 0) === 0) { const button = this.contentEl.createEl("button", { text: "تکمیل تسک", cls: "mod-cta" }); button.addEventListener("click", async () => { button.disabled = true; try { await this.onComplete!(); new Notice("تسک تکمیل و همگام شد."); this.close(); } catch (error) { button.disabled = false; new Notice(error instanceof Error ? error.message : "تکمیل ناموفق بود."); } }); }
  }
  onClose() { this.contentEl.empty(); }
}
