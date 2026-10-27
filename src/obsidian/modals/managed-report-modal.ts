import { App, Modal } from "obsidian";

export class ManagedReportModal extends Modal {
  constructor(app: App, private latest: { path: string; report: unknown } | null) {
    super(app);
  }

  onOpen() {
    this.contentEl.createEl("h2", { text: "آخرین گزارش مدیریت‌شده" });
    if (!this.latest) {
      this.contentEl.createEl("p", { text: "هنوز گزارشی در .ticktick/reports/ ثبت نشده است." });
      return;
    }
    this.contentEl.createEl("p", { text: this.latest.path });
    this.contentEl.createEl("pre", { text: JSON.stringify(this.latest.report, null, 2) });
  }

  onClose() {
    this.contentEl.empty();
  }
}
