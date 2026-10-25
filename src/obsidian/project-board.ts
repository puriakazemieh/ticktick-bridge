import { App, Menu, Notice, setIcon } from "obsidian";
import { boardColumns, RECURRING_BOARD_VIEW_ID, sidebarTree, virtualBoardData, virtualBoardEntries } from "../core/project-board.js";
import { TaskDetailsModal } from "./task-details-modal";
import { taskPriority } from "./task-priority";
import { ProjectEditorModal } from "./project-editor-modal";
import { taskDescription } from "../core/task-description.js";
import { formatPersianDate } from "../core/persian-date.js";
import { sortPlanningTasks } from "../core/calendar-range.js";
import { enhanceHorizontalScroll, scrollToStart } from "./horizontal-scroll";

type Host = {
  app: App;
  projects: () => Promise<any[]>;
  createProject: (project: any) => Promise<any>;
  updateProject: (project: any) => Promise<any>;
  deleteProject: (projectId: string) => Promise<any>;
  createTask: (initial: any) => Promise<any>;
  tasks: () => any[];
  board: (project: any) => Promise<any>;
  refresh: () => Promise<void>;
  complete: (task: any) => Promise<any>;
  binding: (task: any) => any;
  load: (task: any) => Promise<any>;
  edit: (task: any) => Promise<any>;
  moveToColumn: (task: any, columnId: string) => Promise<any>;
  showCompleted: () => boolean;
  preferences: () => { selected: string; collapsed: string[] };
  savePreferences: (value: { selected: string; collapsed: string[] }) => Promise<void>;
};

export class ProjectBoard {
  private selected = "";
  private collapsed = new Set<string>();
  private initialized = false;
  private sortMode = "ticktick";

  constructor(private element: HTMLElement, private host: Host) {}

  async render() {
    if (!this.initialized) {
      const saved = this.host.preferences();
      this.selected = saved.selected;
      this.collapsed = new Set(saved.collapsed);
      this.initialized = true;
    }

    this.element.empty();
    this.element.addClass("ticktick-project-board");
    const root = this.element.createDiv({ cls: "ticktick-project-board-root" });

    try {
      const projects = await this.host.projects();
      if (!this.selected && projects[0]) {
        this.selected = String(projects[0].id);
      }

      // ── 1. Sidebar Rail ──
      const rail = root.createDiv({ cls: "ticktick-project-rail" });

      const railHeader = rail.createDiv({ cls: "ticktick-rail-header" });
      const headerIcon = railHeader.createSpan({ cls: "ticktick-rail-icon" });
      setIcon(headerIcon, "folders");
      railHeader.createSpan({ text: "پروژه‌ها و لیست‌ها" });

      // All Projects button
      const allBtn = rail.createEl("button", {
        cls: `ticktick-project-row ticktick-all-projects-btn ${!this.selected ? "is-selected" : ""}`,
        attr: { type: "button", "aria-label": "همهٔ لیست‌ها" }
      });
      const allIcon = allBtn.createSpan({ cls: "ticktick-project-row-icon" });
      setIcon(allIcon, "layers");
      allBtn.createSpan({ cls: "ticktick-project-name", text: "همهٔ لیست‌ها" });
      allBtn.createSpan({ cls: "ticktick-project-count", text: String(this.host.tasks().length) });
      allBtn.addEventListener("click", () => {
        this.selected = "";
        void this.persistAndRender();
      });

      const virtual = virtualBoardEntries(this.host.tasks());
      const viewHeading = rail.createEl("button", {
        cls: `ticktick-project-group ${this.collapsed.has("virtual-views") ? "is-collapsed" : ""}`,
        attr: { type: "button" }
      });
      const viewChevron = viewHeading.createSpan({ cls: "ticktick-group-chevron" });
      setIcon(viewChevron, this.collapsed.has("virtual-views") ? "chevron-left" : "chevron-down");
      viewHeading.createSpan({ cls: "ticktick-group-title", text: "نمایش‌ها" });
      viewHeading.addEventListener("click", () => {
        this.collapsed.has("virtual-views") ? this.collapsed.delete("virtual-views") : this.collapsed.add("virtual-views");
        void this.persistAndRender();
      });
      if (!this.collapsed.has("virtual-views")) {
        const recurring = rail.createEl("button", {
          cls: `ticktick-project-row ${this.selected === RECURRING_BOARD_VIEW_ID ? "is-selected" : ""}`,
          attr: { type: "button", "aria-label": `تکرارشونده‌ها، ${virtual.recurring.count} تسک باز` }
        });
        const recurringIcon = recurring.createSpan({ cls: "ticktick-project-row-icon" });
        setIcon(recurringIcon, "repeat-2");
        recurring.createSpan({ cls: "ticktick-project-name", text: virtual.recurring.name });
        recurring.createSpan({ cls: "ticktick-project-count", text: String(virtual.recurring.count) });
        recurring.addEventListener("click", () => { this.selected = RECURRING_BOARD_VIEW_ID; void this.persistAndRender(); });
      }

      const tagHeading = rail.createEl("button", {
        cls: `ticktick-project-group ${this.collapsed.has("virtual-tags") ? "is-collapsed" : ""}`,
        attr: { type: "button" }
      });
      const tagChevron = tagHeading.createSpan({ cls: "ticktick-group-chevron" });
      setIcon(tagChevron, this.collapsed.has("virtual-tags") ? "chevron-left" : "chevron-down");
      tagHeading.createSpan({ cls: "ticktick-group-title", text: "برچسب‌ها" });
      tagHeading.addEventListener("click", () => {
        this.collapsed.has("virtual-tags") ? this.collapsed.delete("virtual-tags") : this.collapsed.add("virtual-tags");
        void this.persistAndRender();
      });
      if (!this.collapsed.has("virtual-tags")) {
        for (const tag of virtual.tags) {
          const row = rail.createEl("button", {
            cls: `ticktick-project-row ticktick-tag-view-row ${this.selected === tag.id ? "is-selected" : ""}`,
            attr: { type: "button", "aria-label": `برچسب ${tag.name}، ${tag.count} تسک باز` }
          });
          const tagIcon = row.createSpan({ cls: "ticktick-project-row-icon" });
          setIcon(tagIcon, "tag");
          row.createSpan({ cls: "ticktick-project-name", text: `#${tag.name}` });
          row.createSpan({ cls: "ticktick-project-count", text: String(tag.count) });
          row.addEventListener("click", () => { this.selected = tag.id; void this.persistAndRender(); });
        }
      }

      // Groups and projects tree
      for (const group of sidebarTree(projects, this.host.tasks())) {
        const key = group.name || "flat";
        const groupHeading = rail.createEl("button", {
          cls: `ticktick-project-group ${this.collapsed.has(key) ? "is-collapsed" : ""}`,
          attr: { type: "button" }
        });
        const groupChevron = groupHeading.createSpan({ cls: "ticktick-group-chevron" });
        setIcon(groupChevron, this.collapsed.has(key) ? "chevron-left" : "chevron-down");
        groupHeading.createSpan({ cls: "ticktick-group-title", text: group.name || "لیست‌ها" });
        groupHeading.addEventListener("click", () => {
          this.collapsed.has(key) ? this.collapsed.delete(key) : this.collapsed.add(key);
          void this.persistAndRender();
        });

        if (this.collapsed.has(key)) continue;

        for (const project of group.projects) {
          const row = rail.createEl("button", {
            cls: `ticktick-project-row ${this.selected === String(project.id) ? "is-selected" : ""}`,
            attr: { type: "button", "aria-label": `${project.name}، ${project.openCount} تسک باز` }
          });
          const dot = row.createSpan({ cls: "ticktick-project-dot" });
          dot.style.setProperty("--project-color", project.color ?? "var(--interactive-accent)");
          row.createSpan({ cls: "ticktick-project-name", text: project.name });
          row.createSpan({ cls: "ticktick-project-count", text: String(project.openCount) });
          row.addEventListener("click", () => {
            this.selected = String(project.id);
            void this.persistAndRender();
          });
        }
      }

      // Create new list button at the bottom of the sidebar
      const newProjectBtn = rail.createEl("button", {
        cls: "ticktick-new-project-btn",
        attr: { type: "button" }
      });
      const plusIcon = newProjectBtn.createSpan({ cls: "ticktick-btn-icon" });
      setIcon(plusIcon, "folder-plus");
      newProjectBtn.createSpan({ text: "+ لیست جدید…" });
      newProjectBtn.addEventListener("click", async () => {
        const draft = await new ProjectEditorModal(this.host.app).openAndWait();
        if (!draft) return;
        newProjectBtn.disabled = true;
        try {
          const project = await this.host.createProject(draft);
          this.selected = String(project?.id ?? "");
          await this.host.refresh();
          await this.persistAndRender();
          new Notice("لیست در TickTick ساخته شد.");
        } catch (error) {
          new Notice(error instanceof Error ? error.message : "ساخت لیست ناموفق بود.");
        } finally {
          newProjectBtn.disabled = false;
        }
      });

      // ── 2. Main Board Area ──
      const main = root.createDiv({ cls: "ticktick-project-main" });

      const project = projects.find(item => String(item.id) === this.selected);
      const virtualData = virtualBoardData(this.selected, this.host.tasks(), projects);
      const displayProject = virtualData?.project ?? project;
      if (!displayProject) {
        const emptyState = main.createDiv({ cls: "ticktick-board-empty" });
        const emptyIcon = emptyState.createSpan({ cls: "ticktick-empty-icon" });
        setIcon(emptyIcon, "folder-open");
        emptyState.createEl("h3", { text: "یک لیست را انتخاب کنید" });
        emptyState.createEl("p", { text: "برای مشاهده کارت‌ها، یکی از لیست‌های نوار کناری را انتخاب فرمایید." });
        return;
      }

      // Project Header Bar
      const projectHeader = main.createDiv({ cls: "ticktick-project-header" });
      const headerInfo = projectHeader.createDiv({ cls: "ticktick-project-header-info" });
      if (displayProject.color) {
        const pDot = headerInfo.createSpan({ cls: "ticktick-header-dot" });
        pDot.style.setProperty("--project-color", displayProject.color);
      }
      headerInfo.createEl("h2", { cls: "ticktick-project-title", text: displayProject.name });
      headerInfo.createSpan({
        cls: "ticktick-project-badge",
        text: `${virtualData ? virtualData.tasks.filter(task => Number(task.status ?? 0) === 0).length : project?.openCount ?? 0} تسک باز`
      });

      // Toolbar Controls
      const toolbar = projectHeader.createDiv({ cls: "ticktick-project-toolbar" });

      // Add Task Button (CTA)
      if (project) {
      const addTaskBtn = toolbar.createEl("button", {
        cls: "ticktick-toolbar-btn ticktick-toolbar-btn-cta",
        attr: { type: "button", "aria-label": "افزودن تسک جدید" }
      });
      const addIcon = addTaskBtn.createSpan({ cls: "ticktick-btn-icon" });
      setIcon(addIcon, "plus");
      addTaskBtn.createSpan({ cls: "ticktick-toolbar-btn-text", text: "افزودن تسک" });
      addTaskBtn.addEventListener("click", async () => {
        addTaskBtn.disabled = true;
        try {
          const created = await this.host.createTask({ projectId: project.id });
          if (!created) return;
          await this.host.refresh();
          await this.render();
          new Notice("تسک در این لیست اضافه شد.");
        } catch (error) {
          new Notice(error instanceof Error ? error.message : "افزودن تسک ناموفق بود.");
        } finally {
          addTaskBtn.disabled = false;
        }
      });
      }

      // Sort Menu Dropdown Pill
      const sortLabels: Record<string, string> = {
        ticktick: "ترتیب TickTick",
        time: "تاریخ/ساعت",
        priority: "اولویت",
        title: "عنوان"
      };
      const sortBtn = toolbar.createDiv({
        cls: "ticktick-filter-select-wrapper",
        attr: { role: "button", tabindex: "0", "aria-label": "مرتب‌سازی کارت‌های برد" }
      });
      const sortIcon = sortBtn.createSpan({ cls: "ticktick-select-icon" });
      setIcon(sortIcon, "arrow-up-down");
      sortBtn.createSpan({
        cls: "ticktick-filter-select-label",
        text: `مرتب‌سازی: ${sortLabels[this.sortMode] ?? "ترتیب TickTick"}`
      });
      const sortChevron = sortBtn.createSpan({ cls: "ticktick-select-chevron" });
      setIcon(sortChevron, "chevron-down");

      const openSortMenu = (event: MouseEvent | KeyboardEvent) => {
        const menu = new Menu();
        for (const [value, label] of [["ticktick", "ترتیب TickTick"], ["time", "تاریخ/ساعت"], ["priority", "اولویت"], ["title", "عنوان"]]) {
          menu.addItem(item => {
            item.setTitle(label)
                .setChecked(this.sortMode === value)
                .onClick(() => {
                  this.sortMode = value;
                  void this.render();
                });
          });
        }
        if (event instanceof MouseEvent) {
          menu.showAtMouseEvent(event);
        } else {
          const rect = sortBtn.getBoundingClientRect();
          menu.showAtPosition({ x: rect.right, y: rect.bottom });
        }
      };
      sortBtn.addEventListener("click", openSortMenu);
      sortBtn.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openSortMenu(event);
        }
      });

      // Refresh / Sync Button
      const refreshBtn = toolbar.createEl("button", {
        cls: "ticktick-toolbar-btn",
        attr: { type: "button", "aria-label": "همگام‌سازی و به‌روزرسانی" }
      });
      const refreshIcon = refreshBtn.createSpan({ cls: "ticktick-btn-icon" });
      setIcon(refreshIcon, "refresh-cw");
      refreshBtn.createSpan({ cls: "ticktick-toolbar-btn-text", text: "به‌روزرسانی" });
      refreshBtn.addEventListener("click", async () => {
        refreshBtn.disabled = true;
        refreshIcon.addClass("is-syncing");
        try {
          await this.host.refresh();
          await this.render();
        } catch (error) {
          new Notice(error instanceof Error ? error.message : "همگام‌سازی ناموفق بود.");
        } finally {
          refreshBtn.disabled = false;
          refreshIcon.removeClass("is-syncing");
        }
      });

      // Edit Project Button
      if (project) {
      const editBtn = toolbar.createEl("button", {
        cls: "ticktick-toolbar-btn",
        attr: { type: "button", "aria-label": "ویرایش لیست" }
      });
      const editIcon = editBtn.createSpan({ cls: "ticktick-btn-icon" });
      setIcon(editIcon, "pencil");
      editBtn.createSpan({ cls: "ticktick-toolbar-btn-text", text: "ویرایش" });
      editBtn.addEventListener("click", async () => {
        const draft = await new ProjectEditorModal(this.host.app, project).openAndWait();
        if (!draft) return;
        editBtn.disabled = true;
        try {
          await this.host.updateProject({ ...project, ...draft });
          await this.host.refresh();
          await this.render();
          new Notice("لیست در TickTick ویرایش شد.");
        } catch (error) {
          new Notice(error instanceof Error ? error.message : "ویرایش لیست ناموفق بود.");
        } finally {
          editBtn.disabled = false;
        }
      });

      // Delete Project Button
      const deleteBtn = toolbar.createEl("button", {
        cls: "ticktick-toolbar-btn ticktick-toolbar-btn-danger",
        attr: { type: "button", "aria-label": "حذف لیست" }
      });
      const deleteIcon = deleteBtn.createSpan({ cls: "ticktick-btn-icon" });
      setIcon(deleteIcon, "trash-2");
      deleteBtn.createSpan({ cls: "ticktick-toolbar-btn-text", text: "حذف" });
      deleteBtn.addEventListener("click", async () => {
        if (!window.confirm(`لیست «${project.name}» و تسک‌های آن در TickTick حذف شود؟`)) return;
        deleteBtn.disabled = true;
        try {
          await this.host.deleteProject(String(project.id));
          this.selected = "";
          await this.host.refresh();
          await this.persistAndRender();
          new Notice("لیست از TickTick حذف شد.");
        } catch (error) {
          deleteBtn.disabled = false;
          new Notice(error instanceof Error ? error.message : "حذف لیست ناموفق بود.");
        }
      });
      }

      // ── 3. Kanban Columns ──
      const data = virtualData ?? await this.host.board(project);
      const columns = main.createDiv({ cls: "ticktick-project-columns" });
      enhanceHorizontalScroll(columns);
      scrollToStart(columns);

      for (const column of boardColumns(data, this.host.showCompleted())) {
        const shell = columns.createDiv({ cls: "ticktick-project-column" });

        const colHeader = shell.createDiv({ cls: "ticktick-column-header" });
        colHeader.createEl("strong", { cls: "ticktick-column-name", text: column.name });
        colHeader.createSpan({ cls: "ticktick-column-count", text: String(column.count) });

        const movableColumn = Boolean(project) && !column.synthetic;
        if (column.synthetic) {
          shell.createEl("small", { cls: "ticktick-column-hint", text: "ستون نمایشی؛ جابه‌جایی غیرفعال است" });
        }

        shell.addEventListener("dragover", event => {
          if (!movableColumn) return;
          event.preventDefault();
          event.dataTransfer!.dropEffect = "move";
          shell.addClass("is-drag-over");
        });
        shell.addEventListener("dragleave", event => {
          if (!shell.contains(event.relatedTarget as Node | null)) shell.removeClass("is-drag-over");
        });
        shell.addEventListener("drop", event => {
          event.preventDefault();
          shell.removeClass("is-drag-over");
          if (!movableColumn) {
            new Notice("این ستون نمایشی است و مقصد انتقال نیست.");
            return;
          }
          const id = event.dataTransfer?.getData("text/ticktick-board-task");
          const task = data.tasks.find((item: any) => String(item.id) === id);
          if (!task || String(task.columnId ?? "") === String(column.id)) return;
          void this.moveTask(task, String(column.id));
        });

        const listWrap = shell.createDiv({ cls: "ticktick-column-cards" });
        for (const group of column.groups) {
          if (group.name) {
            listWrap.createEl("h4", { cls: "ticktick-group-heading", text: group.name });
          }
          for (const task of sortPlanningTasks(group.tasks, this.sortMode)) {
            this.card(listWrap, task, displayProject.color, Boolean(project));
          }
        }
      }
    } catch (error) {
      root.createEl("p", { text: error instanceof Error ? error.message : "دادهٔ پروژه در دسترس نیست." });
    }
  }

  private async persistAndRender() {
    await this.host.savePreferences({ selected: this.selected, collapsed: [...this.collapsed] });
    await this.render();
  }

  private card(parent: HTMLElement, task: any, projectColor?: string, movable = true) {
    const bound = this.host.binding(task);
    const priority = taskPriority(task.priority);
    const isCompleted = Number(task.status ?? 0) !== 0;

    const tone = projectColor || (
      Number(task.priority) === 5 ? "var(--color-red, #e74c3c)" :
      Number(task.priority) === 3 ? "var(--color-orange, #e67e22)" :
      Number(task.priority) === 1 ? "var(--color-blue, #3498db)" :
      "var(--interactive-accent)"
    );

    const card = parent.createDiv({
      cls: `ticktick-project-card priority-${priority.value} ${isCompleted ? "is-completed" : ""}`,
      attr: {
        role: "button",
        tabindex: "0",
        "aria-label": `جزئیات ${task.title}`,
        title: "برای دیدن جزئیات کلیک کنید"
      }
    });
    card.draggable = movable;
    card.style.setProperty("--ticktick-task-tone", tone);

    card.addEventListener("dragstart", event => {
      if (!movable) return;
      card.addClass("is-dragging");
      event.dataTransfer!.effectAllowed = "move";
      event.dataTransfer?.setData("text/ticktick-board-task", String(task.id));
    });
    card.addEventListener("dragend", () => card.removeClass("is-dragging"));

    // Top Row: Checkbox, Title, Priority Chip
    const top = card.createDiv({ cls: "ticktick-project-card-top" });
    const check = top.createEl("input", {
      type: "checkbox",
      cls: "ticktick-project-check",
      attr: { "aria-label": `تکمیل ${task.title}` }
    });
    check.checked = isCompleted;
    check.disabled = !bound || isCompleted;

    const titleEl = top.createDiv({
      cls: "ticktick-project-card-title",
      text: String(task.title ?? "بدون عنوان")
    });
    titleEl.addEventListener("click", event => {
      event.stopPropagation();
      details();
    });

    if (priority.value > 0) {
      top.createSpan({
        cls: `ticktick-project-priority ${priority.className}`,
        text: priority.label,
        attr: { title: `اولویت: ${priority.label}` }
      });
    }

    // Description
    const description = taskDescription(task);
    if (description) {
      card.createEl("small", { cls: "ticktick-project-card-desc", text: description.slice(0, 110) });
    }

    // Meta Row: Date, Repeat, Tags, Markdown Sync
    const hasDueDate = Boolean(task.dueDate);
    const hasRepeat = Boolean(task.repeatFlag);
    const tags = task.tags ?? [];
    if (hasDueDate || hasRepeat || tags.length > 0 || bound) {
      const meta = card.createDiv({ cls: "ticktick-project-card-meta" });
      if (hasDueDate) {
        const dueChip = meta.createSpan({ cls: "ticktick-meta-chip" });
        const dueIcon = dueChip.createSpan({ cls: "ticktick-meta-icon" });
        setIcon(dueIcon, "calendar");
        dueChip.createSpan({ text: formatPersianDate(task.dueDate, task.timeZone) });
      }
      if (hasRepeat) {
        const repChip = meta.createSpan({ cls: "ticktick-meta-chip" });
        const repIcon = repChip.createSpan({ cls: "ticktick-meta-icon" });
        setIcon(repIcon, "repeat");
        repChip.createSpan({ text: "تکرار" });
      }
      for (const tag of tags) {
        const tagChip = meta.createSpan({ cls: "ticktick-meta-chip ticktick-tag-chip" });
        tagChip.createSpan({ text: `#${tag}` });
      }
      if (bound) {
        const mdChip = meta.createSpan({ cls: "ticktick-meta-chip ticktick-bound-chip" });
        const mdIcon = mdChip.createSpan({ cls: "ticktick-meta-icon" });
        setIcon(mdIcon, "file-text");
        mdChip.createSpan({ text: "Markdown" });
      }
    }

    const details = () => new TaskDetailsModal(this.host.app, task, {
      complete: async () => { await this.host.complete(task); },
      load: item => this.host.load(item),
      edit: item => this.host.edit(item),
      changed: async () => {
        await this.host.refresh();
        await this.render();
      }
    }).open();

    card.addEventListener("click", details);
    card.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        details();
      }
    });

    check.addEventListener("click", event => event.stopPropagation());
    check.addEventListener("change", async () => {
      check.disabled = true;
      try {
        await this.host.complete(task);
        new Notice("تسک با مسیر امن Markdown sync تکمیل شد.");
        await this.render();
      } catch (error) {
        check.checked = false;
        check.disabled = false;
        new Notice(error instanceof Error ? error.message : "تکمیل ناموفق بود.");
      }
    });
  }

  private async moveTask(task: any, columnId: string) {
    try {
      await this.host.moveToColumn(task, columnId);
      new Notice("تسک به ستون جدید منتقل و با TickTick همگام شد.");
      await this.host.refresh();
      await this.render();
    } catch (error) {
      new Notice(error instanceof Error ? error.message : "انتقال تسک ناموفق بود.");
    }
  }
}
