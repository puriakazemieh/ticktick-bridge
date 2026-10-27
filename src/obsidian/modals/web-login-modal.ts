import { Modal, Notice, Setting } from "obsidian";

export class TickTickWebLoginModal extends Modal {
  private resolveResult!: (value: { username: string; password: string } | null) => void;
  private result = new Promise<{ username: string; password: string } | null>(resolve => this.resolveResult = resolve);
  private submitted = false;

  onOpen() {
    this.contentEl.addClass("ticktick-login-modal");
    this.contentEl.createEl("h2", { text: "ورود مستقیم به TickTick" });
    this.contentEl.createEl("p", { text: "رمز فقط برای دریافت نشست TickTick استفاده می‌شود و در Obsidian ذخیره نخواهد شد." });
    let username = "";
    let password = "";
    new Setting(this.contentEl).setName("ایمیل یا نام کاربری").addText(input => {
      input.inputEl.autocomplete = "username";
      input.inputEl.addClass("ticktick-input-full-width");
      input.onChange(value => username = value);
    });
    new Setting(this.contentEl).setName("رمز عبور").addText(input => {
      input.inputEl.type = "password";
      input.inputEl.autocomplete = "current-password";
      input.inputEl.addClass("ticktick-input-full-width");
      input.onChange(value => password = value);
    });
    const actions = this.contentEl.createDiv({ cls: "modal-button-container" });
    actions.createEl("button", { text: "انصراف" }).addEventListener("click", () => this.finish(null));
    actions.createEl("button", { text: "ورود و اتصال", cls: "mod-cta" }).addEventListener("click", () => {
      if (!username.trim() || !password) {
        new Notice("نام کاربری و رمز عبور را وارد کن.");
        return;
      }
      this.finish({ username, password });
    });
  }

  private finish(value: { username: string; password: string } | null) {
    if (this.submitted) return;
    this.submitted = true;
    this.resolveResult(value);
    this.close();
  }

  onClose() {
    this.contentEl.empty();
    if (!this.submitted) {
      this.submitted = true;
      this.resolveResult(null);
    }
  }

  openAndWait() {
    this.open();
    return this.result;
  }
}
