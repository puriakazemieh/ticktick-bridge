import { App, Component, MarkdownRenderer, Menu, Modal, Notice, setIcon } from "obsidian";
import { taskDescription } from "../../core/task-description.js";
import { toDateKey } from "../../core/date.js";
import { reminderTimeFromTask, cleanTaskTitle, toggleMarkdownCheckboxAtIndex } from "../helpers";
import { JalaliDatePicker } from "../components/jalali-date-picker";
import type { TaskDraft, TickTickTask } from "../types";

function insertMarkdownWrap(textarea: HTMLTextAreaElement, prefix: string, suffix: string, placeholder = ""): void {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const val = textarea.value;
  const selected = val.substring(start, end);

  if (selected.length > 0) {
    const replacement = `${prefix}${selected}${suffix}`;
    textarea.value = val.substring(0, start) + replacement + val.substring(end);
    textarea.focus();
    textarea.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
  } else {
    const replacement = `${prefix}${placeholder}${suffix}`;
    textarea.value = val.substring(0, start) + replacement + val.substring(end);
    textarea.focus();
    const cursor = start + prefix.length;
    textarea.setSelectionRange(cursor, cursor + placeholder.length);
  }
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

function insertMarkdownLinePrefix(textarea: HTMLTextAreaElement, prefix: string): void {
  const start = textarea.selectionStart;
  const val = textarea.value;
  const lineStart = val.lastIndexOf("\n", start - 1) + 1;

  textarea.value = val.substring(0, lineStart) + prefix + val.substring(lineStart);
  textarea.focus();
  const newPos = start + prefix.length;
  textarea.setSelectionRange(newPos, newPos);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

export interface SubtaskActions {
  onToggle?: (subtask: TickTickTask, completed: boolean) => Promise<void>;
  onEdit?: (subtask: TickTickTask) => Promise<unknown>;
  onDelete?: (subtask: TickTickTask) => Promise<void>;
}

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
    private getProjectColumns?: (projectId: string) => Array<{ id: string; name: string }> | Promise<Array<{ id: string; name: string }>>,
    private subtaskActions?: SubtaskActions
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

    // ─── Modern Refined Header ───
    const header = contentEl.createDiv({ cls: "ticktick-editor-header" });
    const titleRow = header.createDiv({ cls: "ticktick-editor-header-title-row" });
    const iconSpan = titleRow.createSpan({ cls: "ticktick-editor-header-icon" });
    setIcon(iconSpan, this.initial.id ? "pencil" : "plus-circle");
    titleRow.createEl("h2", { text: this.initial.id ? "ویرایش تسک" : "افزودن تسک جدید" });

    header.createSpan({
      cls: "ticktick-editor-header-badge",
      text: "همگام‌سازی مستقیم TickTick"
    });

    // ─── Fields Container ───
    const fields = contentEl.createDiv({ cls: "ticktick-editor-fields" });

    let title = String(this.initial.title ?? "");
    let description = taskDescription(this.initial);
    let projectId = String(this.initial.projectId ?? this.projects[0]?.id ?? "");
    let parentId: string | null = this.initial.parentId ? String(this.initial.parentId) : null;
    let dueDate = toDateKey(String(this.initial.dueDate ?? ""), String(this.initial.timeZone ?? "Asia/Tehran")) ?? "";
    let reminderTime = reminderTimeFromTask(this.initial);
    let priority = typeof this.initial.priority === "number" ? this.initial.priority : 0;

    let titleInputEl: HTMLInputElement | null = null;

    // ─── 1. Title Input (Prominent) ───
    const titleGroup = fields.createDiv({ cls: "ticktick-form-group mod-title" });
    const titleLabel = titleGroup.createDiv({ cls: "ticktick-field-label" });
    const tIcon = titleLabel.createSpan({ cls: "ticktick-field-icon" });
    setIcon(tIcon, "type");
    titleLabel.createSpan({ text: "عنوان تسک" });
    titleLabel.createSpan({ cls: "ticktick-field-required", text: "*" });

    const titleInput = titleGroup.createEl("input", {
      type: "text",
      cls: "ticktick-title-input",
      value: title,
      placeholder: "عنوان تسک را وارد کنید..."
    });
    titleInput.dir = "rtl";
    titleInputEl = titleInput;
    titleInput.addEventListener("input", () => { title = titleInput.value; });
    titleInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        onSave();
      }
    });

    // ─── 2. Properties Grid (2-Column Responsive) ───
    const metaGrid = fields.createDiv({ cls: "ticktick-form-grid" });

    // Project Picker
    const selectedProjectName = () => this.projects.find(project => project.id === projectId)?.name ?? "صندوق ورودی";
    const projectBox = metaGrid.createDiv({ cls: "ticktick-field-box" });
    const projectLabel = projectBox.createDiv({ cls: "ticktick-field-label" });
    const prIcon = projectLabel.createSpan({ cls: "ticktick-field-icon" });
    setIcon(prIcon, "folder");
    projectLabel.createSpan({ text: "پروژه" });

    const projectBtn = projectBox.createEl("button", {
      type: "button",
      cls: "ticktick-select-trigger"
    });
    const prBtnText = projectBtn.createSpan({ cls: "ticktick-select-trigger-label", text: selectedProjectName() });
    const prChevron = projectBtn.createSpan({ cls: "ticktick-select-trigger-chevron" });
    setIcon(prChevron, "chevron-down");

    let columnId: string | null = this.initial.columnId ? String(this.initial.columnId) : null;

    // Kanban Column Picker (Appears if project has columns)
    const columnBox = metaGrid.createDiv({ cls: "ticktick-field-box ticktick-column-field-box" });
    const columnLabel = columnBox.createDiv({ cls: "ticktick-field-label" });
    const colIcon = columnLabel.createSpan({ cls: "ticktick-field-icon" });
    setIcon(colIcon, "columns-3");
    columnLabel.createSpan({ text: "ستون کانبان" });

    const columnControl = columnBox.createDiv({ cls: "ticktick-column-picker-control" });

    const renderColumnUI = async () => {
      columnControl.empty();
      if (!this.getProjectColumns) {
        columnBox.addClass("is-hidden");
        return;
      }

      const columns = await this.getProjectColumns(projectId);
      if (!columns || columns.length === 0) {
        columnBox.addClass("is-hidden");
        columnId = null;
        return;
      }

      columnBox.removeClass("is-hidden");
      const currentCol = columns.find(c => String(c.id) === String(columnId));
      const colLabel = currentCol ? currentCol.name : "انتخاب ستون...";

      const colBtn = columnControl.createEl("button", {
        cls: "ticktick-select-trigger",
        attr: { type: "button", title: "انتخاب ستون کانبان" }
      });
      colBtn.createSpan({ text: colLabel, cls: "ticktick-select-trigger-label" });
      const cChevron = colBtn.createSpan({ cls: "ticktick-select-trigger-chevron" });
      setIcon(cChevron, "chevron-down");

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

    projectBtn.addEventListener("click", (event) => {
      const menu = new Menu();
      this.projects.forEach(project => menu.addItem(item => item
        .setTitle(project.name)
        .setChecked(project.id === projectId)
        .onClick(() => {
          projectId = project.id;
          columnId = null;
          prBtnText.setText(selectedProjectName());
          void renderColumnUI();
        })));
      menu.showAtMouseEvent(event);
    });

    void renderColumnUI();

    // Due Date Picker (Jalali)
    const dateBox = metaGrid.createDiv({ cls: "ticktick-field-box" });
    const dateLabel = dateBox.createDiv({ cls: "ticktick-field-label" });
    const dIcon = dateLabel.createSpan({ cls: "ticktick-field-icon" });
    setIcon(dIcon, "calendar");
    dateLabel.createSpan({ text: "تاریخ سررسید (شمسی)" });

    const dateControlWrap = dateBox.createDiv({ cls: "ticktick-date-control-wrap" });
    new JalaliDatePicker(dateControlWrap, "", dueDate, value => dueDate = value);

    // Reminder Time Picker
    const reminderBox = metaGrid.createDiv({ cls: "ticktick-field-box" });
    const reminderLabel = reminderBox.createDiv({ cls: "ticktick-field-label" });
    const rIcon = reminderLabel.createSpan({ cls: "ticktick-field-icon" });
    setIcon(rIcon, "bell");
    reminderLabel.createSpan({ text: "زمان یادآوری" });

    const timeInput = reminderBox.createEl("input", {
      type: "time",
      cls: "ticktick-time-input",
      value: reminderTime
    });
    timeInput.dir = "ltr";
    timeInput.addEventListener("input", () => { reminderTime = timeInput.value; });

    // ─── 3. Priority Selector (Segmented Pill Bar) ───
    const priorityGroup = fields.createDiv({ cls: "ticktick-form-group" });
    const prioLabel = priorityGroup.createDiv({ cls: "ticktick-field-label" });
    const pIcon = prioLabel.createSpan({ cls: "ticktick-field-icon" });
    setIcon(pIcon, "flag");
    prioLabel.createSpan({ text: "اولویت تسک" });

    const priorityControl = priorityGroup.createDiv({ cls: "ticktick-priority-selector" });
    const priorityLevels: Array<{ value: number; label: string; icon: string; cls: string }> = [
      { value: 0, label: "عادی", icon: "circle", cls: "prio-none" },
      { value: 1, label: "کم", icon: "flag", cls: "prio-low" },
      { value: 3, label: "متوسط", icon: "flag", cls: "prio-med" },
      { value: 5, label: "بالا / فوری", icon: "flag", cls: "prio-high" },
    ];

    const priorityButtons: HTMLElement[] = [];
    for (const lvl of priorityLevels) {
      const btn = priorityControl.createEl("button", {
        cls: `ticktick-priority-btn ${lvl.cls} ${priority === lvl.value ? "is-active" : ""}`,
        attr: { type: "button", "aria-label": `اولویت: ${lvl.label}` }
      });
      const iconWrap = btn.createSpan({ cls: "ticktick-priority-icon" });
      setIcon(iconWrap, lvl.icon);
      btn.createSpan({ text: lvl.label, cls: "ticktick-priority-label" });

      btn.addEventListener("click", (e) => {
        e.preventDefault();
        priority = lvl.value;
        for (const b of priorityButtons) b.removeClass("is-active");
        btn.addClass("is-active");
      });
      priorityButtons.push(btn);
    }

    // ─── 4. Parent Task Selector (Hierarchy) ───
    const parentGroup = fields.createDiv({ cls: "ticktick-form-group" });
    const parentLabel = parentGroup.createDiv({ cls: "ticktick-field-label" });
    const ptIcon = parentLabel.createSpan({ cls: "ticktick-field-icon" });
    setIcon(ptIcon, "git-branch");
    parentLabel.createSpan({ text: "تسک والد (سلسله‌مراتب)" });

    const parentControl = parentGroup.createDiv({ cls: "ticktick-parent-task-control" });

    const renderParentTaskUI = () => {
      parentControl.empty();
      if (parentId) {
        const parentTask = this.availableTasks.find(t => String(t.id) === parentId);
        const parentChip = parentControl.createSpan({ cls: "ticktick-parent-task-chip" });
        const iconSpanEl = parentChip.createSpan({ cls: "ticktick-pill-icon" });
        setIcon(iconSpanEl, "corner-down-left");
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
        const pIconEl = pickParentBtn.createSpan({ cls: "ticktick-btn-icon" });
        setIcon(pIconEl, "list-tree");

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
                      prBtnText.setText(selectedProjectName());
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

    // ─── 5. Tags Section ───
    const rawInitialTags = Array.isArray(this.initial.tags)
      ? this.initial.tags
      : (Array.isArray(this.initial.tagNames) ? this.initial.tagNames : []);
    let selectedTags: string[] = [...new Set(rawInitialTags.map(t => String(t).replace(/^[#＃]/, "").trim()).filter(Boolean))];

    const allAvailableTags: string[] = [...new Set([
      ...this.existingTags.map(t => String(t).replace(/^[#＃]/, "").trim()).filter(Boolean),
      ...selectedTags
    ])].sort((a, b) => a.localeCompare(b, "fa"));

    const tagsGroup = fields.createDiv({ cls: "ticktick-form-group" });
    const tagsLabel = tagsGroup.createDiv({ cls: "ticktick-field-label" });
    const tagIcon = tagsLabel.createSpan({ cls: "ticktick-field-icon" });
    setIcon(tagIcon, "tag");
    tagsLabel.createSpan({ text: "برچسب‌ها" });

    const tagsContainer = tagsGroup.createDiv({ cls: "ticktick-editor-tags-container" });
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

      availableWrap.empty();
      if (allAvailableTags.length > 0) {
        availableWrap.createSpan({ cls: "ticktick-available-tags-title", text: "برچسب‌های آماده:" });
        const availableList = availableWrap.createDiv({ cls: "ticktick-available-tags-list" });
        for (const tag of allAvailableTags) {
          const isSelected = selectedTags.includes(tag);
          const pill = availableList.createEl("button", {
            type: "button",
            cls: `ticktick-tag-pill ${isSelected ? "is-selected" : ""}`,
            attr: { "aria-pressed": isSelected ? "true" : "false" }
          });
          const iconSpanTag = pill.createSpan({ cls: "ticktick-pill-icon" });
          setIcon(iconSpanTag, isSelected ? "check" : "tag");
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

    // ─── 6. Description & Markdown Toolbar Section ───
    const descSection = fields.createDiv({ cls: "ticktick-desc-section" });
    const descHeader = descSection.createDiv({ cls: "ticktick-desc-header" });
    const descLabel = descHeader.createDiv({ cls: "ticktick-field-label" });
    const dlIcon = descLabel.createSpan({ cls: "ticktick-field-icon" });
    setIcon(dlIcon, "file-text");
    descLabel.createSpan({ text: "توضیحات و چک‌لیست" });

    const tabsWrap = descHeader.createDiv({ cls: "ticktick-desc-tabs" });
    const editTabBtn = tabsWrap.createEl("button", {
      cls: "ticktick-tab-btn is-active",
      attr: { type: "button" }
    });
    const etIcon = editTabBtn.createSpan({ cls: "ticktick-tab-icon" });
    setIcon(etIcon, "edit-3");
    editTabBtn.createSpan({ text: "ویرایش متن" });

    const previewTabBtn = tabsWrap.createEl("button", {
      cls: "ticktick-tab-btn",
      attr: { type: "button" }
    });
    const pvIcon = previewTabBtn.createSpan({ cls: "ticktick-tab-icon" });
    setIcon(pvIcon, "eye");
    previewTabBtn.createSpan({ text: "پیش‌نمایش زنده" });

    // Markdown Toolbar (Quick Formatting Buttons)
    const mdToolbar = descSection.createDiv({ cls: "ticktick-md-toolbar" });

    const descContainer = descSection.createDiv({ cls: "ticktick-desc-container" });
    const previewEl = descContainer.createDiv({ cls: "ticktick-desc-preview is-hidden" });
    const descTextarea = descContainer.createEl("textarea", {
      cls: "ticktick-desc-textarea",
      placeholder: "توضیحات، یادداشت یا چک‌لیست تسک را بنویسید... (پشتیبانی کامل از Markdown)"
    });
    descTextarea.value = description;
    descTextarea.addEventListener("input", () => {
      description = descTextarea.value;
    });

    // ── Tablet Virtual Keyboard Avoidance ──
    const ensureTextareaVisible = () => {
      window.setTimeout(() => {
        descTextarea.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 180);
    };

    descTextarea.addEventListener("focus", () => {
      fields.addClass("is-desc-focused");
      ensureTextareaVisible();
    });
    descTextarea.addEventListener("blur", () => {
      fields.removeClass("is-desc-focused");
    });
    descTextarea.addEventListener("click", ensureTextareaVisible);

    // Obsidian-native Markdown Editing UX: Smart Enter, Tab/Shift-Tab indent, and Formatting Shortcuts
    descTextarea.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        e.preventDefault();
        const start = descTextarea.selectionStart;
        const end = descTextarea.selectionEnd;
        const val = descTextarea.value;

        if (e.shiftKey) {
          // Un-indent: remove up to 2 spaces (or tab) at line start
          const lineStart = val.lastIndexOf("\n", start - 1) + 1;
          const linePrefix = val.slice(lineStart, lineStart + 2);
          let removeCount = 0;
          if (linePrefix.startsWith("\t")) removeCount = 1;
          else if (linePrefix === "  ") removeCount = 2;
          else if (linePrefix.startsWith(" ")) removeCount = 1;

          if (removeCount > 0) {
            descTextarea.value = val.slice(0, lineStart) + val.slice(lineStart + removeCount);
            descTextarea.selectionStart = Math.max(lineStart, start - removeCount);
            descTextarea.selectionEnd = Math.max(lineStart, end - removeCount);
          }
        } else {
          // Indent: insert 2 spaces
          descTextarea.setRangeText("  ", start, end, "end");
        }
        description = descTextarea.value;
        return;
      }

      if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
        const start = descTextarea.selectionStart;
        const val = descTextarea.value;
        const lineStart = val.lastIndexOf("\n", start - 1) + 1;
        const lineText = val.slice(lineStart, start);

        // Check for Markdown list patterns
        const cbMatch = lineText.match(/^([ \t]*)([-*+] \[(?: |x|X)\] )(.*)$/);
        const bulletMatch = !cbMatch && lineText.match(/^([ \t]*)([-*+] )(.*)$/);
        const numMatch = !cbMatch && !bulletMatch && lineText.match(/^([ \t]*)(\d+)\. (.*)$/);

        if (cbMatch) {
          const [_, indent, prefix, content] = cbMatch;
          if (!content.trim()) {
            // Empty checklist item: terminate list
            e.preventDefault();
            descTextarea.value = val.slice(0, lineStart) + val.slice(start);
            descTextarea.selectionStart = descTextarea.selectionEnd = lineStart;
          } else {
            // Auto-continue checklist item
            e.preventDefault();
            const nextItem = `\n${indent}- [ ] `;
            descTextarea.setRangeText(nextItem, start, start, "end");
          }
          description = descTextarea.value;
          return;
        }

        if (bulletMatch) {
          const [_, indent, prefix, content] = bulletMatch;
          if (!content.trim()) {
            // Empty bullet item: terminate list
            e.preventDefault();
            descTextarea.value = val.slice(0, lineStart) + val.slice(start);
            descTextarea.selectionStart = descTextarea.selectionEnd = lineStart;
          } else {
            // Auto-continue bullet item
            e.preventDefault();
            const nextItem = `\n${indent}${prefix}`;
            descTextarea.setRangeText(nextItem, start, start, "end");
          }
          description = descTextarea.value;
          return;
        }

        if (numMatch) {
          const [_, indent, numStr, content] = numMatch;
          if (!content.trim()) {
            // Empty numbered item: terminate list
            e.preventDefault();
            descTextarea.value = val.slice(0, lineStart) + val.slice(start);
            descTextarea.selectionStart = descTextarea.selectionEnd = lineStart;
          } else {
            // Auto-increment numbered item
            e.preventDefault();
            const nextNum = parseInt(numStr, 10) + 1;
            const nextItem = `\n${indent}${nextNum}. `;
            descTextarea.setRangeText(nextItem, start, start, "end");
          }
          description = descTextarea.value;
          return;
        }
      }

      // Formatting shortcuts: Ctrl+B / Cmd+B (Bold), Ctrl+I / Cmd+I (Italic), Ctrl+K (Link)
      if ((e.ctrlKey || e.metaKey) && (e.key === "b" || e.key === "B")) {
        e.preventDefault();
        insertMarkdownWrap(descTextarea, "**", "**", "متن");
        description = descTextarea.value;
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "i" || e.key === "I")) {
        e.preventDefault();
        insertMarkdownWrap(descTextarea, "*", "*", "متن");
        description = descTextarea.value;
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        insertMarkdownWrap(descTextarea, "[", "](https://)", "عنوان");
        description = descTextarea.value;
        return;
      }
    });

    if (window.visualViewport) {
      const onViewportResize = () => {
        if (document.activeElement === descTextarea) {
          ensureTextareaVisible();
        }
      };
      window.visualViewport.addEventListener("resize", onViewportResize);
      this.comp.register(() => window.visualViewport?.removeEventListener("resize", onViewportResize));
    }

    // Markdown Formatting Toolbar Buttons
    const toolbarButtons: Array<{ icon: string; title: string; action: () => void }> = [
      {
        icon: "bold",
        title: "بولد / پررنگ (**متن**)",
        action: () => insertMarkdownWrap(descTextarea, "**", "**", "متن")
      },
      {
        icon: "italic",
        title: "ایتالیک / مورب (*متن*)",
        action: () => insertMarkdownWrap(descTextarea, "*", "*", "متن")
      },
      {
        icon: "strikethrough",
        title: "خط‌خورده (~~متن~~)",
        action: () => insertMarkdownWrap(descTextarea, "~~", "~~", "متن")
      },
      {
        icon: "heading",
        title: "سرتیتر (### عنوان)",
        action: () => insertMarkdownLinePrefix(descTextarea, "### ")
      },
      {
        icon: "check-square",
        title: "مورد چک‌لیست (- [ ] مورد)",
        action: () => insertMarkdownLinePrefix(descTextarea, "- [ ] ")
      },
      {
        icon: "list",
        title: "لیست بالت (- آیتم)",
        action: () => insertMarkdownLinePrefix(descTextarea, "- ")
      },
      {
        icon: "list-ordered",
        title: "لیست شماره‌دار (1. آیتم)",
        action: () => insertMarkdownLinePrefix(descTextarea, "1. ")
      },
      {
        icon: "code",
        title: "کد (`کد`)",
        action: () => insertMarkdownWrap(descTextarea, "`", "`", "کد")
      },
      {
        icon: "quote",
        title: "نقل‌قول (> متن)",
        action: () => insertMarkdownLinePrefix(descTextarea, "> ")
      },
      {
        icon: "link",
        title: "پیوند ([عنوان](آدرس))",
        action: () => insertMarkdownWrap(descTextarea, "[", "](https://)", "عنوان")
      },
      {
        icon: "minus",
        title: "خط جداکننده (---)",
        action: () => insertMarkdownWrap(descTextarea, "\n---\n", "", "")
      }
    ];

    for (const btnInfo of toolbarButtons) {
      const btn = mdToolbar.createEl("button", {
        cls: "ticktick-md-btn",
        attr: { type: "button", title: btnInfo.title, "aria-label": btnInfo.title }
      });
      setIcon(btn, btnInfo.icon);
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        btnInfo.action();
      });
    }

    const renderPreview = async () => {
      previewEl.empty();
      const content = description.trim() || "*توضیحی برای این تسک ثبت نشده است. برای نوشتن یا تغییر، روی «ویرایش متن» کلیک کنید.*";
      await MarkdownRenderer.render(this.app, content, previewEl, "", this.comp);

      // Make markdown checkboxes interactive and sync with description
      const checkboxes = previewEl.querySelectorAll<HTMLInputElement>("input[type='checkbox']");
      checkboxes.forEach((cb, index) => {
        cb.disabled = false;
        cb.removeAttribute("disabled");
        cb.style.cursor = "pointer";
        cb.addEventListener("change", (e) => {
          e.stopPropagation();
          description = toggleMarkdownCheckboxAtIndex(description, index);
          descTextarea.value = description;
          void renderPreview();
        });
      });
    };

    const setTab = (tab: "preview" | "edit", autoFocus = false) => {
      if (tab === "preview") {
        previewTabBtn.addClass("is-active");
        editTabBtn.removeClass("is-active");
        previewEl.removeClass("is-hidden");
        descTextarea.addClass("is-hidden");
        mdToolbar.addClass("is-hidden");
        description = descTextarea.value;
        void renderPreview();
      } else {
        editTabBtn.addClass("is-active");
        previewTabBtn.removeClass("is-active");
        previewEl.addClass("is-hidden");
        descTextarea.removeClass("is-hidden");
        mdToolbar.removeClass("is-hidden");
        if (autoFocus) {
          descTextarea.focus();
          ensureTextareaVisible();
        }
      }
    };

    previewTabBtn.addEventListener("click", (e) => { e.preventDefault(); setTab("preview"); });
    editTabBtn.addEventListener("click", (e) => { e.preventDefault(); setTab("edit", true); });

    setTab("edit", false);

    // ─── 7. Subtasks Management Section (If editing an existing task) ───
    if (this.initial.id) {
      const currentTaskId = String(this.initial.id);
      const existingSubtasks = this.availableTasks.filter(t => String(t.parentId) === currentTaskId);

      const subtasksSection = fields.createDiv({ cls: "ticktick-editor-subtasks-section" });
      const subHeader = subtasksSection.createDiv({ cls: "ticktick-editor-subtasks-header" });
      subHeader.createSpan({ text: `📑 زیرتسک‌ها (${existingSubtasks.length})`, cls: "ticktick-subtasks-title" });

      const subtasksList = subtasksSection.createDiv({ cls: "ticktick-editor-subtasks-list" });

      const renderSubtaskItem = (st: TickTickTask) => {
        const itemRow = subtasksList.createDiv({ cls: "ticktick-editor-subtask-item" });
        let isDone = Number(st.status ?? 0) !== 0;

        // Checkbox
        const cb = itemRow.createEl("input", {
          type: "checkbox",
          cls: "ticktick-subtask-checkbox",
          attr: { title: isDone ? "علامت‌گذاری به عنوان انجام نشده" : "علامت‌گذاری به عنوان تکمیل شده" }
        });
        cb.checked = isDone;

        const titleSpan = itemRow.createSpan({
          text: cleanTaskTitle(st.title) || "بدون عنوان",
          cls: `ticktick-subtask-title-text${isDone ? " is-completed" : ""}`
        });

        cb.addEventListener("change", async (e) => {
          e.stopPropagation();
          const targetState = cb.checked;
          cb.disabled = true;
          try {
            if (this.subtaskActions?.onToggle) {
              await this.subtaskActions.onToggle(st, targetState);
            }
            st.status = targetState ? 2 : 0;
            isDone = targetState;
            titleSpan.toggleClass("is-completed", isDone);
            cb.title = isDone ? "علامت‌گذاری به عنوان انجام نشده" : "علامت‌گذاری به عنوان تکمیل شده";
          } catch (err) {
            cb.checked = !targetState;
            new Notice(err instanceof Error ? err.message : "تغییر وضعیت زیرتسک ناموفق بود.");
          } finally {
            cb.disabled = false;
          }
        });

        // Subtask Actions (Edit & Delete)
        const actionsDiv = itemRow.createDiv({ cls: "ticktick-subtask-actions" });

        // Edit button: Opens the full TaskEditorModal for this subtask
        const editBtn = actionsDiv.createEl("button", {
          cls: "ticktick-subtask-action-btn mod-edit",
          attr: { type: "button", title: "ویرایش کامل زیرتسک" }
        });
        setIcon(editBtn, "pencil");

        editBtn.addEventListener("click", async (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (this.subtaskActions?.onEdit) {
            editBtn.disabled = true;
            try {
              const updated = await this.subtaskActions.onEdit(st);
              if (updated && typeof updated === "object") {
                Object.assign(st, updated);
              }
              const fresh = this.availableTasks.find(t => String(t.id) === String(st.id));
              if (fresh) {
                Object.assign(st, fresh);
              }
              const isUpdatedDone = Number(st.status ?? 0) !== 0;
              cb.checked = isUpdatedDone;
              titleSpan.setText(cleanTaskTitle(st.title) || "بدون عنوان");
              titleSpan.toggleClass("is-completed", isUpdatedDone);
            } catch (err) {
              new Notice(err instanceof Error ? err.message : "ویرایش زیرتسک ناموفق بود.");
            } finally {
              editBtn.disabled = false;
            }
          }
        });

        // Delete button
        const delBtn = actionsDiv.createEl("button", {
          cls: "ticktick-subtask-action-btn mod-delete",
          attr: { type: "button", title: "حذف زیرتسک" }
        });
        setIcon(delBtn, "trash-2");

        delBtn.addEventListener("click", async (e) => {
          e.preventDefault();
          e.stopPropagation();
          const confirmed = await confirmDelete(this.app, st.title || "زیرتسک");
          if (!confirmed) return;

          delBtn.disabled = true;
          try {
            if (this.subtaskActions?.onDelete) {
              await this.subtaskActions.onDelete(st);
            }
            itemRow.remove();
            new Notice(`زیرتسک «${st.title}» حذف شد.`);
            const count = subtasksList.querySelectorAll(".ticktick-editor-subtask-item").length;
            if (count === 0) {
              subtasksList.createSpan({ cls: "ticktick-no-tags-hint", text: "بدون زیرتسک" });
            }
            subHeader.querySelector(".ticktick-subtasks-title")?.setText(`📑 زیرتسک‌ها (${count})`);
          } catch (err) {
            new Notice(err instanceof Error ? err.message : "حذف زیرتسک ناموفق بود.");
            delBtn.disabled = false;
          }
        });
      };

      if (existingSubtasks.length === 0) {
        subtasksList.createSpan({ cls: "ticktick-no-tags-hint", text: "بدون زیرتسک" });
      } else {
        for (const st of existingSubtasks) {
          renderSubtaskItem(st);
        }
      }

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
            const res = await this.onCreateSubtask(currentTaskId, subTitle) as TickTickTask | undefined;
            new Notice(`زیرتسک «${subTitle}» ایجاد شد.`);
            const hint = subtasksList.querySelector(".ticktick-no-tags-hint");
            if (hint) hint.remove();

            const newSt: TickTickTask = res && typeof res === "object" && res.id ? res : {
              id: `temp-${Date.now()}`,
              title: subTitle,
              parentId: currentTaskId,
              projectId: projectId,
              status: 0
            } as any;

            renderSubtaskItem(newSt);
            subInput.value = "";
            const count = subtasksList.querySelectorAll(".ticktick-editor-subtask-item").length;
            subHeader.querySelector(".ticktick-subtasks-title")?.setText(`📑 زیرتسک‌ها (${count})`);
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
      if (!title.trim() || !projectId) return new Notice("لطفاً عنوان و پروژه تسک را مشخص کنید.");
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

    // ─── 8. Sticky Action Buttons Footer ───
    const actions = contentEl.createDiv({ cls: "ticktick-editor-actions" });
    const cancelBtn = actions.createEl("button", {
      cls: "ticktick-action-btn mod-cancel",
      text: "انصراف",
      attr: { type: "button" }
    });
    cancelBtn.addEventListener("click", () => this.finish(null));

    const saveBtn = actions.createEl("button", {
      cls: "ticktick-action-btn mod-cta mod-save",
      attr: { type: "button" }
    });
    const sIcon = saveBtn.createSpan({ cls: "ticktick-btn-icon" });
    setIcon(sIcon, "check");
    saveBtn.createSpan({ text: this.initial.id ? "ذخیره تغییرات" : "ایجاد تسک" });
    saveBtn.addEventListener("click", () => onSave());

    // Scroll reset and auto-focus
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
  getProjectColumns?: (projectId: string) => Array<{ id: string; name: string }> | Promise<Array<{ id: string; name: string }>>,
  subtaskActions?: SubtaskActions
) {
  const allProjects = [{ id: "inbox", name: "صندوق ورودی" }, ...projects.filter(p => p.id !== "inbox")];
  return new TaskEditorModal(app, allProjects, initial, existingTags, availableTasks, onCreateSubtask, getProjectColumns, subtaskActions).openAndWait();
}

export function confirmDelete(app: App, title: string) {
  return new DeleteConfirmationModal(app, title).openAndWait();
}
