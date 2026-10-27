import { App, Modal } from "obsidian";

export class LegacyBackupMigrationModal extends Modal {
  private resolveResult!: (value: boolean) => void;
  private result = new Promise<boolean>(resolve => this.resolveResult = resolve);
  private finished = false;

  constructor(app: App, private count: number, private size: number) {
    super(app);
  }

  onOpen() {
    this.contentEl.createEl("h2", { text: "انتقال پشتیبان‌های قدیمی" });
    this.contentEl.createEl("p", { text: `${this.count} فایل با مجموع ${this.size.toLocaleString()} بایت پیدا شد. هر فایل ابتدا به .ticktick/backups/legacy-root/ کپی و طول بایت آن بررسی می‌شود؛ فقط سپس نسخهٔ ریشه حذف خواهد شد.` });
    const actions = this.contentEl.createDiv({ cls: "modal-button-container" });
    actions.createEl("button", { text: "انصراف" }).addEventListener("click", () => this.finish(false));
    actions.createEl("button", { text: "انتقال", cls: "mod-warning" }).addEventListener("click", () => this.finish(true));
  }

  private finish(value: boolean) {
    if (this.finished) return;
    this.finished = true;
    this.resolveResult(value);
    this.close();
  }

  onClose() {
    this.contentEl.empty();
    if (!this.finished) {
      this.finished = true;
      this.resolveResult(false);
    }
  }

  openAndWait() {
    this.open();
    return this.result;
  }
}
