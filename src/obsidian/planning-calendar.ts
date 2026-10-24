import { App, Modal, Notice } from "obsidian";
import { monthRange, shiftCalendarDay, tasksForCalendarDay, weekRange } from "../core/calendar-range.js";
import { todayInZone } from "../core/date.js";

type PlannerHost = { app: App; timeZone: string; firstWeekday: number; showCompleted: boolean; tasks: () => any[]; refresh: () => Promise<void>; reschedule: (task: any, day: string) => Promise<any>; binding: (task: any) => any };
type Mode = "day" | "week" | "month";

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

export class PlanningCalendar {
  private mode: Mode = "week";
  private day: string;
  private project = "";
  private tag = "";
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
    const refresh = controls.createEl("button", { text: "همگام‌سازی" }); refresh.addEventListener("click", async () => { refresh.disabled = true; try { await this.host.refresh(); await this.render(); } catch (error) { new Notice(error instanceof Error ? error.message : "همگام‌سازی ناموفق بود."); } });
    this.renderFilters(root);
    const tasks = this.filteredTasks();
    if (!tasks.length) root.createDiv({ cls: "ticktick-planner-empty", text: "تسکی در cache برای این فیلتر وجود ندارد. برای دریافت داده، همگام‌سازی را بزن." });
    else if (this.mode === "month") this.renderMonth(root, tasks); else this.renderDays(root, this.mode === "week" ? weekRange(this.day, this.host.firstWeekday) : [this.day], tasks);
  }
  private renderFilters(root: HTMLElement) {
    const filters = root.createDiv({ cls: "ticktick-planner-filters" }); const tasks = this.host.tasks();
    const projects = [...new Set(tasks.map(task => String(task.projectName ?? task.projectId ?? "ورودی")))];
    for (const project of ["", ...projects]) { const button = filters.createEl("button", { text: project || "همهٔ پروژه‌ها", cls: this.project === project ? "is-active" : "" }); button.addEventListener("click", () => { this.project = project; void this.render(); }); }
    const tags = [...new Set(tasks.flatMap(task => task.tags ?? []))].slice(0, 12);
    for (const tag of tags) { const button = filters.createEl("button", { text: `#${tag}`, cls: this.tag === tag ? "is-active" : "" }); button.addEventListener("click", () => { this.tag = this.tag === tag ? "" : tag; void this.render(); }); }
  }
  private filteredTasks() { return this.host.tasks().filter(task => (!this.project || String(task.projectName ?? task.projectId ?? "ورودی") === this.project) && (!this.tag || (task.tags ?? []).includes(this.tag))); }
  private renderDays(root: HTMLElement, days: string[], tasks: any[]) {
    const grid = root.createDiv({ cls: `ticktick-planner-days ticktick-planner-days-${days.length}` });
    for (const day of days) {
      const column = grid.createDiv({ cls: "ticktick-planner-day", attr: { "data-day": day } });
      column.createEl("strong", { text: new Intl.DateTimeFormat("fa-IR-u-ca-persian", { weekday: "long", month: "numeric", day: "numeric" }).format(new Date(`${day}T12:00:00Z`)) });
      const items = tasksForCalendarDay(tasks, day, this.host.timeZone, this.host.showCompleted);
      column.createSpan({ cls: "ticktick-planner-counter", text: `${items.length} تسک` });
      column.addEventListener("dragover", event => event.preventDefault());
      column.addEventListener("drop", event => { event.preventDefault(); const id = event.dataTransfer?.getData("text/ticktick-task"); const task = tasks.find(item => String(item.id) === id); if (task) void this.dropTask(task, day); });
      for (const task of items) this.renderTask(column, task);
    }
  }
  private renderMonth(root: HTMLElement, tasks: any[]) {
    const grid = root.createDiv({ cls: "ticktick-planner-month" });
    for (const day of monthRange(this.day, this.host.firstWeekday)) {
      const cell = grid.createDiv({ cls: `ticktick-planner-month-cell${day.slice(0, 7) === this.day.slice(0, 7) ? "" : " is-outside"}`, attr: { "data-day": day } });
      cell.createEl("strong", { text: new Intl.DateTimeFormat("fa-IR-u-ca-persian", { day: "numeric" }).format(new Date(`${day}T12:00:00Z`)) });
      const items = tasksForCalendarDay(tasks, day, this.host.timeZone, this.host.showCompleted); cell.createSpan({ cls: "ticktick-planner-counter", text: String(items.length) });
      cell.addEventListener("dragover", event => event.preventDefault()); cell.addEventListener("drop", event => { event.preventDefault(); const id = event.dataTransfer?.getData("text/ticktick-task"); const task = tasks.find(item => String(item.id) === id); if (task) void this.dropTask(task, day); });
      for (const task of items.slice(0, 3)) this.renderTask(cell, task);
      if (items.length > 3) cell.createSpan({ cls: "ticktick-planner-overflow", text: `+${items.length - 3}` });
    }
  }
  private renderTask(parent: HTMLElement, task: any) {
    const bound = this.host.binding(task); const card = parent.createEl("button", { cls: `ticktick-planner-task priority-${Number(task.priority ?? 0)}${bound ? " is-bound" : ""}`, text: String(task.title ?? "بدون عنوان"), attr: { type: "button", title: bound ? "برای جابه‌جایی بکش" : "برای جابه‌جایی ابتدا task را با Markdown sync bind کن" } });
    card.draggable = Boolean(bound); card.addEventListener("dragstart", event => { if (bound) event.dataTransfer?.setData("text/ticktick-task", String(task.id)); });
  }
  private async dropTask(task: any, target: string) {
    if (!this.host.binding(task)) { new Notice("فقط taskهای bind‌شده به Markdown قابل جابه‌جایی هستند."); return; }
    if (!await new RescheduleModal(this.host.app, task, target).openAndWait()) return;
    try { await this.host.reschedule(task, target); new Notice("تاریخ تسک با تأیید شما تغییر کرد."); await this.host.refresh(); await this.render(); } catch (error) { new Notice(error instanceof Error ? error.message : "جابه‌جایی ناموفق بود."); }
  }
}
