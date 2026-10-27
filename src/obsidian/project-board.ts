import { App, Menu, Notice, setIcon } from "obsidian";
import { boardColumns, INBOX_BOARD_VIEW_ID, RECURRING_BOARD_VIEW_ID, sidebarTree, virtualBoardData, virtualBoardEntries } from "../core/project-board.js";
import { TaskDetailsModal } from "./task-details-modal";
import { taskPriority } from "./task-priority";
import { ProjectEditorModal } from "./project-editor-modal";
import { taskDescription } from "../core/task-description.js";
import { formatPersianDate } from "../core/persian-date.js";
import { sortPlanningTasks } from "../core/calendar-range.js";
import { enhanceHorizontalScroll, scrollToStart } from "./horizontal-scroll";
import { HabitDetailsModal } from "./planning-calendar";
import { renderUnifiedHabitCard } from "./habit-card";
import type { TickTickTask, TickTickProject, TickTickHabit, CachedHabitCheckin, ProjectBoardData, HabitHistoryEntry } from "./types";

const HABIT_BOARD_VIEW_ID = "ticktick:view:habits";

function habitGlyph(habit: Partial<TickTickHabit>) {
  const value = String(habit?.iconRes ?? habit?.icon ?? "").toLowerCase();
  if (/language|book|read|learn/.test(value)) return "📚";
  if (/sport|run|fitness|exercise/.test(value)) return "🏃";
  if (/meditat|mind|sleep/.test(value)) return "🧘";
  if (/water|drink/.test(value)) return "💧";
  if (/music|listen/.test(value)) return "🎵";
  if (/write|note/.test(value)) return "✍️";
  return "✓";
}

export type ProjectBoardHost = {
  app: App;
  projects: () => Promise<TickTickProject[]>;
  createProject: (project: Partial<TickTickProject>) => Promise<TickTickProject>;
  updateProject: (project: Partial<TickTickProject>) => Promise<unknown>;
  deleteProject: (projectId: string) => Promise<unknown>;
  createTask: (initial: Partial<TickTickTask>) => Promise<unknown>;
  tasks: () => TickTickTask[];
  habits: () => TickTickHabit[];
  checkInHabit: (habit: TickTickHabit, day: string) => Promise<unknown>;
  habitHistory: (habitId: string, from: string, to: string) => HabitHistoryEntry[];
  setHabitProgress: (habit: TickTickHabit, day: string, value: number, goal: number) => Promise<unknown>;
  firstWeekday: number;
  timeZone: string;
  board: (project: TickTickProject | undefined) => Promise<ProjectBoardData>;
  refresh: () => Promise<void>;
  complete: (task: TickTickTask) => Promise<unknown>;
  binding: (task: TickTickTask) => unknown;
  load: (task: TickTickTask) => Promise<TickTickTask | undefined>;
  edit: (task: TickTickTask) => Promise<unknown>;
  moveToColumn: (task: TickTickTask, columnId: string) => Promise<unknown>;
  showCompleted: () => boolean;
  preferences: () => { selected: string; collapsed: string[]; sidebarCollapsed?: boolean; sidebarPreferenceInitialized?: boolean };
  savePreferences: (value: { selected: string; collapsed: string[]; sidebarCollapsed: boolean; sidebarPreferenceInitialized?: boolean }) => Promise<void>;
};

export class ProjectBoard {
  private selected = "";
  private collapsed = new Set<string>();
  private initialized = false;
  private sortMode = "ticktick";
  private sidebarCollapsed = false;
  private lastSelectedProject: string | null = null;
  private savedColumnsScrollLeft = 0;

  constructor(private element: HTMLElement, private host: ProjectBoardHost) {}

  async render() {
    if (!this.initialized) {
      const saved = this.host.preferences();
      this.selected = saved.selected;
      this.collapsed = new Set(saved.collapsed);
      this.sidebarCollapsed = saved.sidebarPreferenceInitialized ? Boolean(saved.sidebarCollapsed) : true;
      this.initialized = true;
      if (!saved.sidebarPreferenceInitialized) void this.host.savePreferences({ selected: this.selected, collapsed: [...this.collapsed], sidebarCollapsed: true, sidebarPreferenceInitialized: true });
    }

    const existingCols = this.element.querySelector<HTMLElement>(".ticktick-project-columns");
    this.savedColumnsScrollLeft = existingCols?.scrollLeft ?? 0;
    this.element.empty();
    this.element.addClass("ticktick-project-board");
    const root = this.element.createDiv({ cls: "ticktick-project-board-root" });

    try {
      const projects = await this.host.projects();
      // The board opens focused on a real list.  "همهٔ لیست‌ها" was a
      // confusing synthetic board and is intentionally no longer shown.
      if (!this.selected || this.selected === "ticktick:view:all") this.selected = String(projects[0]?.id ?? INBOX_BOARD_VIEW_ID);

      // ── 1. Sidebar Rail ──
      const rail = root.createDiv({ cls: `ticktick-project-rail ${this.sidebarCollapsed ? "is-collapsed" : ""}` });
      root.toggleClass("is-rail-collapsed", this.sidebarCollapsed);

      const railHeader = rail.createDiv({ cls: "ticktick-rail-header" });
      const headerIcon = railHeader.createSpan({ cls: "ticktick-rail-icon" });
      setIcon(headerIcon, "folders");
      railHeader.createSpan({ text: "پروژه‌ها و لیست‌ها" });
      const collapseBtn = railHeader.createEl("button", { cls: "ticktick-rail-collapse", attr: { type: "button", "aria-label": this.sidebarCollapsed ? "باز کردن فهرست" : "جمع کردن فهرست" } });
      setIcon(collapseBtn, this.sidebarCollapsed ? "panel-right-open" : "panel-right-close");
      collapseBtn.addEventListener("click", () => { this.sidebarCollapsed = !this.sidebarCollapsed; void this.persistAndRender(); });

      if (this.sidebarCollapsed) {
        rail.createEl("button", { cls: "ticktick-rail-expand-label", text: "لیست‌ها", attr: { type: "button" } }).addEventListener("click", () => { this.sidebarCollapsed = false; void this.persistAndRender(); });
      } else {

      const virtual = virtualBoardEntries(this.host.tasks());
      const inbox = rail.createEl("button", { cls: `ticktick-project-row ${this.selected === INBOX_BOARD_VIEW_ID ? "is-selected" : ""}`, attr: { type: "button", "aria-label": `ورودی، ${virtual.inbox.count} تسک باز` } });
      const inboxIcon = inbox.createSpan({ cls: "ticktick-project-row-icon" });
      setIcon(inboxIcon, "inbox");
      inbox.createSpan({ cls: "ticktick-project-name", text: "ورودی" });
      inbox.createSpan({ cls: "ticktick-project-count", text: String(virtual.inbox.count) });
      inbox.addEventListener("click", () => { this.selected = INBOX_BOARD_VIEW_ID; void this.persistAndRender(); });
      const habits = rail.createEl("button", { cls: `ticktick-project-row ${this.selected === HABIT_BOARD_VIEW_ID ? "is-selected" : ""}`, attr: { type: "button", "aria-label": `عادت‌ها، ${this.host.habits().length} عادت` } });
      const habitsIcon = habits.createSpan({ cls: "ticktick-project-row-icon" });
      setIcon(habitsIcon, "activity");
      habits.createSpan({ cls: "ticktick-project-name", text: "عادت‌ها" });
      habits.createSpan({ cls: "ticktick-project-count", text: String(this.host.habits().length) });
      habits.addEventListener("click", () => { this.selected = HABIT_BOARD_VIEW_ID; void this.persistAndRender(); });
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
      }

      // ── 2. Main Board Area ──
      const main = root.createDiv({ cls: "ticktick-project-main" });

      if (this.selected === HABIT_BOARD_VIEW_ID) {
        this.renderHabitBoard(main);
        return;
      }

      const project = projects.find(item => String(item.id) === this.selected);
      const virtualData = virtualBoardData(this.selected, this.host.tasks(), projects);
      const displayProject = (virtualData?.project ?? project) as TickTickProject | undefined;
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
      const data = virtualData ?? await this.host.board(project!);
      if (!data) return;
      const columns = main.createDiv({ cls: "ticktick-project-columns" });
      enhanceHorizontalScroll(columns);
      if (this.lastSelectedProject === this.selected && this.savedColumnsScrollLeft > 0) {
        columns.scrollLeft = this.savedColumnsScrollLeft;
      } else {
        scrollToStart(columns);
      }
      this.lastSelectedProject = this.selected;

      for (const column of boardColumns(data, this.host.showCompleted())) {
        const shell = columns.createDiv({ cls: "ticktick-project-column" });
        shell.dataset.columnId = String(column.id);

        const colHeader = shell.createDiv({ cls: "ticktick-column-header" });
        colHeader.createEl("strong", { cls: "ticktick-column-name", text: column.name });
        colHeader.createSpan({ cls: "ticktick-column-count", text: String(column.count) });

        const movableColumn = Boolean(project) && !column.synthetic;
        if (movableColumn) {
          const addToColumn = colHeader.createEl("button", { cls: "ticktick-column-add mod-icon", attr: { type: "button", "aria-label": `افزودن تسک به ستون ${column.name}`, title: "افزودن تسک به این ستون" } });
          setIcon(addToColumn, "plus");
          addToColumn.addEventListener("click", async event => {
            event.stopPropagation(); addToColumn.disabled = true;
            try {
              await this.host.createTask({ projectId: project!.id, columnId: column.id });
              new Notice(`تسک جدید به ستون «${column.name}» اضافه شد.`);
              await this.render();
            } catch (error) {
              new Notice(error instanceof Error ? error.message : "ساخت تسک ناموفق بود.");
            } finally { addToColumn.disabled = false; }
          });
        }
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
          const task = data.tasks.find((item: TickTickTask) => String(item.id) === id);
          if (!task || String(task.columnId ?? "") === String(column.id)) return;
          const cardEl = this.element.querySelector<HTMLElement>(`[data-task-id="${task.id}"]`);
          const sourceCol = cardEl?.closest(".ticktick-project-column");
          const oldColumnId = task.columnId;
          if (cardEl && listWrap) {
            listWrap.appendChild(cardEl);
            const srcBadge = sourceCol?.querySelector(".ticktick-column-count");
            if (srcBadge) {
              const count = parseInt(srcBadge.textContent || "0", 10);
              if (count > 0) srcBadge.textContent = String(count - 1);
            }
            const tgtBadge = shell.querySelector(".ticktick-column-count");
            if (tgtBadge) {
              const count = parseInt(tgtBadge.textContent || "0", 10);
              tgtBadge.textContent = String(count + 1);
            }
          }
          task.columnId = String(column.id);
          void this.moveTask(task, String(column.id), cardEl, sourceCol, oldColumnId);
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
    await this.host.savePreferences({ selected: this.selected, collapsed: [...this.collapsed], sidebarCollapsed: this.sidebarCollapsed, sidebarPreferenceInitialized: true });
    await this.render();
  }

  private renderHabitBoard(main: HTMLElement) {
    const habits = this.host.habits();
    const header = main.createDiv({ cls: "ticktick-project-header" });
    const info = header.createDiv({ cls: "ticktick-project-header-info" });
    info.createEl("h2", { cls: "ticktick-project-title", text: "عادت‌ها" });
    info.createSpan({ cls: "ticktick-project-badge", text: `${habits.length} عادت` });
    const cards = main.createDiv({ cls: "ticktick-habit-board-cards" });
    if (!habits.length) { cards.createDiv({ cls: "ticktick-board-empty", text: "عادتی در کش محلی نیست؛ یک بار همگام‌سازی کنید." }); return; }
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: this.host.timeZone }).format(new Date());
for (const habit of habits) {
      const goal = Math.max(1, Number(habit.goal ?? habit.target ?? 1));
      const entry = (this.host.habitHistory(String(habit.id), today, today)[0] ?? {});
      const value = Number(entry.value ?? 0);
      const completed = entry.completed || value >= goal;
      const habitWithCheckin: TickTickHabit = {
        ...habit,
        checkin: {
          value,
          goal,
          status: completed ? 2 : 0,
          ...habit.checkin
        }
      };
      renderUnifiedHabitCard(cards, {
        habit: habitWithCheckin,
        day: today,
        variant: "board",
        onCheckIn: async (h, d) => {
          await this.host.checkInHabit(h, d);
          await this.render();
        },
        onOpenDetails: (h, d) => {
          new HabitDetailsModal(this.host.app, habit, {
            firstWeekday: this.host.firstWeekday,
            habits: day => this.host.habits().filter(item => String(item.id) === String(habit.id) || false),
            habitHistory: this.host.habitHistory,
            setHabitProgress: this.host.setHabitProgress,
          }, d).open();
        }
      });
    }
  }

  private card(parent: HTMLElement, task: TickTickTask, projectColor?: string, movable = true) {
    const bound = this.host.binding(task);
    const priority = taskPriority(task.priority);
    const isNote = String(task.kind ?? task.type ?? task.taskType ?? "").toUpperCase() === "NOTE";
    const isPinned = Boolean(task.pinned ?? task.isPinned ?? task.pin ?? task.pinnedTime ?? task.pinnedAt ?? task.pinTime);
    const isCompleted = Number(task.status ?? 0) !== 0;

    const tone = projectColor || (
      Number(task.priority) === 5 ? "var(--color-red, #e74c3c)" :
      Number(task.priority) === 3 ? "var(--color-orange, #e67e22)" :
      Number(task.priority) === 1 ? "var(--color-blue, #3498db)" :
      "var(--interactive-accent)"
    );

    const card = parent.createDiv({
      cls: `ticktick-project-card priority-${priority.value} ${isCompleted ? "is-completed" : ""} ${isNote ? "is-note" : ""}`,
      attr: {
        role: "button",
        tabindex: "0",
        "aria-label": `جزئیات ${task.title}`,
        title: "برای دیدن جزئیات کلیک کنید"
      }
    });
    card.dataset.taskId = String(task.id);
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
    const check = isNote ? null : top.createEl("input", {
      type: "checkbox", cls: "ticktick-project-check", attr: { "aria-label": `تکمیل ${task.title}` }
    });
    if (check) {
      check.checked = isCompleted;
      check.disabled = isCompleted;
      check.setAttribute("draggable", "false");
    }
    if (isNote) {
      const noteIcon = top.createSpan({ cls: "ticktick-project-note-icon", attr: { title: "یادداشت TickTick" } });
      setIcon(noteIcon, "file-text");
    }

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
    if (isPinned) {
      const pin = top.createSpan({ cls: "ticktick-project-pin", attr: { title: "پین‌شده" } });
      setIcon(pin, "pin");
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
      complete: async () => {
        await this.host.complete(task);
        await this.render();
      },
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

    check?.addEventListener("mousedown", event => event.stopPropagation());
    check?.addEventListener("click", event => event.stopPropagation());
    check?.addEventListener("change", async () => {
      check.disabled = true;
      card.addClass("is-completed");
      const hideCompleted = !this.host.showCompleted();
      if (hideCompleted) {
        card.addClass("is-leaving");
      }
      try {
        await this.host.complete(task);
        task.status = 2;
        new Notice(bound ? "تسک در فایل مارک‌داون و TickTick تکمیل شد." : "تسک در TickTick تکمیل شد.");
        if (hideCompleted) {
          setTimeout(() => {
            const col = card.closest(".ticktick-project-column");
            const badge = col?.querySelector(".ticktick-column-count");
            card.remove();
            if (badge) {
              const current = parseInt(badge.textContent || "0", 10);
              if (current > 0) badge.textContent = String(current - 1);
            }
          }, 220);
        }
      } catch (error) {
        card.removeClass("is-completed");
        card.removeClass("is-leaving");
        check.checked = false;
        check.disabled = false;
        new Notice(error instanceof Error ? error.message : "تکمیل ناموفق بود.");
      }
    });
  }

  private async moveTask(
    task: TickTickTask,
    columnId: string,
    optimisticCard?: HTMLElement | null,
    sourceCol?: Element | null,
    oldColumnId?: string | null
  ) {
    try {
      await this.host.moveToColumn(task, columnId);
      new Notice("تسک به ستون جدید منتقل و با TickTick همگام شد.");
    } catch (error) {
      if (optimisticCard && sourceCol) {
        const srcList = sourceCol.querySelector(".ticktick-column-cards");
        srcList?.appendChild(optimisticCard);
        task.columnId = oldColumnId;
      }
      new Notice(error instanceof Error ? error.message : "انتقال تسک ناموفق بود.");
    }
  }
}
