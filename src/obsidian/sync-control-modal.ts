import { App, Modal, Notice, Setting } from "obsidian";

export interface SyncControlPlugin {
  syncNow: () => Promise<void>;
  previewMarkdownSync: () => Promise<void>;
  applyMarkdownSync: () => Promise<void>;
  openMarkdownSyncConflicts: () => Promise<void>;
}

export class SyncControlModal extends Modal {
  constructor(app: App, private plugin: SyncControlPlugin) { super(app); }
  onOpen() {
    this.titleEl.setText("همگام‌سازی TickTick");
    this.contentEl.createEl("p", { text: "اول پیش‌نمایش را ببین؛ اعمال فقط پس از انتخاب صریح شما انجام می‌شود." });
    new Setting(this.contentEl).setName("همگام‌سازی عادی").setDesc("کش تسک‌ها و عادت‌ها را تازه می‌کند.").addButton(button => button.setButtonText("همگام‌سازی الآن").setCta().onClick(async () => { button.setDisabled(true); try { await this.plugin.syncNow(); new Notice("همگام‌سازی کامل شد."); } finally { button.setDisabled(false); } }));
    new Setting(this.contentEl).setName("Markdown ↔ TickTick").setDesc("تغییرات را بدون نوشتن بررسی کن.").addButton(button => button.setButtonText("پیش‌نمایش").onClick(async () => { button.setDisabled(true); try { await this.plugin.previewMarkdownSync(); } finally { button.setDisabled(false); } })).addButton(button => button.setButtonText("اعمال preview").setCta().onClick(async () => { button.setDisabled(true); try { await this.plugin.applyMarkdownSync(); } finally { button.setDisabled(false); } }));
    new Setting(this.contentEl).setName("تعارض‌ها").setDesc("موارد نیازمند تصمیم دستی را باز می‌کند.").addButton(button => button.setButtonText("باز کردن تعارض‌ها").onClick(async () => { await this.plugin.openMarkdownSyncConflicts(); }));
  }
  onClose() { this.contentEl.empty(); }
}
