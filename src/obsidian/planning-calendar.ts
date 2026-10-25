import { App, Menu, Modal, Notice, setIcon } from "obsidian";
import { isSamePersianMonth, persianMonthRange, shiftCalendarDay, shiftPersianMonth, taskDateRange, tasksForCalendarDay, weekRange } from "../core/calendar-range.js";
import { formatPersianDate } from "../core/persian-date.js";
import { todayInZone } from "../core/date.js";
import { TaskDetailsModal } from "./task-details-modal";
import { taskPriority } from "./task-priority";
import { enhanceHorizontalScroll, scrollToStart } from "./horizontal-scroll";

type PlannerHost = {
  app: App;
  timeZone: string;
  firstWeekday: number;
  showCompleted: boolean;
  tasks: () => any[];
  refresh: () => Promise<void>;
  reschedule: (task: any, day: string) => Promise<any>;
  complete: (task: any) => Promise<any>;
  binding: (task: any) => any;
  load: (task: any) => Promise<any>;
  edit: (task: any) => Promise<any>;
  create: (initial: any) => Promise<any>;
};

type Mode = "day" | "week" | "month";
type ColorMode = "project" | "tag" | "priority" | "uniform";

function formatTaskTime(task: any, timeZone: string): string | null {
  if (task.isAllDay) return null;
  const raw = task.startDate ?? task.dueDate;
  if (!raw || !String(raw).includes("T")) return null;
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return null;
    return new Intl.DateTimeFormat("fa-IR", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
  } catch {
    const m = String(raw).match(/T(\d{2}:\d{2})/);
    return m ? m[1] : null;
  }
}

class PlannerMultiSelectModal extends Modal {
  private answer?: Set<string>;
  constructor(app: App, private label: string, private values: string[], private selected: Set<string>, private prefix = "") {
    super(app);
  }

  openAndWait() {
    this.open();
    return new Promise<Set<string> | undefined>(resolve => {
      this.onClose = () => {
        this.contentEl.empty();
        resolve(this.answer);
      };
    });
  }

  onOpen() {
    this.modalEl.addClass("ticktick-filter-modal-dialog");
    this.titleEl.setText(`فیلتر ${this.label}`);
    const choices = new Set(this.selected);

    const searchBox = this.contentEl.createDiv({ cls: "ticktick-filter-search-box" });
    const searchInput = searchBox.createEl("input", {
      type: "search",
      placeholder: `جستجو در ${this.label}…`,
      cls: "ticktick-filter-search-input"
    });

    const list = this.contentEl.createDiv({ cls: "ticktick-planner-filter-modal" });

    const renderList = (filterText = "") => {
      list.empty();
      const filtered = this.values.filter(v => !filterText || v.toLowerCase().includes(filterText.toLowerCase()));
      if (!filtered.length) {
        list.createDiv({ cls: "ticktick-filter-empty", text: "موردی پیدا نشد" });
        return;
      }
      for (const value of filtered) {
        const row = list.createEl("label", { cls: "ticktick-filter-item" });
        const check = row.createEl("input", { type: "checkbox", cls: "ticktick-filter-checkbox" });
        check.checked = choices.has(value);
        row.createSpan({ cls: "ticktick-filter-item-text", text: `${this.prefix}${value}` });
        check.addEventListener("change", () => {
          check.checked ? choices.add(value) : choices.delete(value);
        });
      }
    };

    searchInput.addEventListener("input", () => renderList(searchInput.value.trim()));
    renderList();

    const actions = this.contentEl.createDiv({ cls: "modal-button-container ticktick-filter-actions" });
    const selectAllBtn = actions.createEl("button", { text: "انتخاب همه", cls: "ticktick-filter-quick-btn" });
    selectAllBtn.addEventListener("click", () => {
      this.values.forEach(v => choices.add(v));
      renderList(searchInput.value.trim());
    });

    const clearBtn = actions.createEl("button", { text: "حذف همه", cls: "ticktick-filter-quick-btn" });
    clearBtn.addEventListener("click", () => {
      choices.clear();
      renderList(searchInput.value.trim());
    });

    actions.createEl("button", { text: "لغو" }).addEventListener("click", () => this.close());
    actions.createEl("button", { text: "اعمال فیلتر", cls: "mod-cta" }).addEventListener("click", () => {
      this.answer = choices;
      this.close();
    });
  }
}

class TaskOverflowModal extends Modal {
  constructor(
    app: App,
    private tasks: any[],
    private complete: (task: any) => Promise<any>,
    private load: (task: any) => Promise<any>,
    private edit: (task: any) => Promise<any>,
    private changed: () => Promise<void>,
    private dayLabel?: string
  ) {
    super(app);
  }

  onOpen() {
    this.modalEl.addClass("ticktick-overflow-modal");
    this.titleEl.setText(this.dayLabel ? `تسک‌های ${this.dayLabel}` : "تسک‌های این روز");

    const container = this.contentEl.createDiv({ cls: "ticktick-overflow-list" });
    for (const task of this.tasks) {
      const priority = taskPriority(task.priority);
      const isCompleted = Number(task.status ?? 0) !== 0;
      const tone = task.projectColor || (
        Number(task.priority) === 5 ? "var(--color-red)" :
        Number(task.priority) === 3 ? "var(--color-orange)" :
        Number(task.priority) === 1 ? "var(--color-blue)" :
        "var(--interactive-accent)"
      );

      const row = container.createDiv({
        cls: `ticktick-overflow-task priority-${priority.value} ${isCompleted ? "is-completed" : ""}`,
        attr: { role: "button", tabindex: "0" }
      });
      row.style.setProperty("--ticktick-task-tone", tone);

      const openDetails = () => new TaskDetailsModal(this.app, task, {
        complete: () => this.complete(task),
        load: this.load,
        edit: this.edit,
        changed: this.changed
      }).open();

      row.addEventListener("click", openDetails);
      row.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openDetails();
        }
      });

      const check = row.createEl("input", { type: "checkbox", cls: "ticktick-overflow-check", attr: { "aria-label": `تکمیل ${task.title}` } });
      check.checked = isCompleted;
      check.disabled = isCompleted;
      check.addEventListener("click", e => e.stopPropagation());

      const main = row.createDiv({ cls: "ticktick-overflow-task-main" });
      const titleEl = main.createDiv({
        text: String(task.title ?? "بدون عنوان"),
        cls: "ticktick-overflow-task-title"
      });
      titleEl.addEventListener("click", event => {
        event.stopPropagation();
        openDetails();
      });

      if (task.projectName) {
        main.createSpan({ cls: "ticktick-overflow-task-project", text: task.projectName });
      }

      check.addEventListener("change", async () => {
        check.disabled = true;
        try {
          await this.complete(task);
          task.status = 2;
          await this.changed();
          new Notice("تسک تکمیل و همگام شد.");
        } catch (error) {
          check.checked = false;
          check.disabled = false;
          new Notice(error instanceof Error ? error.message : "تکمیل تسک ناموفق بود.");
        }
      });
    }
  }

  onClose() {
    this.contentEl.empty();
  }
}

export class PlanningCalendar {
  private mode: Mode = "week";
  private day: string;
  private projects = new Set<string>();
  private tags = new Set<string>();
  private sortMode = "ticktick";
  private colorMode: ColorMode = "project";
  private draggingTaskId = "";

  constructor(private element: HTMLElement, private host: PlannerHost) {
    this.day = todayInZone(host.timeZone);
  }

  async render() {
    this.element.empty();
    this.element.addClass("ticktick-planner");

    const root = this.element.createDiv({ cls: "ticktick-planner-root" });
    const controls = root.createDiv({ cls: "ticktick-planner-controls" });

    // 1. Mode Segmented Control
    const modesContainer = controls.createDiv({ cls: "ticktick-planner-modes" });
    for (const [mode, label, icon] of [["day", "روز", "calendar"], ["week", "هفته", "calendar-days"], ["month", "ماه", "calendar-range"]] as Array<[Mode, string, string]>) {
      const button = modesContainer.createEl("button", {
        cls: `ticktick-planner-mode-btn ${this.mode === mode ? "is-active" : ""}`,
        attr: { type: "button" }
      });
      const iconSpan = button.createSpan({ cls: "ticktick-mode-icon" });
      setIcon(iconSpan, icon);
      button.createSpan({ text: label });
      button.addEventListener("click", () => {
        this.mode = mode;
        void this.render();
      });
    }

    // 2. Date Navigation Controls
    const nav = controls.createDiv({ cls: "ticktick-planner-nav" });
    const step = this.mode === "week" ? 7 : 1;

    // Previous button (in RTL, moving backwards in time is chevron-right)
    const prevBtn = nav.createEl("button", {
      cls: "ticktick-nav-btn mod-icon",
      text: "›",
      attr: { type: "button", "aria-label": "قبلی" }
    });
    prevBtn.addEventListener("click", () => {
      this.day = this.mode === "month" ? shiftPersianMonth(this.day, -1) : shiftCalendarDay(this.day, -step);
      void this.render();
    });

    const todayBtn = nav.createEl("button", {
      cls: "ticktick-nav-today-btn",
      text: "امروز",
      attr: { type: "button" }
    });
    todayBtn.addEventListener("click", () => {
      this.day = todayInZone(this.host.timeZone);
      void this.render();
    });

    // Next button (in RTL, moving forward in time is chevron-left)
    const nextBtn = nav.createEl("button", {
      cls: "ticktick-nav-btn mod-icon",
      text: "‹",
      attr: { type: "button", "aria-label": "بعدی" }
    });
    nextBtn.addEventListener("click", () => {
      this.day = this.mode === "month" ? shiftPersianMonth(this.day, 1) : shiftCalendarDay(this.day, step);
      void this.render();
    });

    const titleFormatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian", this.mode === "month"
      ? { year: "numeric", month: "long" }
      : this.mode === "week"
        ? { year: "numeric", month: "long" }
        : { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    nav.createEl("span", {
      cls: "ticktick-planner-date-title",
      text: titleFormatter.format(new Date(`${this.day}T12:00:00Z`))
    });

    // 3. Actions Toolbar
    const actionsGroup = controls.createDiv({ cls: "ticktick-planner-actions" });

    const addBtn = actionsGroup.createEl("button", {
      cls: "ticktick-planner-add-btn mod-cta",
      attr: { type: "button" }
    });
    const addIcon = addBtn.createSpan({ cls: "ticktick-btn-icon" });
    setIcon(addIcon, "plus");
    addBtn.createSpan({ text: "افزودن تسک" });
    addBtn.addEventListener("click", () => void this.addTask(this.day));

    const refreshBtn = actionsGroup.createEl("button", {
      cls: "ticktick-planner-sync-btn",
      attr: { type: "button", "aria-label": "همگام‌سازی" }
    });
    const syncIcon = refreshBtn.createSpan({ cls: "ticktick-btn-icon" });
    setIcon(syncIcon, "refresh-cw");
    refreshBtn.createSpan({ text: "همگام‌سازی" });
    refreshBtn.addEventListener("click", async () => {
      refreshBtn.disabled = true;
      refreshBtn.addClass("is-syncing");
      try {
        await this.host.refresh();
        await this.render();
      } catch (error) {
        new Notice(error instanceof Error ? error.message : "همگام‌سازی ناموفق بود.");
      } finally {
        refreshBtn.disabled = false;
        refreshBtn.removeClass("is-syncing");
      }
    });

    // 4. Filters Bar
    this.renderFilters(root);

    // 5. Tasks & Grid
    const tasks = this.filteredTasks();
    if (!tasks.length) {
      const emptyBox = root.createDiv({ cls: "ticktick-planner-empty" });
      emptyBox.createEl("p", { text: "تسکی برای نمایش در این بازه یا فیلتر یافت نشد." });
      emptyBox.createEl("small", { text: "می‌توانید با دکمهٔ «افزودن تسک» برنامه جدیدی بسازید." });
    }

    if (this.mode === "month") {
      this.renderMonth(root, tasks);
    } else {
      this.renderDays(root, this.mode === "week" ? weekRange(this.day, this.host.firstWeekday) : [this.day], tasks);
    }
  }

  private renderFilters(root: HTMLElement) {
    const filters = root.createDiv({ cls: "ticktick-planner-filters" });
    const tasks = this.host.tasks();

    // Sort Menu Button
    const sortLabels: Record<string, string> = {
      ticktick: "ترتیب TickTick",
      time: "ساعت",
      priority: "اولویت",
      title: "عنوان"
    };
    const sortBtn = filters.createDiv({
      cls: "ticktick-filter-select-wrapper",
      attr: { role: "button", tabindex: "0", "aria-label": "مرتب‌سازی تسک‌ها" }
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
      for (const [value, label] of [["ticktick", "ترتیب TickTick"], ["time", "ساعت"], ["priority", "اولویت"], ["title", "عنوان"]]) {
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

    // Color Mode Menu Button
    const colorLabels: Record<string, string> = {
      project: "رنگ: پروژه",
      tag: "رنگ: برچسب",
      priority: "رنگ: اولویت",
      uniform: "رنگ: یکدست"
    };
    const colorBtn = filters.createDiv({
      cls: "ticktick-filter-select-wrapper",
      attr: { role: "button", tabindex: "0", "aria-label": "رنگ‌بندی تسک‌ها" }
    });
    const colorIcon = colorBtn.createSpan({ cls: "ticktick-select-icon" });
    setIcon(colorIcon, "palette");
    colorBtn.createSpan({
      cls: "ticktick-filter-select-label",
      text: colorLabels[this.colorMode] ?? "رنگ: پروژه"
    });
    const colorChevron = colorBtn.createSpan({ cls: "ticktick-select-chevron" });
    setIcon(colorChevron, "chevron-down");

    const openColorMenu = (event: MouseEvent | KeyboardEvent) => {
      const menu = new Menu();
      for (const [value, label] of [["project", "رنگ: پروژه"], ["tag", "رنگ: برچسب"], ["priority", "رنگ: اولویت"], ["uniform", "رنگ: یکدست"]] as Array<[ColorMode, string]>) {
        menu.addItem(item => {
          item.setTitle(label)
              .setChecked(this.colorMode === value)
              .onClick(() => {
                this.colorMode = value;
                void this.render();
              });
        });
      }
      if (event instanceof MouseEvent) {
        menu.showAtMouseEvent(event);
      } else {
        const rect = colorBtn.getBoundingClientRect();
        menu.showAtPosition({ x: rect.right, y: rect.bottom });
      }
    };
    colorBtn.addEventListener("click", openColorMenu);
    colorBtn.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openColorMenu(event);
      }
    });

    // Project filter button
    const projects = [...new Set(tasks.map(task => String(task.projectName ?? task.projectId ?? "ورودی")))].sort((left, right) => left.localeCompare(right, "fa"));
    const projectBtn = filters.createEl("button", {
      cls: `ticktick-filter-chip ${this.projects.size ? "is-filtered" : ""}`,
      attr: { type: "button" }
    });
    const folderIcon = projectBtn.createSpan({ cls: "ticktick-chip-icon" });
    setIcon(folderIcon, "folder");
    projectBtn.createSpan({ text: this.projects.size ? `پروژه (${this.projects.size})` : "پروژه‌ها" });
    projectBtn.addEventListener("click", async () => {
      const value = await new PlannerMultiSelectModal(this.host.app, "پروژه‌ها", projects, this.projects).openAndWait();
      if (value) {
        this.projects = value;
        await this.render();
      }
    });

    // Tag filter button
    const tags = [...new Set(tasks.flatMap(task => task.tags ?? []).map(String))].sort((left, right) => left.localeCompare(right, "fa"));
    const tagBtn = filters.createEl("button", {
      cls: `ticktick-filter-chip ${this.tags.size ? "is-filtered" : ""}`,
      attr: { type: "button" }
    });
    const tagIcon = tagBtn.createSpan({ cls: "ticktick-chip-icon" });
    setIcon(tagIcon, "tag");
    tagBtn.createSpan({ text: this.tags.size ? `برچسب (${this.tags.size})` : "برچسب‌ها" });
    tagBtn.addEventListener("click", async () => {
      const value = await new PlannerMultiSelectModal(this.host.app, "برچسب‌ها", tags, this.tags, "#").openAndWait();
      if (value) {
        this.tags = value;
        await this.render();
      }
    });

    // Clear filters button
    if (this.projects.size || this.tags.size) {
      const clear = filters.createEl("button", {
        cls: "ticktick-filter-clear-btn",
        attr: { type: "button", "aria-label": "پاک‌کردن فیلترها" }
      });
      const clearIcon = clear.createSpan({ cls: "ticktick-chip-icon" });
      setIcon(clearIcon, "x");
      clear.createSpan({ text: "پاک‌کردن فیلترها" });
      clear.addEventListener("click", () => {
        this.projects.clear();
        this.tags.clear();
        void this.render();
      });
    }
  }

  private filteredTasks() {
    return this.host.tasks().filter(task =>
      (!this.projects.size || this.projects.has(String(task.projectName ?? task.projectId ?? "ورودی"))) &&
      (!this.tags.size || (task.tags ?? []).some((tag: any) => this.tags.has(String(tag))))
    );
  }

  private renderDays(root: HTMLElement, days: string[], tasks: any[]) {
    const today = todayInZone(this.host.timeZone);
    const grid = root.createDiv({ cls: `ticktick-planner-days ticktick-planner-days-${days.length}` });
    enhanceHorizontalScroll(grid);
    scrollToStart(grid);
    this.bindCalendarDrop(grid, tasks);
    const showRangeBars = days.length > 1;

    const shell = grid.createDiv({ cls: "ticktick-planner-days-shell" });
    const headers = shell.createDiv({ cls: "ticktick-planner-days-headers" });

    for (const day of days) {
      const isToday = day === today;
      const header = headers.createDiv({ cls: `ticktick-planner-day-header ${isToday ? "is-today" : ""}`, attr: { "data-day": day } });

      const dayTop = header.createDiv({ cls: "ticktick-planner-day-top" });
      const weekdayName = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { weekday: "long" }).format(new Date(`${day}T12:00:00Z`));
      dayTop.createSpan({ cls: "ticktick-planner-day-name", text: weekdayName });

      if (isToday) {
        dayTop.createSpan({ cls: "ticktick-today-pill", text: "امروز" });
      }

      const dayDateWrapper = header.createDiv({ cls: "ticktick-planner-day-date-wrap" });
      const dayNumber = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { day: "numeric" }).format(new Date(`${day}T12:00:00Z`));
      const monthName = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { month: "short" }).format(new Date(`${day}T12:00:00Z`));
      dayDateWrapper.createSpan({ cls: `ticktick-day-num-badge ${isToday ? "is-today-badge" : ""}`, text: dayNumber });
      dayDateWrapper.createSpan({ cls: "ticktick-month-name", text: monthName });

      const items = tasksForCalendarDay(tasks, day, this.host.timeZone, this.host.showCompleted, this.sortMode);
      const dayBottom = header.createDiv({ cls: "ticktick-planner-day-bottom" });
      dayBottom.createSpan({ cls: "ticktick-planner-counter", text: `${items.length} تسک` });

      const add = dayBottom.createEl("button", {
        cls: "ticktick-planner-add",
        attr: { type: "button", "aria-label": `افزودن تسک در ${day}` }
      });
      setIcon(add, "plus");
      add.createSpan({ text: "افزودن" });
      add.addEventListener("click", () => void this.addTask(day));
    }

    const body = shell.createDiv({ cls: "ticktick-planner-days-body" });
    if (showRangeBars) this.renderRangeLanes(body, days, tasks, "ticktick-planner-range-lanes");
    const columns = body.createDiv({ cls: "ticktick-planner-day-columns" });

    for (const day of days) {
      const isToday = day === today;
      const column = columns.createDiv({ cls: `ticktick-planner-day ${isToday ? "is-today" : ""}`, attr: { "data-day": day } });
      const items = tasksForCalendarDay(tasks, day, this.host.timeZone, this.host.showCompleted, this.sortMode);

      column.addEventListener("dragover", event => {
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
        column.addClass("is-drag-over");
      });
      column.addEventListener("dragleave", () => {
        column.removeClass("is-drag-over");
      });
      column.addEventListener("drop", event => {
        event.preventDefault();
        column.removeClass("is-drag-over");
        const task = this.draggedTask(event, tasks);
        if (task) void this.dropTask(task, day);
      });

      const singleDayTasks = items.filter(item => !showRangeBars || !taskDateRange(item, this.host.timeZone));
      if (!singleDayTasks.length) {
        const emptyHint = column.createDiv({ cls: "ticktick-planner-day-empty" });
        emptyHint.createSpan({ text: "تسکی نیست" });
      } else {
        for (const task of singleDayTasks) this.renderTask(column, task);
      }
    }
  }

  private renderMonth(root: HTMLElement, tasks: any[]) {
    const today = todayInZone(this.host.timeZone);
    const grid = root.createDiv({ cls: "ticktick-planner-month" });
    enhanceHorizontalScroll(grid);
    scrollToStart(grid);
    this.bindCalendarDrop(grid, tasks);
    const days = persianMonthRange(this.day, this.host.firstWeekday);

    // Weekday name bar at top of month view
    const weekdayBar = grid.createDiv({ cls: "ticktick-planner-month-weekdays-bar" });
    const sampleWeek = days.slice(0, 7);
    for (const sampleDay of sampleWeek) {
      const weekdayName = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { weekday: "long" }).format(new Date(`${sampleDay}T12:00:00Z`));
      weekdayBar.createDiv({ cls: "ticktick-planner-month-weekday-cell", text: weekdayName });
    }

    for (let index = 0; index < days.length; index += 7) {
      const weekDays = days.slice(index, index + 7);
      const week = grid.createDiv({ cls: "ticktick-planner-month-week" });
      const headers = week.createDiv({ cls: "ticktick-planner-month-headers" });

      for (const day of weekDays) {
        const isToday = day === today;
        const isOutside = !isSamePersianMonth(day, this.day);
        const header = headers.createDiv({
          cls: `ticktick-planner-month-header ${isOutside ? "is-outside" : ""} ${isToday ? "is-today" : ""}`,
          attr: { "data-day": day }
        });

        const numWrapper = header.createDiv({ cls: "ticktick-month-num-wrap" });
        const dayNum = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { day: "numeric" }).format(new Date(`${day}T12:00:00Z`));
        numWrapper.createSpan({ cls: `ticktick-day-num-badge ${isToday ? "is-today-badge" : ""}`, text: dayNum });

        const items = tasksForCalendarDay(tasks, day, this.host.timeZone, this.host.showCompleted, this.sortMode);
        if (items.length) {
          header.createSpan({ cls: "ticktick-planner-counter", text: String(items.length) });
        }

        const add = header.createEl("button", {
          cls: "ticktick-planner-add mod-icon",
          attr: { type: "button", "aria-label": `افزودن تسک در ${day}` }
        });
        setIcon(add, "plus");
        add.addEventListener("click", e => {
          e.stopPropagation();
          void this.addTask(day);
        });
      }

      const body = week.createDiv({ cls: "ticktick-planner-month-body" });
      this.renderRangeLanes(body, weekDays, tasks, "ticktick-planner-month-range-lanes");
      const cells = body.createDiv({ cls: "ticktick-planner-month-cells" });

      for (const day of weekDays) {
        const isToday = day === today;
        const isOutside = !isSamePersianMonth(day, this.day);
        const cell = cells.createDiv({
          cls: `ticktick-planner-month-cell ${isOutside ? "is-outside" : ""} ${isToday ? "is-today" : ""}`,
          attr: { "data-day": day }
        });
        const items = tasksForCalendarDay(tasks, day, this.host.timeZone, this.host.showCompleted, this.sortMode);

        cell.addEventListener("dragover", event => {
          event.preventDefault();
          if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
          cell.addClass("is-drag-over");
        });
        cell.addEventListener("dragleave", () => {
          cell.removeClass("is-drag-over");
        });
        cell.addEventListener("drop", event => {
          event.preventDefault();
          cell.removeClass("is-drag-over");
          const task = this.draggedTask(event, tasks);
          if (task) void this.dropTask(task, day);
        });

        const cards = items.filter(item => !taskDateRange(item, this.host.timeZone));
        for (const task of cards.slice(0, 3)) this.renderMonthTask(cell, task);

        if (cards.length > 3) {
          const more = cell.createEl("button", {
            cls: "ticktick-planner-overflow",
            text: `+${cards.length - 3} تسک دیگر`,
            attr: { type: "button", "aria-label": "نمایش همهٔ تسک‌های روز" }
          });
          const dayLabel = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { weekday: "long", day: "numeric", month: "long" }).format(new Date(`${day}T12:00:00Z`));
          more.addEventListener("click", () => new TaskOverflowModal(
            this.host.app,
            cards,
            task => this.completeTask(task),
            task => this.host.load(task),
            task => this.host.edit(task),
            async () => {
              await this.host.refresh();
              await this.render();
            },
            dayLabel
          ).open());
        }
      }
    }
  }

  private renderRangeLanes(parent: HTMLElement, days: string[], tasks: any[], cls: string) {
    const rangeTasks = tasks.filter(task => {
      if (Number(task.status ?? 0) !== 0 && !this.host.showCompleted) return false;
      const range = taskDateRange(task, this.host.timeZone);
      return range && range.end >= days[0] && range.start <= days.at(-1)!;
    });
    if (!rangeTasks.length) return;

    const lanes = parent.createDiv({ cls });
    for (const task of rangeTasks) {
      const range = taskDateRange(task, this.host.timeZone)!;
      const first = Math.max(0, days.findIndex(day => day >= range.start));
      const last = Math.max(first, (() => {
        const index = days.findIndex(day => day > range.end);
        return index < 0 ? days.length - 1 : index - 1;
      })());
      const priority = taskPriority(task.priority);
      const isCompleted = Number(task.status ?? 0) !== 0;
      const tone = this.taskTone(task);

      const bar = lanes.createDiv({
        cls: `ticktick-planner-range-task priority-${priority.value} ${isCompleted ? "is-completed" : ""}`,
        attr: {
          title: `بازهٔ ${range.start} تا ${range.end} · ${task.title}`,
          role: "button",
          tabindex: "0"
        }
      });
      bar.style.gridColumn = `${first + 1} / ${last + 2}`;
      bar.style.setProperty("--ticktick-task-tone", tone);

      const openDetails = () => new TaskDetailsModal(this.host.app, task, {
        complete: () => this.completeTask(task),
        load: item => this.host.load(item),
        edit: item => this.host.edit(item),
        changed: async () => {
          await this.host.refresh();
          await this.render();
        }
      }).open();

      bar.addEventListener("click", openDetails);
      bar.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openDetails();
        }
      });

      const check = bar.createEl("input", { type: "checkbox", cls: "ticktick-range-check", attr: { "aria-label": `تکمیل ${task.title}` } });
      check.checked = isCompleted;
      check.disabled = isCompleted;
      check.addEventListener("click", e => e.stopPropagation());
      check.addEventListener("change", () => void this.completeTask(task, check));

      const rangeIcon = bar.createSpan({ cls: "ticktick-range-indicator mod-icon", attr: { "aria-hidden": "true" } });
      setIcon(rangeIcon, "calendar-range");

      const titleEl = bar.createDiv({
        cls: "ticktick-range-title",
        text: String(task.title ?? "بدون عنوان")
      });
      titleEl.addEventListener("click", event => {
        event.stopPropagation();
        openDetails();
      });

      bar.draggable = true;
      bar.addEventListener("dragstart", event => {
        bar.addClass("is-dragging");
        this.draggingTaskId = String(task.id);
        event.dataTransfer!.effectAllowed = "move";
        event.dataTransfer?.setData("text/ticktick-task", String(task.id));
        event.dataTransfer?.setData("text/plain", String(task.id));
      });
      bar.addEventListener("dragend", () => { bar.removeClass("is-dragging"); this.draggingTaskId = ""; });
    }
  }

  private renderTask(parent: HTMLElement, task: any) {
    const bound = this.host.binding(task);
    const priority = taskPriority(task.priority);
    const isCompleted = Number(task.status ?? 0) !== 0;
    const tone = this.taskTone(task);

    const card = parent.createDiv({
      cls: `ticktick-planner-task priority-${priority.value} ${bound ? "is-bound" : ""} ${isCompleted ? "is-completed" : ""}`,
      attr: {
        title: `${String(task.title ?? "")}${task.projectName ? ` · ${task.projectName}` : ""}${bound ? " · (برای جابه‌جایی بکش)" : ""}`,
        role: "button",
        tabindex: "0"
      }
    });
    card.style.setProperty("--ticktick-task-tone", tone);

    const openDetails = () => new TaskDetailsModal(this.host.app, task, {
      complete: () => this.completeTask(task),
      load: item => this.host.load(item),
      edit: item => this.host.edit(item),
      changed: async () => {
        await this.host.refresh();
        await this.render();
      }
    }).open();

    card.addEventListener("click", openDetails);
    card.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openDetails();
      }
    });

    // Bound grip indicator
    if (bound) {
      const grip = card.createSpan({ cls: "ticktick-task-grip mod-icon", attr: { "aria-hidden": "true" } });
      setIcon(grip, "grip-vertical");
      grip.addEventListener("click", event => event.stopPropagation());
    }

    // Checkbox
    const check = card.createEl("input", { type: "checkbox", cls: "ticktick-task-check", attr: { "aria-label": `تکمیل ${task.title}` } });
    check.checked = isCompleted;
    check.disabled = isCompleted;
    check.addEventListener("click", event => event.stopPropagation());
    check.addEventListener("change", () => void this.completeTask(task, check));

    // Content container
    const content = card.createDiv({ cls: "ticktick-task-content" });

    // Meta chips (Project, Time, Priority)
    const timeStr = formatTaskTime(task, this.host.timeZone);
    if (timeStr || priority.value > 0 || task.projectName) {
      const metaRow = content.createDiv({ cls: "ticktick-task-meta-row" });
      if (task.projectName) {
        metaRow.createSpan({ cls: "ticktick-task-project-chip", text: task.projectName });
      }
      if (timeStr) {
        const timeBadge = metaRow.createSpan({ cls: "ticktick-task-time-badge" });
        const clockIcon = timeBadge.createSpan({ cls: "ticktick-time-icon" });
        setIcon(clockIcon, "clock");
        timeBadge.createSpan({ text: timeStr });
      }
      if (priority.value > 0) {
        metaRow.createSpan({ cls: `ticktick-task-priority-dot ${priority.className}`, attr: { title: `اولویت: ${priority.label}` } });
      }
    }

    // Task title: plain div, no button, full wrap!
    const titleEl = content.createDiv({
      cls: "ticktick-task-title",
      text: String(task.title ?? "بدون عنوان")
    });
    titleEl.addEventListener("click", event => {
      event.stopPropagation();
      openDetails();
    });

    card.draggable = true;
    card.addEventListener("dragstart", event => {
      card.addClass("is-dragging");
      this.draggingTaskId = String(task.id);
      event.dataTransfer!.effectAllowed = "move";
      event.dataTransfer?.setData("text/ticktick-task", String(task.id));
      event.dataTransfer?.setData("text/plain", String(task.id));
    });
    card.addEventListener("dragend", () => {
      card.removeClass("is-dragging");
      this.draggingTaskId = "";
    });
  }

  private renderMonthTask(parent: HTMLElement, task: any) {
    const bound = this.host.binding(task);
    const priority = taskPriority(task.priority);
    const isCompleted = Number(task.status ?? 0) !== 0;
    const tone = this.taskTone(task);

    const card = parent.createDiv({
      cls: `ticktick-planner-month-task priority-${priority.value} ${bound ? "is-bound" : ""} ${isCompleted ? "is-completed" : ""}`,
      attr: {
        title: `${task.title}${task.projectName ? ` · ${task.projectName}` : ""}`,
        role: "button",
        tabindex: "0"
      }
    });
    card.style.setProperty("--ticktick-task-tone", tone);

    const openDetails = () => new TaskDetailsModal(this.host.app, task, {
      complete: () => this.completeTask(task),
      load: item => this.host.load(item),
      edit: item => this.host.edit(item),
      changed: async () => {
        await this.host.refresh();
        await this.render();
      }
    }).open();

    card.addEventListener("click", openDetails);
    card.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openDetails();
      }
    });

    const check = card.createEl("input", { type: "checkbox", cls: "ticktick-month-check", attr: { "aria-label": `تکمیل ${task.title}` } });
    check.checked = isCompleted;
    check.disabled = isCompleted;
    check.addEventListener("click", event => event.stopPropagation());
    check.addEventListener("change", () => void this.completeTask(task, check));

    const timeStr = formatTaskTime(task, this.host.timeZone);
    if (timeStr) {
      card.createSpan({ cls: "ticktick-month-time", text: timeStr });
    }

    const titleEl = card.createDiv({
      cls: "ticktick-month-task-title",
      text: String(task.title ?? "بدون عنوان")
    });
    titleEl.addEventListener("click", event => {
      event.stopPropagation();
      openDetails();
    });

    card.draggable = true;
    card.addEventListener("dragstart", event => {
      card.addClass("is-dragging");
      this.draggingTaskId = String(task.id);
      event.dataTransfer!.effectAllowed = "move";
      event.dataTransfer?.setData("text/ticktick-task", String(task.id));
      event.dataTransfer?.setData("text/plain", String(task.id));
    });
    card.addEventListener("dragend", () => {
      card.removeClass("is-dragging");
      this.draggingTaskId = "";
    });
  }

  private taskTone(task: any) {
    if (this.colorMode === "uniform") return "var(--interactive-accent)";
    if (this.colorMode === "priority") {
      return Number(task.priority) === 5
        ? "var(--color-red)"
        : Number(task.priority) === 3
          ? "var(--color-orange)"
          : Number(task.priority) === 1
            ? "var(--color-blue)"
            : "var(--text-muted)";
    }
    const seed = this.colorMode === "tag"
      ? String(task.tags?.[0] ?? task.projectName ?? task.projectId ?? "")
      : String(task.projectName ?? task.projectId ?? "");
    const projectColor = String(task.projectColor ?? "").trim();
    if (this.colorMode === "project" && /^#[0-9a-f]{3,8}$/i.test(projectColor)) return projectColor;
    const palette = ["#7c6cff", "#4aa3df", "#2a9d8f", "#e76f51", "#d36ba6", "#d49a2a", "#5a9b68"];
    const hash = [...seed].reduce((value, char) => ((value * 31) + char.charCodeAt(0)) >>> 0, 0);
    return palette[hash % palette.length];
  }

  private async completeTask(task: any, checkbox?: HTMLInputElement) {
    try {
      await this.host.complete(task);
      new Notice("تسک تکمیل و همگام شد.");
      await this.host.refresh();
      await this.render();
    } catch (error) {
      if (checkbox) {
        checkbox.checked = false;
        checkbox.disabled = false;
      }
      new Notice(error instanceof Error ? error.message : "تکمیل ناموفق بود.");
    }
  }

  private async addTask(day: string) {
    try {
      const created = await this.host.create({ dueDate: day });
      if (!created) return;
      new Notice("تسک در TickTick اضافه شد.");
      await this.host.refresh();
      await this.render();
    } catch (error) {
      new Notice(error instanceof Error ? error.message : "افزودن تسک ناموفق بود.");
    }
  }

  private async dropTask(task: any, target: string) {
    const currentRange = taskDateRange(task, this.host.timeZone);
    const currentDay = currentRange?.start ?? String(task.dueDate ?? task.startDate ?? "").slice(0, 10);
    if (!currentDay || currentDay === target) return;
    try {
      await this.host.reschedule(task, target);
      new Notice(currentRange ? "بازهٔ زمانی تسک جابه‌جا و همگام شد." : "تاریخ تسک جابه‌جا و همگام شد.");
      await this.host.refresh();
      await this.render();
    } catch (error) {
      new Notice(error instanceof Error ? error.message : "جابه‌جایی ناموفق بود.");
    }
  }

  private draggedTask(event: DragEvent, tasks: any[]) {
    const id = event.dataTransfer?.getData("text/ticktick-task")
      || event.dataTransfer?.getData("text/plain")
      || this.draggingTaskId;
    return tasks.find(item => String(item.id) === String(id));
  }

  /** Capture drops before a theme, card, or embedded Obsidian view can stop
   * propagation. Cells still keep their local listeners for visual feedback. */
  private bindCalendarDrop(surface: HTMLElement, tasks: any[]) {
    const targetDay = (event: DragEvent) => this.visualDropDay(surface, event);
    surface.addEventListener("dragover", event => {
      const day = targetDay(event);
      if (!day) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
      surface.querySelectorAll(".is-drag-over").forEach(item => item.removeClass("is-drag-over"));
      surface.querySelector<HTMLElement>(`[data-day=\"${day}\"]`)?.addClass("is-drag-over");
    }, true);
    surface.addEventListener("drop", event => {
      const day = targetDay(event);
      if (!day) return;
      event.preventDefault();
      event.stopPropagation();
      surface.querySelectorAll(".is-drag-over").forEach(item => item.removeClass("is-drag-over"));
      const task = this.draggedTask(event, tasks);
      if (task) void this.dropTask(task, day);
      else new Notice("تسکِ در حال جابه‌جایی پیدا نشد؛ دوباره تلاش کن.");
    }, true);
  }

  /** Resolve the destination from the visible date header instead of the DOM
   * ancestry of a card. Range lanes and RTL grids can otherwise make a card
   * appear over a neighbouring day while retaining another column's parent. */
  private visualDropDay(surface: HTMLElement, event: DragEvent) {
    const x = event.clientX;
    if (Number.isFinite(x) && x > 0) {
      const headers = surface.querySelectorAll<HTMLElement>(
        ".ticktick-planner-day-header[data-day], .ticktick-planner-month-header[data-day]",
      );
      for (const header of headers) {
        const rect = header.getBoundingClientRect();
        if (x >= rect.left && x <= rect.right) return header.dataset.day;
      }
    }
    return event.target instanceof Element
      ? event.target.closest<HTMLElement>("[data-day]")?.dataset.day
      : undefined;
  }
}
