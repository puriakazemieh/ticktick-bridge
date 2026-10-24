import { Notice } from "obsidian";
import { boardColumns, sidebarTree } from "../core/project-board.js";

type Host = { projects: () => Promise<any[]>; tasks: () => any[]; board: (project: any) => Promise<any>; refresh: () => Promise<void>; complete: (task: any) => Promise<void>; binding: (task: any) => any; showCompleted: () => boolean; preferences: () => { selected: string; collapsed: string[] }; savePreferences: (value: { selected: string; collapsed: string[] }) => Promise<void> };

export class ProjectBoard {
  private selected = ""; private collapsed = new Set<string>(); private initialized = false;
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
      const main = root.createDiv({ cls: "ticktick-project-main" }); const refresh = main.createEl("button", { text: "به‌روزرسانی" }); refresh.addEventListener("click", async () => { refresh.disabled = true; try { await this.host.refresh(); await this.render(); } catch (error) { new Notice(error instanceof Error ? error.message : "همگام‌سازی ناموفق بود."); } });
      const project = projects.find(item => String(item.id) === this.selected);
      if (!project) { main.createEl("p", { text: "یک لیست را از نوار کناری انتخاب کن." }); return; }
      const data = await this.host.board(project); main.createEl("h2", { text: project.name });
      const columns = main.createDiv({ cls: "ticktick-project-columns" });
      for (const column of boardColumns(data, this.host.showCompleted())) { const shell = columns.createDiv({ cls: "ticktick-project-column" }); shell.createEl("strong", { text: `${column.name} · ${column.count}` }); shell.createEl("small", { text: column.synthetic ? "ستون نمایشی؛ جابه‌جایی غیرفعال است" : "ترتیب و جابه‌جایی ستون در نسخهٔ اول فقط خواندنی است" }); shell.addEventListener("dragover", event => event.preventDefault()); shell.addEventListener("drop", event => { event.preventDefault(); new Notice("جابه‌جایی بین ستون‌ها تا تأیید رسمی API TickTick غیرفعال است."); });
        for (const group of column.groups) { shell.createEl("h4", { text: group.name }); for (const task of group.tasks) this.card(shell, task); }
      }
    } catch (error) { root.createEl("p", { text: error instanceof Error ? error.message : "دادهٔ پروژه در دسترس نیست." }); }
  }
  private async persistAndRender() { await this.host.savePreferences({ selected: this.selected, collapsed: [...this.collapsed] }); await this.render(); }
  private card(parent: HTMLElement, task: any) {
    const bound = this.host.binding(task); const card = parent.createDiv({ cls: "ticktick-project-card" }); card.draggable = false; card.setAttribute("title", "ترتیب کارت‌ها در نسخهٔ اول فقط خواندنی است");
    const top = card.createDiv({ cls: "ticktick-project-card-top" }); const check = top.createEl("input", { type: "checkbox", attr: { "aria-label": `تکمیل ${task.title}` } }); check.checked = Number(task.status ?? 0) !== 0; check.disabled = !bound || check.checked;
    top.createSpan({ text: task.title }); top.createSpan({ cls: "ticktick-project-priority", text: `P${Number(task.priority ?? 0)}` });
    if (task.desc || task.content) card.createEl("small", { text: String(task.desc ?? task.content).slice(0, 100) });
    const meta = card.createDiv({ cls: "ticktick-project-card-meta" }); if (task.dueDate) meta.createSpan({ text: `📅 ${String(task.dueDate).slice(0, 10)}` }); if (task.repeatFlag) meta.createSpan({ text: "🔁 تکرار" }); for (const tag of task.tags ?? []) meta.createSpan({ text: `#${tag}` }); if (bound) meta.createSpan({ text: "↗ Markdown" });
    check.addEventListener("change", async () => { check.disabled = true; try { await this.host.complete(task); new Notice("تسک با مسیر امن Markdown sync تکمیل شد."); } catch (error) { check.checked = false; check.disabled = false; new Notice(error instanceof Error ? error.message : "تکمیل ناموفق بود."); } });
  }
}
