import { App, Menu, Notice } from "obsidian";
import { boardColumns, sidebarTree } from "../core/project-board.js";
import { TaskDetailsModal } from "./task-details-modal";
import { taskPriority } from "./task-priority";
import { ProjectEditorModal } from "./project-editor-modal";
import { taskDescription } from "../core/task-description.js";
import { formatPersianDate } from "../core/persian-date.js";
import { sortPlanningTasks } from "../core/calendar-range.js";
import { enhanceHorizontalScroll } from "./horizontal-scroll";

type Host = { app: App; projects: () => Promise<any[]>; createProject: (project: any) => Promise<any>; updateProject: (project: any) => Promise<any>; deleteProject: (projectId: string) => Promise<any>; createTask: (initial: any) => Promise<any>; tasks: () => any[]; board: (project: any) => Promise<any>; refresh: () => Promise<void>; complete: (task: any) => Promise<any>; binding: (task: any) => any; load: (task: any) => Promise<any>; edit: (task: any) => Promise<any>; showCompleted: () => boolean; preferences: () => { selected: string; collapsed: string[] }; savePreferences: (value: { selected: string; collapsed: string[] }) => Promise<void> };

export class ProjectBoard {
  private selected = ""; private collapsed = new Set<string>(); private initialized = false; private sortMode = "ticktick";
  constructor(private element: HTMLElement, private host: Host) {}
  async render() {
    if (!this.initialized) { const saved = this.host.preferences(); this.selected = saved.selected; this.collapsed = new Set(saved.collapsed); this.initialized = true; }
    this.element.empty(); this.element.addClass("ticktick-project-board");
    const root = this.element.createDiv({ cls: "ticktick-project-board-root" });
    try {
      const projects = await this.host.projects();
      if (!this.selected && projects[0]) this.selected = String(projects[0].id);
      const rail = root.createDiv({ cls: "ticktick-project-rail" });
      rail.createEl("strong", { text: "لیست‌ها" });
      const all = rail.createEl("button", { cls: !this.selected ? "is-selected" : "", text: `همهٔ لیست‌ها · ${this.host.tasks().length}` }); all.addEventListener("click", () => { this.selected = ""; void this.persistAndRender(); });
      for (const group of sidebarTree(projects, this.host.tasks())) {
        const key = group.name || "flat"; const heading = rail.createEl("button", { cls: "ticktick-project-group", text: group.name || "لیست‌ها" }); heading.addEventListener("click", () => { this.collapsed.has(key) ? this.collapsed.delete(key) : this.collapsed.add(key); void this.persistAndRender(); });
        if (this.collapsed.has(key)) continue;
        for (const project of group.projects) { const row = rail.createEl("button", { cls: `ticktick-project-row${this.selected === String(project.id) ? " is-selected" : ""}`, attr: { "aria-label": `${project.name}، ${project.openCount} تسک باز` } }); row.createSpan({ cls: "ticktick-project-dot" }).style.setProperty("--project-color", project.color ?? "var(--interactive-accent)"); row.createSpan({ text: project.name }); row.createSpan({ cls: "ticktick-project-count", text: String(project.openCount) }); row.addEventListener("click", () => { this.selected = String(project.id); void this.persistAndRender(); }); }
      }
      const main = root.createDiv({ cls: "ticktick-project-main" }); const toolbar = main.createDiv({ cls: "ticktick-project-toolbar" });
      const refresh = toolbar.createEl("button", { text: "به‌روزرسانی" }); refresh.addEventListener("click", async () => { refresh.disabled = true; try { await this.host.refresh(); await this.render(); } catch (error) { new Notice(error instanceof Error ? error.message : "همگام‌سازی ناموفق بود."); } });
      const sortLabels: Record<string, string> = { ticktick: "ترتیب TickTick", time: "تاریخ/ساعت", priority: "اولویت", title: "عنوان" };
      const sortBtn = toolbar.createEl("button", { text: `مرتب‌سازی: ${sortLabels[this.sortMode] ?? "ترتیب TickTick"}`, attr: { "aria-label": "مرتب‌سازی کارت‌های برد" } });
      sortBtn.addEventListener("click", event => {
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
        menu.showAtMouseEvent(event);
      });
      const create = toolbar.createEl("button", { text: "+ لیست جدید" }); create.addEventListener("click", async () => { const draft = await new ProjectEditorModal(this.host.app).openAndWait(); if (!draft) return; create.disabled = true; try { const project = await this.host.createProject(draft); this.selected = String(project?.id ?? ""); await this.host.refresh(); await this.persistAndRender(); new Notice("لیست در TickTick ساخته شد."); } catch (error) { new Notice(error instanceof Error ? error.message : "ساخت لیست ناموفق بود."); } finally { create.disabled = false; } });
      const project = projects.find(item => String(item.id) === this.selected);
      if (!project) { main.createEl("p", { text: "یک لیست را از نوار کناری انتخاب کن." }); return; }
      const addTask = toolbar.createEl("button", { text: "+ افزودن تسک", cls: "mod-cta" }); addTask.addEventListener("click", async () => { addTask.disabled = true; try { const created = await this.host.createTask({ projectId: project.id }); if (!created) return; await this.host.refresh(); await this.render(); new Notice("تسک در این لیست اضافه شد."); } catch (error) { new Notice(error instanceof Error ? error.message : "افزودن تسک ناموفق بود."); } finally { addTask.disabled = false; } });
      const editProject = toolbar.createEl("button", { text: "ویرایش لیست" }); editProject.addEventListener("click", async () => { const draft = await new ProjectEditorModal(this.host.app, project).openAndWait(); if (!draft) return; editProject.disabled = true; try { await this.host.updateProject({ ...project, ...draft }); await this.host.refresh(); await this.render(); new Notice("لیست در TickTick ویرایش شد."); } catch (error) { new Notice(error instanceof Error ? error.message : "ویرایش لیست ناموفق بود."); } finally { editProject.disabled = false; } });
      const removeProject = toolbar.createEl("button", { text: "حذف لیست", cls: "mod-warning" }); removeProject.addEventListener("click", async () => { if (!window.confirm(`لیست «${project.name}» و تسک‌های آن در TickTick حذف شود؟`)) return; removeProject.disabled = true; try { await this.host.deleteProject(String(project.id)); this.selected = ""; await this.host.refresh(); await this.persistAndRender(); new Notice("لیست از TickTick حذف شد."); } catch (error) { removeProject.disabled = false; new Notice(error instanceof Error ? error.message : "حذف لیست ناموفق بود."); } });
      const data = await this.host.board(project); main.createEl("h2", { text: project.name });
      const columns = main.createDiv({ cls: "ticktick-project-columns" }); enhanceHorizontalScroll(columns);
      for (const column of boardColumns(data, this.host.showCompleted())) { const shell = columns.createDiv({ cls: "ticktick-project-column" }); shell.createEl("strong", { text: `${column.name} · ${column.count}` }); shell.createEl("small", { text: column.synthetic ? "ستون نمایشی؛ جابه‌جایی غیرفعال است" : "ترتیب و جابه‌جایی ستون در نسخهٔ اول فقط خواندنی است" }); shell.addEventListener("dragover", event => event.preventDefault()); shell.addEventListener("drop", event => { event.preventDefault(); new Notice("جابه‌جایی بین ستون‌ها تا تأیید رسمی API TickTick غیرفعال است."); });
        for (const group of column.groups) { shell.createEl("h4", { text: group.name }); for (const task of sortPlanningTasks(group.tasks, this.sortMode)) this.card(shell, task); }
      }
    } catch (error) { root.createEl("p", { text: error instanceof Error ? error.message : "دادهٔ پروژه در دسترس نیست." }); }
  }
  private async persistAndRender() { await this.host.savePreferences({ selected: this.selected, collapsed: [...this.collapsed] }); await this.render(); }
  private card(parent: HTMLElement, task: any) {
    const bound = this.host.binding(task); const card = parent.createDiv({ cls: "ticktick-project-card", attr: { role: "button", tabindex: "0", "aria-label": `جزئیات ${task.title}` } }); card.draggable = false; card.setAttribute("title", "برای دیدن جزئیات کلیک کن؛ ترتیب کارت‌ها در نسخهٔ اول فقط خواندنی است");
    const top = card.createDiv({ cls: "ticktick-project-card-top" }); const check = top.createEl("input", { type: "checkbox", attr: { "aria-label": `تکمیل ${task.title}` } }); check.checked = Number(task.status ?? 0) !== 0; check.disabled = !bound || check.checked;
    const priority = taskPriority(task.priority);
    top.createSpan({ text: task.title }); top.createSpan({ cls: `ticktick-project-priority ${priority.className}`, text: `${priority.icon} ${priority.label}`, attr: { title: `اولویت: ${priority.label}` } });
    const description = taskDescription(task); if (description) card.createEl("small", { text: description.slice(0, 100) });
    const meta = card.createDiv({ cls: "ticktick-project-card-meta" }); if (task.dueDate) meta.createSpan({ text: `📅 ${formatPersianDate(task.dueDate, task.timeZone)}` }); if (task.repeatFlag) meta.createSpan({ text: "🔁 تکرار" }); for (const tag of task.tags ?? []) meta.createSpan({ text: `#${tag}` }); if (bound) meta.createSpan({ text: "↗ Markdown" });
    const details = () => new TaskDetailsModal(this.host.app, task, { complete: async () => { await this.host.complete(task); }, load: item => this.host.load(item), edit: item => this.host.edit(item), changed: async () => { await this.host.refresh(); await this.render(); } }).open();
    card.addEventListener("click", details); card.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); details(); } });
    check.addEventListener("click", event => event.stopPropagation()); check.addEventListener("change", async () => { check.disabled = true; try { await this.host.complete(task); new Notice("تسک با مسیر امن Markdown sync تکمیل شد."); await this.render(); } catch (error) { check.checked = false; check.disabled = false; new Notice(error instanceof Error ? error.message : "تکمیل ناموفق بود."); } });
  }
}
