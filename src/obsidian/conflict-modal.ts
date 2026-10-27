import { App, Modal, Setting } from "obsidian";
import type { MarkdownConflict, PendingMutation } from "../types/ticktick";

export type ConflictChoice = "local" | "remote" | "merge" | "unbind" | "skip";

/** Deliberately requires a human choice: a same-field conflict is never auto-resolved. */
export class MarkdownConflictModal extends Modal {
  private resolveChoice!: (choice: ConflictChoice) => void;
  constructor(app: App, private conflict: MarkdownConflict) { super(app); }
  openAndWait() { this.open(); return new Promise<ConflictChoice>(resolve => { this.resolveChoice = resolve; }); }
  onOpen() {
    this.titleEl.setText("تعارض همگام‌سازی Markdown و TickTick");
    this.contentEl.createEl("p", { text: `${this.conflict.path}:${this.conflict.line + 1} — ${this.conflict.message}` });
    for (const item of this.conflict.diff?.conflicts ?? []) this.contentEl.createEl("pre", { text: `${item.field}\nObsidian: ${JSON.stringify(item.local)}\nTickTick: ${JSON.stringify(item.remote)}` });
    const choose = (choice: ConflictChoice) => { this.resolveChoice(choice); this.close(); };
    new Setting(this.contentEl).addButton(button => button.setButtonText("نگه‌داشتن Obsidian").setCta().onClick(() => choose("local"))).addButton(button => button.setButtonText("نگه‌داشتن TickTick").onClick(() => choose("remote")));
    new Setting(this.contentEl).addButton(button => button.setButtonText("ترکیب فیلدهای بی‌تعارض").onClick(() => choose("merge"))).addButton(button => button.setButtonText("برداشتن binding").onClick(() => choose("unbind"))).addButton(button => button.setButtonText("رد کردن").onClick(() => choose("skip")));
  }
  onClose() { this.contentEl.empty(); }
}

/** Offline writes can conflict with a remote deletion or edit.  Unlike a toast,
 * this screen keeps the exact queued change visible and lets the user choose a
 * safe next action. */
export class PendingMutationConflictModal extends Modal {
  constructor(
    app: App,
    private operations: PendingMutation[],
    private resolve: (operation: PendingMutation, choice: "retry" | "discard") => Promise<void>
  ) { super(app); }
  onOpen() {
    this.titleEl.setText("تغییرهای نیازمند بررسی");
    this.contentEl.createEl("p", { text: "این تغییرها به‌صورت محلی حفظ شده‌اند، اما TickTick آن‌ها را در آخرین ارسال نپذیرفته است." });
    if (!this.operations.length) { this.contentEl.createEl("p", { text: "تعارضی برای مدیریت باقی نمانده است." }); return; }
    for (const operation of this.operations) {
      const payload = (operation.payload ?? {}) as Record<string, unknown>;
      const card = this.contentEl.createDiv({ cls: "ticktick-conflict-card" });
      card.createEl("strong", { text: String(payload.title ?? payload.id ?? "تغییر بدون عنوان") });
      card.createEl("small", { text: `عملیات: ${operation.type} · ثبت محلی: ${new Date(operation.queuedAt ?? Date.now()).toLocaleString("fa-IR")}` });
      const controls = card.createDiv({ cls: "modal-button-container" });
      controls.createEl("button", { text: "تلاش دوباره", cls: "mod-cta" }).addEventListener("click", async () => { await this.resolve(operation, "retry"); this.close(); });
      controls.createEl("button", { text: "حذف تغییر محلی" }).addEventListener("click", async () => { await this.resolve(operation, "discard"); this.close(); });
    }
  }
  onClose() { this.contentEl.empty(); }
}
