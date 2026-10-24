import { App, Modal, Notice, Setting } from "obsidian";
import { normalizeTickTickNote, noteFileName, noteMarkdown } from "../core/ticktick-note.js";
import { ManagedStorage } from "./managed-storage";

export class NoteImport {
  constructor(private app: App, private storage: ManagedStorage, private destination: () => string) {}
  preview(records: any[]) {
    const folder = this.destination().replace(/^\/+|\/+$/g, "") || "TickTick Notes";
    return (records ?? []).map(record => normalizeTickTickNote(record)).filter((note): note is any => Boolean(note)).map(note => ({ note, path: `${folder}/${noteFileName(note)}`, selected: false, collision: Boolean(this.app.vault.getAbstractFileByPath(`${folder}/${noteFileName(note)}`)) }));
  }
  async apply(rows: Array<{ note: any; path: string; selected?: boolean }>) {
    const selected = rows.filter(row => row.selected);
    await this.storage.writeSnapshot("ticktick-notes-import", { count: selected.length, paths: selected.map(row => row.path) });
    const created: string[] = []; const skipped: string[] = [];
    for (const row of selected) {
      if (this.app.vault.getAbstractFileByPath(row.path)) { skipped.push(row.path); continue; }
      const folder = row.path.split("/").slice(0, -1).join("/"); if (folder && !this.app.vault.getAbstractFileByPath(folder)) await this.app.vault.createFolder(folder);
      await this.app.vault.create(row.path, noteMarkdown(row.note)); created.push(row.path);
    }
    await this.storage.writeReport("ticktick-notes-import", { createdCount: created.length, skippedCount: skipped.length, paths: created });
    return { created, skipped };
  }
}

export class NoteImportModal extends Modal {
  constructor(app: App, private importer: NoteImport, private records: any[]) { super(app); }
  async onOpen() {
    this.titleEl.setText("انتقال آزمایشی TickTick Notes");
    const rows = this.importer.preview(this.records);
    if (!rows.length) { this.contentEl.createEl("p", { text: "Note با kind: NOTE در cache فعلی وجود ندارد." }); return; }
    this.contentEl.createEl("p", { text: "فقط موارد انتخاب‌شده ایجاد می‌شوند؛ فایل موجود هرگز overwrite نمی‌شود." });
    for (const row of rows) new Setting(this.contentEl).setName(row.note.title).setDesc(`${row.note.projectName || "بدون پروژه"}${row.collision ? " · فایل هم‌نام موجود است و رد می‌شود" : ""}`).addToggle(toggle => toggle.setValue(false).setDisabled(row.collision).onChange(value => row.selected = value));
    new Setting(this.contentEl).addButton(button => button.setButtonText("انتقال انتخاب‌شده‌ها").setCta().onClick(async () => { button.setDisabled(true); try { const result = await this.importer.apply(rows); new Notice(`${result.created.length} فایل ایجاد شد؛ ${result.skipped.length} مورد رد شد.`); this.close(); } catch (error) { button.setDisabled(false); new Notice(error instanceof Error ? error.message : "انتقال ناموفق بود."); } }));
  }
  onClose() { this.contentEl.empty(); }
}
