import { App, Component, MarkdownRenderer, Menu, Modal, Notice, Setting } from "obsidian";
import { taskDescription } from "../../core/task-description.js";
import { toDateKey } from "../../core/date.js";
import { reminderTimeFromTask } from "../helpers";
import type { TaskDraft } from "../types";

export class TaskEditorModal extends Modal {
  private resolveResult!: (value: TaskDraft | null) => void;
  private result = new Promise<TaskDraft | null>(resolve => this.resolveResult = resolve);
  private finished = false;
  private comp = new Component();

  constructor(app: App, private projects: Array<{ id: string; name: string }>, private initial: TaskDraft) {
    super(app);
  }

  finish(value: TaskDraft | null) {
    if (!this.finished) {
      this.finished = true;
      this.resolveResult(value);
      this.close();
    }
  }

  onOpen() {
    this.modalEl.addClass("ticktick-modal");
    const { contentEl } = this;
    contentEl.addClass("ticktick-task-editor-modal");

    // ─── Decorative header ───
    const header = contentEl.createDiv({ cls: "ticktick-editor-header" });
    header.createEl("h2", { text: this.initial.id ? "✏️ ویرایش تسک" : "✨ افزودن تسک" });
    header.createEl("p", { cls: "ticktick-task-editor-subtitle", text: "تغییرات مستقیماً در TickTick ذخیره می‌شوند." });

    // ─── Gradient divider ───
    contentEl.createDiv({ cls: "ticktick-editor-divider" });

    // ─── Fields container ───
    const fields = contentEl.createDiv({ cls: "ticktick-editor-fields" });

    let title = String(this.initial.title ?? "");
    let description = taskDescription(this.initial);
    let projectId = String(this.initial.projectId ?? this.projects[0]?.id ?? "");
    let dueDate = toDateKey(String(this.initial.dueDate ?? ""), String(this.initial.timeZone ?? "Asia/Tehran")) ?? "";
    let reminderTime = reminderTimeFromTask(this.initial);

    new Setting(fields).setName("📝 عنوان").addText(input => {
      input.setValue(title).onChange(value => title = value);
      input.inputEl.dir = "rtl";
      input.inputEl.addClass("ticktick-input-full-width");
    });

    const selectedProjectName = () => this.projects.find(project => project.id === projectId)?.name ?? "انتخاب پروژه";
    new Setting(fields).setName("📂 پروژه").setDesc("برای انتخاب پروژه کلیک کن.").addButton(button => {
      button.setButtonText(selectedProjectName());
      button.buttonEl.addClass("ticktick-project-picker");
      button.buttonEl.addEventListener("click", (event) => {
        const menu = new Menu();
        this.projects.forEach(project => menu.addItem(item => item
          .setTitle(project.name)
          .setChecked(project.id === projectId)
          .onClick(() => { projectId = project.id; button.setButtonText(selectedProjectName()); })));
        menu.showAtMouseEvent(event);
      });
    });

    new Setting(fields).setName("📅 تاریخ").setDesc("با انتخاب تاریخ، تقویم سیستم باز می‌شود.").addText(input => {
      input.inputEl.type = "date";
      input.setValue(dueDate).onChange(value => dueDate = value);
      input.inputEl.dir = "ltr";
    });
    new Setting(fields).setName("⏰ یادآوری").setDesc("اختیاری؛ در ساعت انتخاب‌شده در همان روز یادآوری می‌شود.").addText(input => {
      input.inputEl.type = "time";
      input.setValue(reminderTime).onChange(value => reminderTime = value);
      input.inputEl.dir = "ltr";
    });

    // ─── Description Section (Full-width, Markdown Preview & Edit) ───
    const descSection = fields.createDiv({ cls: "ticktick-desc-section" });
    const descHeader = descSection.createDiv({ cls: "ticktick-desc-header" });
    const descHeaderInfo = descHeader.createDiv({ cls: "ticktick-desc-header-info" });
    descHeaderInfo.createSpan({ text: "📋 توضیحات (Markdown)", cls: "ticktick-desc-label" });

    const tabsWrap = descHeader.createDiv({ cls: "ticktick-desc-tabs" });
    const previewTabBtn = tabsWrap.createEl("button", {
      cls: "ticktick-tab-btn",
      text: "👁️ پیش‌نمایش"
    });
    const editTabBtn = tabsWrap.createEl("button", {
      cls: "ticktick-tab-btn",
      text: "✏️ ویرایش متن"
    });

    const descContainer = descSection.createDiv({ cls: "ticktick-desc-container" });
    const previewEl = descContainer.createDiv({ cls: "ticktick-desc-preview" });
    const descTextarea = descContainer.createEl("textarea", {
      cls: "ticktick-desc-textarea",
      placeholder: "توضیحات و یادداشت‌های تسک را وارد کن... (پشتیبانی کامل از Markdown)"
    });
    descTextarea.value = description;
    descTextarea.oninput = () => { description = descTextarea.value; };

    const renderPreview = async () => {
      previewEl.empty();
      const content = description.trim() || "*هنوز توضیحی برای این تسک ثبت نشده است. برای نوشتن، روی دکمه «ویرایش متن» در بالا کلیک کنید.*";
      await MarkdownRenderer.render(this.app, content, previewEl, "", this.comp);
    };

    const setTab = (tab: "preview" | "edit") => {
      if (tab === "preview") {
        previewTabBtn.addClass("is-active");
        editTabBtn.removeClass("is-active");
        previewEl.removeClass("is-hidden");
        descTextarea.addClass("is-hidden");
        description = descTextarea.value;
        void renderPreview();
      } else {
        editTabBtn.addClass("is-active");
        previewTabBtn.removeClass("is-active");
        previewEl.addClass("is-hidden");
        descTextarea.removeClass("is-hidden");
        descTextarea.focus();
      }
    };

    previewTabBtn.onclick = (e) => { e.preventDefault(); setTab("preview"); };
    editTabBtn.onclick = (e) => { e.preventDefault(); setTab("edit"); };

    const initialTab = description.trim() ? "preview" : "edit";
    setTab(initialTab);

    // ─── Action buttons ───
    const actions = contentEl.createDiv({ cls: "ticktick-editor-actions" });
    actions.createEl("button", { text: "❌ انصراف" }).addEventListener("click", () => this.finish(null));
    actions.createEl("button", { text: "💾 ذخیره", cls: "mod-cta" }).addEventListener("click", () => {
      description = descTextarea.value;
      if (!title.trim() || !projectId) return new Notice("عنوان و پروژه را وارد کن.");
      if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return new Notice("تاریخ باید به شکل YYYY-MM-DD باشد.");
      this.finish({ ...this.initial, title: title.trim(), desc: description.trim(), projectId, dueDate, reminderTime });
    });
  }

  onClose() {
    this.comp.unload();
    this.contentEl.empty();
    if (!this.finished) { this.finished = true; this.resolveResult(null); }
  }

  openAndWait() { this.open(); return this.result; }
}

export class DeleteConfirmationModal extends Modal {
  private resolveResult!: (value: boolean) => void;
  private result = new Promise<boolean>(resolve => this.resolveResult = resolve);
  private finished = false;

  constructor(app: App, private title: string) { super(app); }

  finish(value: boolean) {
    if (!this.finished) {
      this.finished = true;
      this.resolveResult(value);
      this.close();
    }
  }

  onOpen() {
    this.contentEl.createEl("h2", { text: "حذف تسک" });
    this.contentEl.createEl("p", { text: `تسک «${this.title}» از TickTick حذف شود؟` });
    const actions = this.contentEl.createDiv({ cls: "modal-button-container" });
    actions.createEl("button", { text: "انصراف" }).addEventListener("click", () => this.finish(false));
    actions.createEl("button", { text: "حذف", cls: "mod-warning" }).addEventListener("click", () => this.finish(true));
  }

  onClose() {
    this.contentEl.empty();
    if (!this.finished) { this.finished = true; this.resolveResult(false); }
  }

  openAndWait() { this.open(); return this.result; }
}

export function openTaskEditor(app: App, projects: Array<{ id: string; name: string }>, initial: TaskDraft) {
  const allProjects = [{ id: "inbox", name: "صندوق ورودی" }, ...projects.filter(p => p.id !== "inbox")];
  return new TaskEditorModal(app, allProjects, initial).openAndWait();
}

export function confirmDelete(app: App, title: string) {
  return new DeleteConfirmationModal(app, title).openAndWait();
}
