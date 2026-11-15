import { App, Component, MarkdownRenderer, Menu, Modal, Notice, Setting, setIcon } from "obsidian";
import { taskDescription } from "../../core/task-description.js";
import { toDateKey } from "../../core/date.js";
import { reminderTimeFromTask, cleanTaskTitle } from "../helpers";
import { JalaliDatePicker } from "../components/jalali-date-picker";
import type { TaskDraft, TickTickTask } from "../types";

export class TaskEditorModal extends Modal {
  private resolveResult!: (value: TaskDraft | null) => void;
  private result = new Promise<TaskDraft | null>(resolve => this.resolveResult = resolve);
  private finished = false;
  private comp = new Component();

  constructor(
    app: App,
    private projects: Array<{ id: string; name: string }>,
    private initial: TaskDraft,
    private existingTags: string[] = [],
    private availableTasks: TickTickTask[] = [],
    private onCreateSubtask?: (parentId: string, title: string) => Promise<unknown>,
    private getProjectColumns?: (projectId: string) => Array<{ id: string; name: string }> | Promise<Array<{ id: string; name: string }>>
  ) {
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
    let parentId: string | null = this.initial.parentId ? String(this.initial.parentId) : null;
    let dueDate = toDateKey(String(this.initial.dueDate ?? ""), String(this.initial.timeZone ?? "Asia/Tehran")) ?? "";
    let reminderTime = reminderTimeFromTask(this.initial);
    let priority = typeof this.initial.priority === "number" ? this.initial.priority : 0;

    let titleInputEl: HTMLInputElement | null = null;
    new Setting(fields).setName("📝 عنوان").addText(input => {
      input.setValue(title).onChange(value => title = value);
      input.inputEl.dir = "rtl";
      input.inputEl.addClass("ticktick-input-full-width");
      input.inputEl.placeholder = "عنوان تسک را وارد کنید...";
      titleInputEl = input.inputEl;
      input.inputEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          onSave();
        }
      });
    });

    const selectedProjectName = () => this.projects.find(project => project.id === projectId)?.name ?? "انتخاب پروژه";
    let columnId: string | null = this.initial.columnId ? String(this.initial.columnId) : null;

    new Setting(fields).setName("📂 پروژه").setDesc("برای انتخاب پروژه کلیک کن.").addButton(button => {
      button.setButtonText(selectedProjectName());
      button.buttonEl.addClass("ticktick-project-picker");
      button.buttonEl.addEventListener("click", (event) => {
        const menu = new Menu();
        this.projects.forEach(project => menu.addItem(item => item
          .setTitle(project.name)
          .setChecked(project.id === projectId)
          .onClick(() => {
            projectId = project.id;
            columnId = null;
            button.setButtonText(selectedProjectName());
            void renderColumnUI();
          })));
        menu.showAtMouseEvent(event);
      });
    });

    // ─── Project Column (Kanban Section) Setting ───
    const columnSetting = new Setting(fields)
      .setName("📊 ستون کانبان")
      .setDesc("انتخاب ستون در این پروژه (اختیاری).");
    const columnControl = columnSetting.controlEl.createDiv({ cls: "ticktick-column-picker-control" });

    const renderColumnUI = async () => {
      columnControl.empty();
      if (!this.getProjectColumns) {
        columnSetting.settingEl.hide();
        return;
      }

      const columns = await this.getProjectColumns(projectId);
      if (!columns || columns.length === 0) {
        columnSetting.settingEl.hide();
        columnId = null;
        return;
      }

      columnSetting.settingEl.show();
      const currentCol = columns.find(c => String(c.id) === String(columnId));
      const colLabel = currentCol ? currentCol.name : "انتخاب ستون...";

      const colBtn = columnControl.createEl("button", {
        cls: "ticktick-column-picker-btn",
        attr: { type: "button", title: "انتخاب ستون کانبان" }
      });
      const iconSpan = colBtn.createSpan({ cls: "ticktick-btn-icon" });
      setIcon(iconSpan, "columns-3");
      colBtn.createSpan({ text: colLabel, cls: "ticktick-column-picker-label" });

      colBtn.addEventListener("click", (event) => {
        event.preventDefault();
        const menu = new Menu();
        menu.addItem(item => item
          .setTitle("بدون ستون (پیش‌فرض)")
          .setChecked(!columnId)
          .onClick(() => {
            columnId = null;
            void renderColumnUI();
          }));

        for (const col of columns) {
          menu.addItem(item => item
            .setTitle(col.name)
            .setChecked(String(col.id) === String(columnId))
            .onClick(() => {
              columnId = String(col.id);
              void renderColumnUI();
            }));
        }
        menu.showAtMouseEvent(event);
      });

      if (columnId) {
        const clearBtn = columnControl.createEl("button", {
          cls: "ticktick-column-clear-btn mod-icon",
          attr: { type: "button", title: "حذف انتخاب ستون", "aria-label": "حذف انتخاب ستون" }
        });
        setIcon(clearBtn, "x");
        clearBtn.addEventListener("click", (e) => {
          e.preventDefault();
          columnId = null;
          void renderColumnUI();
        });
      }
    };
    void renderColumnUI();

    // ─── Parent Task / Subtask Setting ───
    const parentSetting = new Setting(fields)
      .setName("↳ تسک والد (سلسله‌مراتب)")
      .setDesc("انتخاب والد برای تبدیل به زیرتسک یا خروج از زیرتسک.");

    const parentControl = parentSetting.controlEl.createDiv({ cls: "ticktick-parent-task-control" });

    const renderParentTaskUI = () => {
      parentControl.empty();
      if (parentId) {
        const parentTask = this.availableTasks.find(t => String(t.id) === parentId);
        const parentChip = parentControl.createSpan({ cls: "ticktick-parent-task-chip" });
        const iconSpan = parentChip.createSpan({ cls: "ticktick-pill-icon" });
        setIcon(iconSpan, "corner-down-left");
        parentChip.createSpan({
          cls: "ticktick-parent-name",
          text: parentTask?.title ? `والد: ${cleanTaskTitle(parentTask.title)}` : `والد #${parentId}`
        });

        const unnestBtn = parentControl.createEl("button", {
          cls: "ticktick-parent-action-btn mod-warning",
          text: "✕ خروج از زیرتسک",
          attr: { type: "button", title: "تبدیل به تسک اصلی مستقل" }
        });
        unnestBtn.addEventListener("click", (e) => {
          e.preventDefault();
          parentId = null;
          renderParentTaskUI();
        });
      } else {
        const pickParentBtn = parentControl.createEl("button", {
          cls: "ticktick-parent-action-btn",
          text: "+ تبدیل به زیرتسک (انتخاب والد)",
          attr: { type: "button" }
        });
        const pIcon = pickParentBtn.createSpan({ cls: "ticktick-btn-icon" });
        setIcon(pIcon, "list-tree");

        pickParentBtn.addEventListener("click", (e) => {
          e.preventDefault();
          const menu = new Menu();
          const candidates = this.availableTasks.filter(t =>
            String(t.id) !== String(this.initial.id ?? "") &&
            (!this.initial.id || String(t.parentId ?? "") !== String(this.initial.id))
          );

          if (candidates.length === 0) {
            menu.addItem(item => item.setTitle("تسکی برای انتخاب به عنوان والد یافت نشد").setDisabled(true));
          } else {
            const projectCandidates = candidates.filter(t => !projectId || String(t.projectId) === projectId);
            const listToShow = projectCandidates.length > 0 ? projectCandidates : candidates;

            for (const cand of listToShow.slice(0, 30)) {
              menu.addItem(item => {
                const titleStr = cleanTaskTitle(cand.title) || `تسک #${cand.id}`;
                item.setTitle(titleStr)
                  .setChecked(String(cand.id) === parentId)
                  .onClick(() => {
                    parentId = String(cand.id);
                    if (cand.projectId) {
                      projectId = String(cand.projectId);
                      columnId = null;
                      const projBtn = fields.querySelector<HTMLButtonElement>(".ticktick-project-picker");
                      if (projBtn) projBtn.textContent = selectedProjectName();
                      void renderColumnUI();
                    }
                    renderParentTaskUI();
                  });
              });
            }
          }
          menu.showAtMouseEvent(e);
        });
      }
    };
    renderParentTaskUI();

    const dateSetting = new Setting(fields)
      .setName("📅 تاریخ سررسید (شمسی)")
      .setDesc("انتخاب تاریخ از تقویم شمسی یا تایپ دستی.");
    new JalaliDatePicker(dateSetting.controlEl, "", dueDate, value => dueDate = value);
    new Setting(fields).setName("⏰ یادآوری").setDesc("اختیاری؛ در ساعت انتخاب‌شده در همان روز یادآوری می‌شود.").addText(input => {
      input.inputEl.type = "time";
      input.setValue(reminderTime).onChange(value => reminderTime = value);
      input.inputEl.dir = "ltr";
    });

    // ─── Priority Selector ───
    const prioritySetting = new Setting(fields)
      .setName("🚩 اولویت")
      .setDesc("اولویت تسک را برای برنامه‌ریزی مشخص کن.");

    const priorityControl = prioritySetting.controlEl.createDiv({ cls: "ticktick-priority-selector" });
    const priorityLevels: Array<{ value: number; label: string; icon: string; cls: string }> = [
      { value: 0, label: "عادی", icon: "circle", cls: "prio-none" },
      { value: 1, label: "کم", icon: "flag", cls: "prio-low" },
      { value: 3, label: "متوسط", icon: "flag", cls: "prio-med" },
      { value: 5, label: "بالا", icon: "flag", cls: "prio-high" },
    ];

    const priorityButtons: HTMLElement[] = [];
    for (const lvl of priorityLevels) {
      const btn = priorityControl.createEl("button", {
        cls: `ticktick-priority-btn ${lvl.cls} ${priority === lvl.value ? "is-active" : ""}`,
        attr: { type: "button", "aria-label": `اولویت: ${lvl.label}` }
      });
      const iconSpan = btn.createSpan({ cls: "ticktick-priority-icon" });
      setIcon(iconSpan, lvl.icon);
      btn.createSpan({ text: lvl.label, cls: "ticktick-priority-label" });

      btn.addEventListener("click", (e) => {
        e.preventDefault();
        priority = lvl.value;
        for (const b of priorityButtons) b.removeClass("is-active");
        btn.addClass("is-active");
      });
      priorityButtons.push(btn);
    }

    // ─── Tags State & Selector ───
    const rawInitialTags = Array.isArray(this.initial.tags)
      ? this.initial.tags
      : (Array.isArray(this.initial.tagNames) ? this.initial.tagNames : []);
    let selectedTags: string[] = [...new Set(rawInitialTags.map(t => String(t).replace(/^[#＃]/, "").trim()).filter(Boolean))];

    const allAvailableTags: string[] = [...new Set([
      ...this.existingTags.map(t => String(t).replace(/^[#＃]/, "").trim()).filter(Boolean),
      ...selectedTags
    ])].sort((a, b) => a.localeCompare(b, "fa"));

    const tagsSetting = new Setting(fields)
      .setName("🏷️ برچسب‌ها")
      .setDesc("انتخاب از برچسب‌های موجود یا افزودن برچسب جدید.");

    const tagsContainer = tagsSetting.controlEl.createDiv({ cls: "ticktick-editor-tags-container" });
    const selectedTagsList = tagsContainer.createDiv({ cls: "ticktick-selected-tags-list" });

    const addTagRow = tagsContainer.createDiv({ cls: "ticktick-add-tag-row" });
    const tagInput = addTagRow.createEl("input", {
      type: "text",
      cls: "ticktick-tag-input",
      placeholder: "برچسب جدید... (Enter برای افزودن)"
    });
    tagInput.dir = "rtl";

    const addTagBtn = addTagRow.createEl("button", {
      type: "button",
      cls: "ticktick-tag-add-btn",
      text: "+ افزودن"
    });

    const availableWrap = tagsContainer.createDiv({ cls: "ticktick-available-tags-wrap" });

    const renderTagsUI = () => {
      // 1. Selected tags list
      selectedTagsList.empty();
      if (selectedTags.length === 0) {
        selectedTagsList.createSpan({ cls: "ticktick-no-tags-hint", text: "بدون برچسب" });
      } else {
        for (const tag of selectedTags) {
          const chip = selectedTagsList.createSpan({ cls: "ticktick-selected-tag-chip" });
          chip.createSpan({ cls: "ticktick-tag-text", text: `#${tag}` });
          const removeBtn = chip.createSpan({
            cls: "ticktick-tag-remove-btn",
            attr: { role: "button", "aria-label": `حذف برچسب ${tag}`, title: "حذف" }
          });
          removeBtn.setText("×");
          removeBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            selectedTags = selectedTags.filter(t => t !== tag);
            renderTagsUI();
          });
        }
      }

      // 2. Available tags pool
      availableWrap.empty();
      if (allAvailableTags.length > 0) {
        availableWrap.createSpan({ cls: "ticktick-available-tags-title", text: "برچسب‌های موجود:" });
        const availableList = availableWrap.createDiv({ cls: "ticktick-available-tags-list" });
        for (const tag of allAvailableTags) {
          const isSelected = selectedTags.includes(tag);
          const pill = availableList.createEl("button", {
            type: "button",
            cls: `ticktick-tag-pill ${isSelected ? "is-selected" : ""}`,
            attr: { "aria-pressed": isSelected ? "true" : "false" }
          });
          const iconSpan = pill.createSpan({ cls: "ticktick-pill-icon" });
          setIcon(iconSpan, isSelected ? "check" : "tag");
          pill.createSpan({ text: `#${tag}` });
          pill.addEventListener("click", (e) => {
            e.preventDefault();
            if (selectedTags.includes(tag)) {
              selectedTags = selectedTags.filter(t => t !== tag);
            } else {
              selectedTags.push(tag);
            }
            renderTagsUI();
          });
        }
      }
    };

    const handleAddNewTag = () => {
      const raw = tagInput.value.trim().replace(/^[#＃]/, "").trim();
      if (!raw) return;
      if (!selectedTags.includes(raw)) {
        selectedTags.push(raw);
      }
      if (!allAvailableTags.includes(raw)) {
        allAvailableTags.push(raw);
        allAvailableTags.sort((a, b) => a.localeCompare(b, "fa"));
      }
      tagInput.value = "";
      renderTagsUI();
    };

    addTagBtn.addEventListener("click", (e) => {
      e.preventDefault();
      handleAddNewTag();
    });

    tagInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        handleAddNewTag();
      }
    });

    renderTagsUI();

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

    const setTab = (tab: "preview" | "edit", autoFocus = false) => {
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
        if (autoFocus) {
          descTextarea.focus();
        }
      }
    };

    previewTabBtn.onclick = (e) => { e.preventDefault(); setTab("preview"); };
    editTabBtn.onclick = (e) => { e.preventDefault(); setTab("edit", true); };

    const initialTab = description.trim() ? "preview" : "edit";
    setTab(initialTab, false);

    // ─── Subtasks Management Section (If editing an existing task) ───
    if (this.initial.id) {
      const currentTaskId = String(this.initial.id);
      const existingSubtasks = this.availableTasks.filter(t => String(t.parentId) === currentTaskId);

      const subtasksSection = fields.createDiv({ cls: "ticktick-editor-subtasks-section" });
      const subHeader = subtasksSection.createDiv({ cls: "ticktick-editor-subtasks-header" });
      subHeader.createSpan({ text: `📑 زیرتسک‌ها (${existingSubtasks.length})`, cls: "ticktick-subtasks-title" });

      const subtasksList = subtasksSection.createDiv({ cls: "ticktick-editor-subtasks-list" });
      if (existingSubtasks.length === 0) {
        subtasksList.createSpan({ cls: "ticktick-no-tags-hint", text: "بدون زیرتسک" });
      } else {
        for (const st of existingSubtasks) {
          const itemRow = subtasksList.createDiv({ cls: "ticktick-editor-subtask-item" });
          itemRow.createSpan({ text: Number(st.status ?? 0) !== 0 ? "☑" : "☐", cls: "ticktick-subtask-check-icon" });
          itemRow.createSpan({ text: cleanTaskTitle(st.title) || "بدون عنوان", cls: "ticktick-subtask-title-text" });
        }
      }

      // Quick inline input to add a new subtask
      const addSubRow = subtasksSection.createDiv({ cls: "ticktick-add-subtask-row" });
      const subInput = addSubRow.createEl("input", {
        type: "text",
        cls: "ticktick-subtask-input",
        placeholder: "عنوان زیرتسک جدید... (Enter برای افزودن)"
      });
      subInput.dir = "rtl";

      const addSubBtn = addSubRow.createEl("button", {
        type: "button",
        cls: "ticktick-subtask-add-btn",
        text: "+ افزودن زیرتسک"
      });

      const handleCreateSub = async () => {
        const subTitle = subInput.value.trim();
        if (!subTitle) return;
        addSubBtn.disabled = true;
        try {
          if (this.onCreateSubtask) {
            await this.onCreateSubtask(currentTaskId, subTitle);
            new Notice(`زیرتسک «${subTitle}» ایجاد شد.`);
            const hint = subtasksList.querySelector(".ticktick-no-tags-hint");
            if (hint) hint.remove();
            const newSubRow = subtasksList.createDiv({ cls: "ticktick-editor-subtask-item" });
            newSubRow.createSpan({ text: "☐", cls: "ticktick-subtask-check-icon" });
            newSubRow.createSpan({ text: subTitle, cls: "ticktick-subtask-title-text" });
            subInput.value = "";
          }
        } catch (err) {
          new Notice(err instanceof Error ? err.message : "ایجاد زیرتسک ناموفق بود.");
        } finally {
          addSubBtn.disabled = false;
        }
      };

      addSubBtn.addEventListener("click", (e) => {
        e.preventDefault();
        void handleCreateSub();
      });

      subInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.stopPropagation();
          void handleCreateSub();
        }
      });
    }

    const onSave = () => {
      description = descTextarea.value;
      if (!title.trim() || !projectId) return new Notice("عنوان و پروژه را وارد کن.");
      if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return new Notice("تاریخ باید به شکل YYYY-MM-DD باشد.");
      this.finish({
        ...this.initial,
        title: title.trim(),
        desc: description.trim(),
        projectId,
        columnId: columnId || null,
        parentId: parentId || null,
        dueDate,
        reminderTime,
        priority,
        tags: selectedTags,
        tagNames: selectedTags
      });
    };

    // ─── Action buttons ───
    const actions = contentEl.createDiv({ cls: "ticktick-editor-actions" });
    actions.createEl("button", { text: "❌ انصراف" }).addEventListener("click", () => this.finish(null));
    actions.createEl("button", { text: "💾 ذخیره", cls: "mod-cta" }).addEventListener("click", () => onSave());

    // ─── Ensure scroll starts at the top and focus title input ───
    const resetScrollToTop = () => {
      fields.scrollTop = 0;
      contentEl.scrollTop = 0;
      this.modalEl.scrollTop = 0;
    };
    resetScrollToTop();

    window.setTimeout(() => {
      resetScrollToTop();
      if (titleInputEl) {
        titleInputEl.focus({ preventScroll: true });
        if (title.length > 0) {
          titleInputEl.select();
        }
      }
    }, 25);
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

export function openTaskEditor(
  app: App,
  projects: Array<{ id: string; name: string }>,
  initial: TaskDraft,
  existingTags: string[] = [],
  availableTasks: TickTickTask[] = [],
  onCreateSubtask?: (parentId: string, title: string) => Promise<unknown>,
  getProjectColumns?: (projectId: string) => Array<{ id: string; name: string }> | Promise<Array<{ id: string; name: string }>>
) {
  const allProjects = [{ id: "inbox", name: "صندوق ورودی" }, ...projects.filter(p => p.id !== "inbox")];
  return new TaskEditorModal(app, allProjects, initial, existingTags, availableTasks, onCreateSubtask, getProjectColumns).openAndWait();
}

export function confirmDelete(app: App, title: string) {
  return new DeleteConfirmationModal(app, title).openAndWait();
}
