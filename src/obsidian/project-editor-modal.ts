import { App, Modal, Notice, Setting } from "obsidian";

export type ProjectDraft = { name: string; color: string; viewMode: string; kind: string; sortOrder?: number };

export class ProjectEditorModal extends Modal {
  private resolveResult!: (value: ProjectDraft | null) => void;
  private result = new Promise<ProjectDraft | null>(resolve => this.resolveResult = resolve);
  private finished = false;
  constructor(app: App, private initial: Partial<ProjectDraft> = {}) { super(app); }
  private finish(value: ProjectDraft | null) { if (!this.finished) { this.finished = true; this.resolveResult(value); this.close(); } }
  onOpen() {
    this.modalEl.addClass("ticktick-project-editor-modal");
    this.titleEl.setText(this.initial.name ? "ویرایش لیست TickTick" : "ساخت لیست TickTick");
    let name = String(this.initial.name ?? "");
    let color = String(this.initial.color ?? "#4772fa");
    let viewMode = String(this.initial.viewMode ?? "list");
    const kind = String(this.initial.kind ?? "TASK").toUpperCase() === "NOTE" ? "NOTE" : "TASK";
    new Setting(this.contentEl).setName("نام لیست").addText(input => { input.setValue(name).onChange(value => name = value); input.inputEl.dir = "rtl"; input.inputEl.focus(); });
    new Setting(this.contentEl).setName("رنگ").setDesc("کد رنگ مانند #4772fa").addText(input => { input.setValue(color).onChange(value => color = value.trim()); input.inputEl.dir = "ltr"; });
    new Setting(this.contentEl).setName("نمایش").addDropdown(dropdown => dropdown.addOption("list", "فهرست").addOption("kanban", "کانبان").addOption("timeline", "Timeline").setValue(viewMode).onChange(value => viewMode = value));
    const actions = this.contentEl.createDiv({ cls: "modal-button-container" });
    actions.createEl("button", { text: "انصراف" }).addEventListener("click", () => this.finish(null));
    actions.createEl("button", { text: "ذخیره", cls: "mod-cta" }).addEventListener("click", () => {
      if (!name.trim()) { new Notice("نام لیست را وارد کن."); return; }
      if (color && !/^#[0-9a-f]{6}$/i.test(color)) { new Notice("رنگ باید مانند #4772fa باشد."); return; }
      this.finish({ name: name.trim(), color, viewMode, kind, sortOrder: this.initial.sortOrder });
    });
  }
  onClose() { this.contentEl.empty(); if (!this.finished) { this.finished = true; this.resolveResult(null); } }
  openAndWait() { this.open(); return this.result; }
}
