import { ItemView, Notice, WorkspaceLeaf, setIcon } from "obsidian";
import { VIEW_TYPE } from "../constants";
import { todayInZone } from "../../core/date.js";
import { openTaskEditor, confirmDelete } from "../modals/task-editor-modal";
import { appendChecklistSummary, toTaskPayload, addDescriptionToggle } from "../helpers";
import type TickTickBridgePlugin from "../main";

export class TodayTasksView extends ItemView {
  constructor(leaf: WorkspaceLeaf, private plugin: TickTickBridgePlugin) {
    super(leaf);
  }

  getViewType() { return VIEW_TYPE; }
  getDisplayText() { return "تسک‌های امروز"; }
  getIcon() { return "check-square"; }

  async onOpen() { await this.render(); }

  async render() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("ticktick-today-tasks-panel");
    const header = contentEl.createDiv({ cls: "ticktick-panel-header" });
    header.addClass("ticktick-today-header");
    header.createEl("h2", { text: "تسک‌های امروز" });
    const currentPersianDate = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { weekday: "long", year: "numeric", month: "long", day: "numeric" }).format(new Date(`${todayInZone(this.plugin.settings.timeZone)}T12:00:00Z`));
    header.createSpan({ cls: "ticktick-panel-subtitle", text: currentPersianDate });
    const refresh = header.createEl("button", { text: "بروزرسانی" });
    refresh.addEventListener("click", async () => {
      refresh.disabled = true;
      try { await this.render(); } finally { refresh.disabled = false; }
    });
    try {
      const client = this.plugin.client();
      const day = todayInZone(this.plugin.settings.timeZone);
      const toolbar = contentEl.createDiv({ cls: "ticktick-bridge-toolbar" });
      const addButton = toolbar.createEl("button", { text: "+ افزودن تسک", cls: "mod-cta" });
      addButton.addEventListener("click", async () => {
        addButton.disabled = true;
        try {
          const projects = await client.listProjects();
          const draft = await openTaskEditor(this.app, projects, { dueDate: day });
          if (!draft) return;
          await this.plugin.createTask(toTaskPayload(draft, this.plugin.settings.timeZone));
          new Notice("تسک به TickTick اضافه شد.");
          await this.render();
        } catch (error) {
          new Notice(error instanceof Error ? error.message : "افزودن تسک ناموفق بود.");
        } finally {
          addButton.disabled = false;
        }
      });
      const tasks = await this.plugin.tasksForDay(day);
      if (!tasks.length) contentEl.createEl("p", { text: "تسکی برای امروز یا قبل از آن نیست." });
      for (const task of tasks) {
        const row = contentEl.createDiv({ cls: "ticktick-bridge-task" });
        const check = row.createEl("input", { type: "checkbox" });
        const body = row.createDiv({ cls: "ticktick-bridge-task-body" });
        body.createSpan({ text: task.title });
        appendChecklistSummary(body, task, this.plugin.settings.experimentalChecklistReadOnly);
        body.createEl("small", { text: task.projectName ? ` · ${task.projectName}` : "" });
        const actions = row.createDiv({ cls: "ticktick-bridge-actions" });
        await addDescriptionToggle(this.app, this, body, actions, task);
        const edit = actions.createEl("button", { cls: "mod-icon", attr: { "aria-label": "ویرایش" } });
        setIcon(edit, "pencil");
        const remove = actions.createEl("button", { cls: "mod-warning mod-icon", attr: { "aria-label": "حذف" } });
        setIcon(remove, "trash-2");
        check.addEventListener("change", async () => {
          check.disabled = true;
          try {
            await this.plugin.completeTask(task);
            new Notice("نوبت تسک در TickTick تکمیل شد.");
            await this.render();
          } catch (error) {
            check.checked = false;
            check.disabled = false;
            new Notice(error instanceof Error ? error.message : "تکمیل تسک ناموفق بود.");
          }
        });
        edit.addEventListener("click", async () => {
          try {
            const projects = await client.listProjects();
            const draft = await openTaskEditor(this.app, projects, task);
            if (!draft) return;
            await this.plugin.updateTask(toTaskPayload({ ...task, ...draft }, this.plugin.settings.timeZone));
            new Notice("تسک در TickTick ویرایش شد.");
            await this.render();
          } catch (error) {
            new Notice(error instanceof Error ? error.message : "ویرایش تسک ناموفق بود.");
          }
        });
        remove.addEventListener("click", async () => {
          const accepted = await confirmDelete(this.app, task.title);
          if (!accepted) return;
          try {
            await this.plugin.deleteTask(task);
            new Notice("تسک از TickTick حذف شد.");
            await this.render();
          } catch (error) {
            new Notice(error instanceof Error ? error.message : "حذف تسک ناموفق بود.");
          }
        });
      }
    } catch (error) {
      contentEl.createEl("p", { text: error instanceof Error ? error.message : "اتصال TickTick آماده نیست." });
    }
  }
}
