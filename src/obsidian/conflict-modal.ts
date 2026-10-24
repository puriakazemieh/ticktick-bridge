import { App, Modal, Setting } from "obsidian";

export type ConflictChoice = "local" | "remote" | "merge" | "unbind" | "skip";

/** Deliberately requires a human choice: a same-field conflict is never auto-resolved. */
export class MarkdownConflictModal extends Modal {
  private resolveChoice!: (choice: ConflictChoice) => void;
  constructor(app: App, private conflict: any) { super(app); }
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
