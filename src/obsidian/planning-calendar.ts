import { App, Modal, Notice } from "obsidian";
import { monthRange, shiftCalendarDay, taskDateRange, tasksForCalendarDay, weekRange } from "../core/calendar-range.js";
import { todayInZone } from "../core/date.js";
import { TaskDetailsModal } from "./task-details-modal";
import { taskPriority } from "./task-priority";

type PlannerHost = { app: App; timeZone: string; firstWeekday: number; showCompleted: boolean; tasks: () => any[]; refresh: () => Promise<void>; reschedule: (task: any, day: string) => Promise<any>; complete: (task: any) => Promise<any>; binding: (task: any) => any; load: (task: any) => Promise<any>; edit: (task: any) => Promise<any>; create: (initial: any) => Promise<any> };
type Mode = "day" | "week" | "month";
type ColorMode = "project" | "tag" | "priority" | "uniform";

class PlannerMultiSelectModal extends Modal {
  private answer?: Set<string>;
  constructor(app: App, private label: string, private values: string[], private selected: Set<string>, private prefix = "") { super(app); }
  openAndWait() { this.open(); return new Promise<Set<string> | undefined>(resolve => { this.onClose = () => { this.contentEl.empty(); resolve(this.answer); }; }); }
  onOpen() {
    this.titleEl.setText(`انتخاب ${this.label}`);
    const choices = new Set(this.selected);
    const list = this.contentEl.createDiv({ cls: "ticktick-planner-filter-modal" });
    for (const value of this.values) {
      const row = list.createEl("label"); const check = row.createEl("input", { type: "checkbox" }); check.checked = choices.has(value);
      row.appendText(`${this.prefix}${value}`);
      check.addEventListener("change", () => { check.checked ? choices.add(value) : choices.delete(value); });
    }
    const actions = this.contentEl.createDiv({ cls: "modal-button-container" });
    actions.createEl("button", { text: "لغو" }).addEventListener("click", () => this.close());
    actions.createEl("button", { text: "اعمال", cls: "mod-cta" }).addEventListener("click", () => { this.answer = choices; this.close(); });
  }
}

class RescheduleModal extends Modal {
  private resolveAnswer!: (value: boolean) => void;
  constructor(app: App, private task: any, private target: string) { super(app); }
  openAndWait() { this.open(); return new Promise<boolean>(resolve => { this.resolveAnswer = resolve; }); }
  onOpen() {
    this.titleEl.setText("تأیید جابه‌جایی تسک");
    this.contentEl.createEl("p", { text: `«${this.task.title}» به ${this.target} منتقل شود؟` });
    if (this.task.repeatFlag) this.contentEl.createEl("p", { cls: "mod-warning", text: "تسک تکرارشونده است؛ occurrence جدید محلی ساخته نمی‌شود." });
    const actions = this.contentEl.createDiv({ cls: "modal-button-container" });
    actions.createEl("button", { text: "لغو" }).addEventListener("click", () => { this.resolveAnswer(false); this.close(); });
    actions.createEl("button", { text: "انتقال", cls: "mod-cta" }).addEventListener("click", () => { this.resolveAnswer(true); this.close(); });
  }
  onClose() { this.contentEl.empty(); }
}

class TaskOverflowModal extends Modal {
  constructor(app: App, private tasks: any[], private complete: (task: any) => Promise<any>, private load: (task: any) => Promise<any>, private edit: (task: any) => Promise<any>, private changed: () => Promise<void>) { super(app); }
  onOpen() {
    this.titleEl.setText("تسک‌های این روز");
    for (const task of this.tasks) {
      const row = this.contentEl.createDiv({ cls: "ticktick-overflow-task" });
      const check = row.createEl("input", { type: "checkbox", attr: { "aria-label": `تکمیل ${task.title}` } });
      check.checked = Number(task.status ?? 0) !== 0;
      check.disabled = check.checked;
      const button = row.createEl("button", { text: String(task.title ?? "بدون عنوان"), attr: { type: "button", "aria-label": `جزئیات ${task.title}` } });
      button.addEventListener("click", () => new TaskDetailsModal(this.app, task, { complete: () => this.complete(task), load: this.load, edit: this.edit, changed: this.changed }).open());
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
  onClose() { this.contentEl.empty(); }
}

export class PlanningCalendar {
  private mode: Mode = "week";
  private day: string;
  private projects = new Set<string>();
  private tags = new Set<string>();
  private sortMode = "ticktick";
  private colorMode: ColorMode = "project";
  constructor(private element: HTMLElement, private host: PlannerHost) { this.day = todayInZone(host.timeZone); }
  async render() {
    this.element.empty(); this.element.addClass("ticktick-planner");
    const root = this.element.createDiv({ cls: "ticktick-planner-root" });
    const controls = root.createDiv({ cls: "ticktick-planner-controls" });
    for (const [mode, label] of [["day", "روز"], ["week", "هفته"], ["month", "ماه"]] as Array<[Mode, string]>) {
      const button = controls.createEl("button", { text: label, cls: this.mode === mode ? "is-active" : "" });
      button.addEventListener("click", () => { this.mode = mode; void this.render(); });
    }
    const nav = controls.createDiv({ cls: "ticktick-planner-nav" });
    const step = this.mode === "month" ? 28 : this.mode === "week" ? 7 : 1;
    const previous = nav.createEl("button", { text: "‹", attr: { "aria-label": "قبلی" } });
    previous.addEventListener("click", () => { this.day = shiftCalendarDay(this.day, -step); void this.render(); });
    const today = nav.createEl("button", { text: "امروز" }); today.addEventListener("click", () => { this.day = todayInZone(this.host.timeZone); void this.render(); });
    nav.createEl("span", { text: new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric", month: "long", day: "numeric" }).format(new Date(`${this.day}T12:00:00Z`)) });
    const next = nav.createEl("button", { text: "›", attr: { "aria-label": "بعدی" } }); next.addEventListener("click", () => { this.day = shiftCalendarDay(this.day, step); void this.render(); });
    const add = controls.createEl("button", { text: "+ افزودن تسک" }); add.addEventListener("click", () => void this.addTask(this.day));
    const refresh = controls.createEl("button", { text: "همگام‌سازی" }); refresh.addEventListener("click", async () => { refresh.disabled = true; try { await this.host.refresh(); await this.render(); } catch (error) { new Notice(error instanceof Error ? error.message : "همگام‌سازی ناموفق بود."); } });
    this.renderFilters(root);
    const tasks = this.filteredTasks();
    if (!tasks.length) root.createDiv({ cls: "ticktick-planner-empty", text: "تسکی برای این فیلتر نیست؛ از دکمهٔ «افزودن تسک» استفاده کن." });
    if (this.mode === "month") this.renderMonth(root, tasks); else this.renderDays(root, this.mode === "week" ? weekRange(this.day, this.host.firstWeekday) : [this.day], tasks);
  }
  private renderFilters(root: HTMLElement) {
    const filters = root.createDiv({ cls: "ticktick-planner-filters" }); const tasks = this.host.tasks();
    const sort = filters.createEl("select", { attr: { "aria-label": "مرتب‌سازی تسک‌ها" } });
    for (const [value, label] of [["ticktick", "ترتیب TickTick"], ["time", "ساعت"], ["priority", "اولویت"], ["title", "عنوان"]]) sort.createEl("option", { value, text: `مرتب‌سازی: ${label}` });
    sort.value = this.sortMode; sort.addEventListener("change", () => { this.sortMode = sort.value; void this.render(); });
    const color = filters.createEl("select", { attr: { "aria-label": "رنگ‌بندی تسک‌ها" } });
    for (const [value, label] of [["project", "رنگ: پروژه"], ["tag", "رنگ: برچسب"], ["priority", "رنگ: اولویت"], ["uniform", "رنگ: یکدست"]] as Array<[ColorMode, string]>) color.createEl("option", { value, text: label });
    color.value = this.colorMode; color.addEventListener("change", () => { this.colorMode = color.value as ColorMode; void this.render(); });
    const projects = [...new Set(tasks.map(task => String(task.projectName ?? task.projectId ?? "ورودی")))].sort((left, right) => left.localeCompare(right, "fa"));
    const project = filters.createEl("button", { text: this.projects.size ? `پروژه (${this.projects.size})` : "پروژه" }); project.addEventListener("click", async () => { const value = await new PlannerMultiSelectModal(this.host.app, "پروژه‌ها", projects, this.projects).openAndWait(); if (value) { this.projects = value; await this.render(); } });
    const tags = [...new Set(tasks.flatMap(task => task.tags ?? []).map(String))].sort((left, right) => left.localeCompare(right, "fa"));
    const tag = filters.createEl("button", { text: this.tags.size ? `برچسب (${this.tags.size})` : "برچسب" }); tag.addEventListener("click", async () => { const value = await new PlannerMultiSelectModal(this.host.app, "برچسب‌ها", tags, this.tags, "#").openAndWait(); if (value) { this.tags = value; await this.render(); } });
    if (this.projects.size || this.tags.size) { const clear = filters.createEl("button", { text: "پاک", attr: { "aria-label": "پاک‌کردن همهٔ فیلترها" } }); clear.addEventListener("click", () => { this.projects.clear(); this.tags.clear(); void this.render(); }); }
  }
  private filteredTasks() { return this.host.tasks().filter(task => (!this.projects.size || this.projects.has(String(task.projectName ?? task.projectId ?? "ورودی"))) && (!this.tags.size || (task.tags ?? []).some((tag: any) => this.tags.has(String(tag))))); }
  private renderDays(root: HTMLElement, days: string[], tasks: any[]) {
    const grid = root.createDiv({ cls: `ticktick-planner-days ticktick-planner-days-${days.length}` });
    const showRangeBars = days.length > 1;
    const headers = grid.createDiv({ cls: "ticktick-planner-days-headers" });
    for (const day of days) {
      const header = headers.createDiv({ cls: "ticktick-planner-day-header", attr: { "data-day": day } });
      header.createEl("strong", { text: new Intl.DateTimeFormat("fa-IR-u-ca-persian", { weekday: "long", month: "numeric", day: "numeric" }).format(new Date(`${day}T12:00:00Z`)) });
      const items = tasksForCalendarDay(tasks, day, this.host.timeZone, this.host.showCompleted, this.sortMode);
      header.createSpan({ cls: "ticktick-planner-counter", text: `${items.length} تسک` });
      const add = header.createEl("button", { cls: "ticktick-planner-add", text: "+ افزودن", attr: { type: "button", "aria-label": `افزودن تسک در ${day}` } }); add.addEventListener("click", () => void this.addTask(day));
    }
    if (showRangeBars) this.renderRangeLanes(grid, days, tasks, "ticktick-planner-range-lanes");
    const columns = grid.createDiv({ cls: "ticktick-planner-day-columns" });
    for (const day of days) {
      const column = columns.createDiv({ cls: "ticktick-planner-day", attr: { "data-day": day } });
      const items = tasksForCalendarDay(tasks, day, this.host.timeZone, this.host.showCompleted, this.sortMode);
      column.addEventListener("dragover", event => event.preventDefault());
      column.addEventListener("drop", event => { event.preventDefault(); const id = event.dataTransfer?.getData("text/ticktick-task"); const task = tasks.find(item => String(item.id) === id); if (task) void this.dropTask(task, day); });
      for (const task of items.filter(item => !showRangeBars || !taskDateRange(item, this.host.timeZone))) this.renderTask(column, task);
    }
  }
  private renderMonth(root: HTMLElement, tasks: any[]) {
    const grid = root.createDiv({ cls: "ticktick-planner-month" });
    const days = monthRange(this.day, this.host.firstWeekday);
    for (let index = 0; index < days.length; index += 7) {
      const weekDays = days.slice(index, index + 7);
      const week = grid.createDiv({ cls: "ticktick-planner-month-week" });
      const headers = week.createDiv({ cls: "ticktick-planner-month-headers" });
      for (const day of weekDays) {
        const header = headers.createDiv({ cls: `ticktick-planner-month-header${day.slice(0, 7) === this.day.slice(0, 7) ? "" : " is-outside"}`, attr: { "data-day": day } });
        header.createEl("strong", { text: new Intl.DateTimeFormat("fa-IR-u-ca-persian", { day: "numeric" }).format(new Date(`${day}T12:00:00Z`)) });
        const items = tasksForCalendarDay(tasks, day, this.host.timeZone, this.host.showCompleted, this.sortMode);
        header.createSpan({ cls: "ticktick-planner-counter", text: String(items.length) });
        const add = header.createEl("button", { cls: "ticktick-planner-add", text: "+", attr: { type: "button", "aria-label": `افزودن تسک در ${day}` } }); add.addEventListener("click", () => void this.addTask(day));
      }
      const body = week.createDiv({ cls: "ticktick-planner-month-body" });
      this.renderRangeLanes(body, weekDays, tasks, "ticktick-planner-month-range-lanes");
      const cells = body.createDiv({ cls: "ticktick-planner-month-cells" });
      for (const day of weekDays) {
      const cell = cells.createDiv({ cls: `ticktick-planner-month-cell${day.slice(0, 7) === this.day.slice(0, 7) ? "" : " is-outside"}`, attr: { "data-day": day } });
      const items = tasksForCalendarDay(tasks, day, this.host.timeZone, this.host.showCompleted, this.sortMode);
      cell.addEventListener("dragover", event => event.preventDefault()); cell.addEventListener("drop", event => { event.preventDefault(); const id = event.dataTransfer?.getData("text/ticktick-task"); const task = tasks.find(item => String(item.id) === id); if (task) void this.dropTask(task, day); });
      const cards = items.filter(item => !taskDateRange(item, this.host.timeZone));
      for (const task of cards.slice(0, 3)) this.renderTask(cell, task);
      if (cards.length > 3) { const more = cell.createEl("button", { cls: "ticktick-planner-overflow", text: `+${cards.length - 3}`, attr: { type: "button", "aria-label": "نمایش همهٔ تسک‌های روز" } }); more.addEventListener("click", () => new TaskOverflowModal(this.host.app, cards, task => this.completeTask(task), task => this.host.load(task), task => this.host.edit(task), async () => { await this.host.refresh(); await this.render(); }).open()); }
      }
    }
  }
  private renderRangeLanes(parent: HTMLElement, days: string[], tasks: any[], cls: string) {
    const lanes = parent.createDiv({ cls });
    for (const task of tasks) {
      if (Number(task.status ?? 0) !== 0 && !this.host.showCompleted) continue;
      const range = taskDateRange(task, this.host.timeZone);
      if (!range || range.end < days[0] || range.start > days.at(-1)!) continue;
      const first = Math.max(0, days.findIndex(day => day >= range.start));
      const last = Math.max(first, (() => { const index = days.findIndex(day => day > range.end); return index < 0 ? days.length - 1 : index - 1; })());
      const priority = taskPriority(task.priority);
      const bar = lanes.createDiv({ cls: `ticktick-planner-range-task priority-${priority.value}`, attr: { title: `بازهٔ ${range.start} تا ${range.end} · برای جزئیات کلیک کن` } });
      bar.style.gridColumn = `${first + 1} / ${last + 2}`;
      bar.style.setProperty("--ticktick-task-tone", this.taskTone(task));
      const check = bar.createEl("input", { type: "checkbox", attr: { "aria-label": `تکمیل ${task.title}` } }); check.checked = Number(task.status ?? 0) !== 0; check.disabled = check.checked;
      const title = bar.createEl("button", { text: String(task.title ?? "بدون عنوان"), attr: { type: "button", "aria-label": `جزئیات ${task.title}` } });
      title.addEventListener("click", () => new TaskDetailsModal(this.host.app, task, { complete: () => this.completeTask(task), load: item => this.host.load(item), edit: item => this.host.edit(item), changed: async () => { await this.host.refresh(); await this.render(); } }).open());
      check.addEventListener("change", () => void this.completeTask(task, check));
    }
  }
  private renderTask(parent: HTMLElement, task: any) {
    const bound = this.host.binding(task); const priority = taskPriority(task.priority); const card = parent.createDiv({ cls: `ticktick-planner-task priority-${priority.value}${bound ? " is-bound" : ""}`, attr: { title: `${bound ? "برای جابه‌جایی بکش" : "برای دیدن جزئیات کلیک کن"} · اولویت: ${priority.label}` } });
    card.style.setProperty("--ticktick-task-tone", this.taskTone(task));
    const check = card.createEl("input", { type: "checkbox", attr: { "aria-label": `تکمیل ${task.title}` } }); check.checked = Number(task.status ?? 0) !== 0; check.disabled = check.checked;
    const title = card.createEl("button", { text: String(task.title ?? "بدون عنوان"), attr: { type: "button", "aria-label": `جزئیات ${task.title}` } }); title.addEventListener("click", () => new TaskDetailsModal(this.host.app, task, { complete: () => this.completeTask(task), load: item => this.host.load(item), edit: item => this.host.edit(item), changed: async () => { await this.host.refresh(); await this.render(); } }).open());
    check.addEventListener("click", event => event.stopPropagation()); check.addEventListener("change", () => void this.completeTask(task, check));
    card.draggable = Boolean(bound); card.addEventListener("dragstart", event => { if (bound) event.dataTransfer?.setData("text/ticktick-task", String(task.id)); });
  }
  private taskTone(task: any) {
    if (this.colorMode === "uniform") return "var(--interactive-accent)";
    if (this.colorMode === "priority") return Number(task.priority) === 5 ? "var(--color-red)" : Number(task.priority) === 3 ? "var(--color-orange)" : Number(task.priority) === 1 ? "var(--color-blue)" : "var(--text-muted)";
    const seed = this.colorMode === "tag" ? String(task.tags?.[0] ?? task.projectName ?? task.projectId ?? "") : String(task.projectName ?? task.projectId ?? "");
    const projectColor = String(task.projectColor ?? "").trim();
    if (this.colorMode === "project" && /^#[0-9a-f]{3,8}$/i.test(projectColor)) return projectColor;
    const palette = ["#7c6cff", "#4aa3df", "#2a9d8f", "#e76f51", "#d36ba6", "#d49a2a", "#5a9b68"];
    const hash = [...seed].reduce((value, char) => ((value * 31) + char.charCodeAt(0)) >>> 0, 0);
    return palette[hash % palette.length];
  }
  private async completeTask(task: any, checkbox?: HTMLInputElement) { try { await this.host.complete(task); new Notice("تسک تکمیل و همگام شد."); await this.host.refresh(); await this.render(); } catch (error) { if (checkbox) { checkbox.checked = false; checkbox.disabled = false; } new Notice(error instanceof Error ? error.message : "تکمیل ناموفق بود."); } }
  private async addTask(day: string) { try { const created = await this.host.create({ dueDate: day }); if (!created) return; new Notice("تسک در TickTick اضافه شد."); await this.host.refresh(); await this.render(); } catch (error) { new Notice(error instanceof Error ? error.message : "افزودن تسک ناموفق بود."); } }
  private async dropTask(task: any, target: string) {
    if (!this.host.binding(task)) { new Notice("فقط taskهای bind‌شده به Markdown قابل جابه‌جایی هستند."); return; }
    if (!await new RescheduleModal(this.host.app, task, target).openAndWait()) return;
    try { await this.host.reschedule(task, target); new Notice("تاریخ تسک با تأیید شما تغییر کرد."); await this.host.refresh(); await this.render(); } catch (error) { new Notice(error instanceof Error ? error.message : "جابه‌جایی ناموفق بود."); }
  }
}
