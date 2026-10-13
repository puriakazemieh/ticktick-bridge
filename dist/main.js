"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/obsidian/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => TickTickBridgePlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");

// src/core/date.js
function toDateKey(value) {
  if (!value) return null;
  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? null;
}
function todayInZone(timeZone = "Asia/Tehran", now = /* @__PURE__ */ new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);
  const value = Object.fromEntries(parts.filter(({ type }) => type !== "literal").map(({ type, value: value2 }) => [type, value2]));
  return `${value.year}-${value.month}-${value.day}`;
}
function isScheduledForDay(task, day) {
  if (task.status !== void 0 && task.status !== 0) return false;
  const due = toDateKey(task.dueDate);
  const start = toDateKey(task.startDate);
  if (!due) return false;
  if (start && day >= start && day <= due) return true;
  return due <= day;
}

// src/core/ticktick-client.js
var TickTickApiError = class extends Error {
  constructor(message, { status, body } = {}) {
    super(message);
    this.name = "TickTickApiError";
    this.status = status;
    this.body = body;
  }
};
async function fetchTransport(url, init) {
  const response = await fetch(url, init);
  return { status: response.status, text: await response.text() };
}
function parseBody(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
var TickTickClient = class {
  constructor({ token, transport = fetchTransport, baseUrl = "https://api.ticktick.com/open/v1" }) {
    if (!token?.trim()) throw new Error("TickTick API token is required.");
    this.token = token.trim();
    this.transport = transport;
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }
  async request(path, { method = "GET", body } = {}) {
    const response = await this.transport(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json"
      },
      body: body === void 0 ? void 0 : JSON.stringify(body)
    });
    const parsed = parseBody(response.text);
    if (response.status < 200 || response.status >= 300) {
      throw new TickTickApiError("TickTick request failed.", { status: response.status, body: parsed });
    }
    return parsed;
  }
  listProjects() {
    return this.request("/project");
  }
  getProject(projectId) {
    return this.request(`/project/${encodeURIComponent(projectId)}`);
  }
  getProjectData(projectId) {
    return this.request(`/project/${encodeURIComponent(projectId)}/data`);
  }
  createTask(task) {
    return this.request("/task", { method: "POST", body: task });
  }
  updateTask(task) {
    if (!task?.id) throw new Error("Task id is required for update.");
    return this.request(`/task/${encodeURIComponent(task.id)}`, { method: "POST", body: task });
  }
  deleteTask(projectId, taskId) {
    return this.request(`/project/${encodeURIComponent(projectId)}/task/${encodeURIComponent(taskId)}`, { method: "DELETE" });
  }
  /** TickTick advances recurring tasks itself; never calculate the next date locally. */
  completeTask(projectId, taskId) {
    return this.request(`/project/${encodeURIComponent(projectId)}/task/${encodeURIComponent(taskId)}/complete`, { method: "POST" });
  }
  async listOpenTasks() {
    const projects = await this.listProjects();
    const collections = await Promise.all(projects.map(async (project) => {
      const data = await this.getProjectData(project.id);
      return (data.tasks ?? []).map((task) => ({ ...task, projectName: project.name }));
    }));
    return collections.flat().filter((task) => task.status === 0);
  }
  async tasksForDay(day) {
    const tasks = await this.listOpenTasks();
    return tasks.filter((task) => isScheduledForDay(task, day));
  }
};

// src/obsidian/main.ts
var VIEW_TYPE = "ticktick-bridge-today";
var DEFAULT_SETTINGS = {
  apiToken: "",
  timeZone: "Asia/Tehran",
  dailyNoteFolder: "Journal",
  projectRoot: "Projects/\u0628\u0631\u0646\u0627\u0645\u0647 \u06A9\u0644\u0627\u0646 \u06F1\u06F4\u06F0\u06F5"
};
var TickTickBridgePlugin = class extends import_obsidian.Plugin {
  settings = DEFAULT_SETTINGS;
  async onload() {
    const savedSettings = await this.loadData();
    this.settings = { ...DEFAULT_SETTINGS, ...savedSettings ?? {} };
    this.addSettingTab(new TickTickBridgeSettings(this.app, this));
    this.registerView(VIEW_TYPE, (leaf) => new TodayTasksView(leaf, this));
    this.registerMarkdownCodeBlockProcessor("ticktick-today", async (_source, element) => this.renderTodayBlock(element));
    this.addRibbonIcon("check-square", "TickTick Bridge: \u062A\u0633\u06A9\u200C\u0647\u0627\u06CC \u0627\u0645\u0631\u0648\u0632", () => this.openTodayView());
    this.addCommand({ id: "open-today-tasks", name: "Open today's TickTick tasks", callback: () => this.openTodayView() });
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  client() {
    if (!this.settings.apiToken.trim()) throw new Error("\u0627\u0628\u062A\u062F\u0627 API Token \u0631\u0627 \u062F\u0631 \u062A\u0646\u0638\u06CC\u0645\u0627\u062A TickTick Bridge \u0648\u0627\u0631\u062F \u06A9\u0646.");
    return new TickTickClient({
      token: this.settings.apiToken,
      transport: async (url, init) => {
        const response = await (0, import_obsidian.requestUrl)({ url, method: init.method, headers: init.headers, body: init.body, throw: false });
        return { status: response.status, text: response.text };
      }
    });
  }
  async openTodayView() {
    const leaf = this.app.workspace.getRightLeaf(false) ?? this.app.workspace.getLeaf("tab");
    await leaf.setViewState({ type: VIEW_TYPE, active: true });
    this.app.workspace.revealLeaf(leaf);
  }
  async renderTodayBlock(element) {
    element.replaceChildren();
    const root = element.createDiv({ cls: "ticktick-bridge-inline" });
    try {
      const client = this.client();
      const day = todayInZone(this.settings.timeZone);
      const tasks = await client.tasksForDay(day);
      if (!tasks.length) {
        root.createEl("p", { text: "\u062A\u0633\u06A9\u06CC \u0628\u0631\u0627\u06CC \u0627\u0645\u0631\u0648\u0632 \u06CC\u0627 \u0642\u0628\u0644 \u0627\u0632 \u0622\u0646 \u0646\u06CC\u0633\u062A." });
        return;
      }
      for (const task of tasks) {
        const row = root.createDiv({ cls: "ticktick-bridge-task" });
        const check = row.createEl("input", { type: "checkbox", attr: { "aria-label": `\u0627\u0646\u062C\u0627\u0645 ${task.title}` } });
        row.createSpan({ text: task.title });
        row.createEl("small", { text: task.projectName ? ` \xB7 ${task.projectName}` : "" });
        check.addEventListener("change", async () => {
          check.disabled = true;
          try {
            await client.completeTask(task.projectId, task.id);
            new import_obsidian.Notice("\u0646\u0648\u0628\u062A \u062A\u0633\u06A9 \u062F\u0631 TickTick \u062A\u06A9\u0645\u06CC\u0644 \u0634\u062F.");
            await this.renderTodayBlock(element);
          } catch (error) {
            check.checked = false;
            check.disabled = false;
            new import_obsidian.Notice(error instanceof Error ? error.message : "\u062A\u06A9\u0645\u06CC\u0644 \u062A\u0633\u06A9 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
          }
        });
      }
    } catch (error) {
      root.createEl("p", { text: error instanceof Error ? error.message : "\u0627\u062A\u0635\u0627\u0644 TickTick \u0622\u0645\u0627\u062F\u0647 \u0646\u06CC\u0633\u062A." });
    }
  }
};
var TodayTasksView = class extends import_obsidian.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
  getViewType() {
    return VIEW_TYPE;
  }
  getDisplayText() {
    return "\u062A\u0633\u06A9\u200C\u0647\u0627\u06CC \u0627\u0645\u0631\u0648\u0632";
  }
  async onOpen() {
    await this.render();
  }
  async render() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "\u062A\u0633\u06A9\u200C\u0647\u0627\u06CC \u0627\u0645\u0631\u0648\u0632" });
    try {
      const client = this.plugin.client();
      const day = todayInZone(this.plugin.settings.timeZone);
      const toolbar = contentEl.createDiv({ cls: "ticktick-bridge-toolbar" });
      const addButton = toolbar.createEl("button", { text: "+ \u0627\u0641\u0632\u0648\u062F\u0646 \u062A\u0633\u06A9", cls: "mod-cta" });
      addButton.addEventListener("click", async () => {
        addButton.disabled = true;
        try {
          const projects = await client.listProjects();
          const draft = await openTaskEditor(this.app, projects, { dueDate: day });
          if (!draft) return;
          await client.createTask(toTaskPayload(draft, this.plugin.settings.timeZone));
          new import_obsidian.Notice("\u062A\u0633\u06A9 \u0628\u0647 TickTick \u0627\u0636\u0627\u0641\u0647 \u0634\u062F.");
          await this.render();
        } catch (error) {
          new import_obsidian.Notice(error instanceof Error ? error.message : "\u0627\u0641\u0632\u0648\u062F\u0646 \u062A\u0633\u06A9 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
        } finally {
          addButton.disabled = false;
        }
      });
      const tasks = await client.tasksForDay(day);
      if (!tasks.length) contentEl.createEl("p", { text: "\u062A\u0633\u06A9\u06CC \u0628\u0631\u0627\u06CC \u0627\u0645\u0631\u0648\u0632 \u06CC\u0627 \u0642\u0628\u0644 \u0627\u0632 \u0622\u0646 \u0646\u06CC\u0633\u062A." });
      for (const task of tasks) {
        const row = contentEl.createDiv({ cls: "ticktick-bridge-task" });
        const check = row.createEl("input", { type: "checkbox" });
        row.createSpan({ text: task.title });
        row.createEl("small", { text: task.projectName ? ` \xB7 ${task.projectName}` : "" });
        const actions = row.createDiv({ cls: "ticktick-bridge-actions" });
        const edit = actions.createEl("button", { text: "\u0648\u06CC\u0631\u0627\u06CC\u0634" });
        const remove = actions.createEl("button", { text: "\u062D\u0630\u0641", cls: "mod-warning" });
        check.addEventListener("change", async () => {
          check.disabled = true;
          try {
            await client.completeTask(task.projectId, task.id);
            new import_obsidian.Notice("\u0646\u0648\u0628\u062A \u062A\u0633\u06A9 \u062F\u0631 TickTick \u062A\u06A9\u0645\u06CC\u0644 \u0634\u062F.");
            await this.render();
          } catch (error) {
            check.checked = false;
            check.disabled = false;
            new import_obsidian.Notice(error instanceof Error ? error.message : "\u062A\u06A9\u0645\u06CC\u0644 \u062A\u0633\u06A9 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
          }
        });
        edit.addEventListener("click", async () => {
          try {
            const projects = await client.listProjects();
            const draft = await openTaskEditor(this.app, projects, task);
            if (!draft) return;
            await client.updateTask(toTaskPayload({ ...task, ...draft }, this.plugin.settings.timeZone));
            new import_obsidian.Notice("\u062A\u0633\u06A9 \u062F\u0631 TickTick \u0648\u06CC\u0631\u0627\u06CC\u0634 \u0634\u062F.");
            await this.render();
          } catch (error) {
            new import_obsidian.Notice(error instanceof Error ? error.message : "\u0648\u06CC\u0631\u0627\u06CC\u0634 \u062A\u0633\u06A9 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
          }
        });
        remove.addEventListener("click", async () => {
          const accepted = await confirmDelete(this.app, task.title);
          if (!accepted) return;
          try {
            await client.deleteTask(task.projectId, task.id);
            new import_obsidian.Notice("\u062A\u0633\u06A9 \u0627\u0632 TickTick \u062D\u0630\u0641 \u0634\u062F.");
            await this.render();
          } catch (error) {
            new import_obsidian.Notice(error instanceof Error ? error.message : "\u062D\u0630\u0641 \u062A\u0633\u06A9 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
          }
        });
      }
    } catch (error) {
      contentEl.createEl("p", { text: error instanceof Error ? error.message : "\u0627\u062A\u0635\u0627\u0644 TickTick \u0622\u0645\u0627\u062F\u0647 \u0646\u06CC\u0633\u062A." });
    }
  }
};
function toTaskPayload(draft, timeZone) {
  const { projectName, dueDate, ...task } = draft;
  const day = String(dueDate ?? "").slice(0, 10);
  return {
    ...task,
    title: String(task.title ?? "").trim(),
    desc: String(task.desc ?? task.content ?? "").trim(),
    content: "",
    projectId: task.projectId,
    dueDate: day ? `${day}T00:00:00+0330` : null,
    startDate: task.startDate ?? null,
    timeZone,
    isAllDay: true,
    repeatFlag: String(task.repeatFlag ?? "").trim() || null
  };
}
var TaskEditorModal = class extends import_obsidian.Modal {
  constructor(app, projects, initial) {
    super(app);
    this.projects = projects;
    this.initial = initial;
  }
  resolveResult;
  result = new Promise((resolve) => this.resolveResult = resolve);
  finished = false;
  finish(value) {
    if (!this.finished) {
      this.finished = true;
      this.resolveResult(value);
      this.close();
    }
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h2", { text: this.initial.id ? "\u0648\u06CC\u0631\u0627\u06CC\u0634 \u062A\u0633\u06A9" : "\u0627\u0641\u0632\u0648\u062F\u0646 \u062A\u0633\u06A9" });
    let title = String(this.initial.title ?? "");
    let description = String(this.initial.desc ?? this.initial.content ?? "");
    let projectId = String(this.initial.projectId ?? this.projects[0]?.id ?? "");
    let dueDate = String(this.initial.dueDate ?? "").slice(0, 10);
    let repeatFlag = String(this.initial.repeatFlag ?? "");
    new import_obsidian.Setting(contentEl).setName("\u0639\u0646\u0648\u0627\u0646").addText((input) => {
      input.setValue(title).onChange((value) => title = value);
      input.inputEl.dir = "rtl";
      input.inputEl.style.width = "100%";
    });
    new import_obsidian.Setting(contentEl).setName("\u067E\u0631\u0648\u0698\u0647").addDropdown((dropdown) => {
      this.projects.forEach((project) => dropdown.addOption(project.id, project.name));
      dropdown.setValue(projectId).onChange((value) => projectId = value);
    });
    new import_obsidian.Setting(contentEl).setName("\u062A\u0627\u0631\u06CC\u062E").addText((input) => {
      input.setPlaceholder("YYYY-MM-DD").setValue(dueDate).onChange((value) => dueDate = value);
      input.inputEl.dir = "ltr";
    });
    new import_obsidian.Setting(contentEl).setName("\u062A\u06A9\u0631\u0627\u0631").setDesc("\u0627\u062E\u062A\u06CC\u0627\u0631\u06CC\u061B \u0646\u0645\u0648\u0646\u0647: RRULE:FREQ=WEEKLY;BYDAY=SA,SU").addText((input) => {
      input.setValue(repeatFlag).onChange((value) => repeatFlag = value);
      input.inputEl.dir = "ltr";
      input.inputEl.style.width = "100%";
    });
    new import_obsidian.Setting(contentEl).setName("\u062A\u0648\u0636\u06CC\u062D\u0627\u062A").addTextArea((input) => {
      input.setValue(description).onChange((value) => description = value);
      input.inputEl.dir = "rtl";
      input.inputEl.rows = 5;
      input.inputEl.style.width = "100%";
    });
    const actions = contentEl.createDiv({ cls: "modal-button-container" });
    actions.createEl("button", { text: "\u0627\u0646\u0635\u0631\u0627\u0641" }).addEventListener("click", () => this.finish(null));
    actions.createEl("button", { text: "\u0630\u062E\u06CC\u0631\u0647", cls: "mod-cta" }).addEventListener("click", () => {
      if (!title.trim() || !projectId) return new import_obsidian.Notice("\u0639\u0646\u0648\u0627\u0646 \u0648 \u067E\u0631\u0648\u0698\u0647 \u0631\u0627 \u0648\u0627\u0631\u062F \u06A9\u0646.");
      if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return new import_obsidian.Notice("\u062A\u0627\u0631\u06CC\u062E \u0628\u0627\u06CC\u062F \u0628\u0647 \u0634\u06A9\u0644 YYYY-MM-DD \u0628\u0627\u0634\u062F.");
      this.finish({ ...this.initial, title: title.trim(), desc: description.trim(), projectId, dueDate, repeatFlag: repeatFlag.trim() });
    });
  }
  onClose() {
    this.contentEl.empty();
    if (!this.finished) {
      this.finished = true;
      this.resolveResult(null);
    }
  }
  openAndWait() {
    this.open();
    return this.result;
  }
};
var DeleteConfirmationModal = class extends import_obsidian.Modal {
  constructor(app, title) {
    super(app);
    this.title = title;
  }
  resolveResult;
  result = new Promise((resolve) => this.resolveResult = resolve);
  finished = false;
  finish(value) {
    if (!this.finished) {
      this.finished = true;
      this.resolveResult(value);
      this.close();
    }
  }
  onOpen() {
    this.contentEl.createEl("h2", { text: "\u062D\u0630\u0641 \u062A\u0633\u06A9" });
    this.contentEl.createEl("p", { text: `\u062A\u0633\u06A9 \xAB${this.title}\xBB \u0627\u0632 TickTick \u062D\u0630\u0641 \u0634\u0648\u062F\u061F` });
    const actions = this.contentEl.createDiv({ cls: "modal-button-container" });
    actions.createEl("button", { text: "\u0627\u0646\u0635\u0631\u0627\u0641" }).addEventListener("click", () => this.finish(false));
    actions.createEl("button", { text: "\u062D\u0630\u0641", cls: "mod-warning" }).addEventListener("click", () => this.finish(true));
  }
  onClose() {
    this.contentEl.empty();
    if (!this.finished) {
      this.finished = true;
      this.resolveResult(false);
    }
  }
  openAndWait() {
    this.open();
    return this.result;
  }
};
function openTaskEditor(app, projects, initial) {
  return new TaskEditorModal(app, projects, initial).openAndWait();
}
function confirmDelete(app, title) {
  return new DeleteConfirmationModal(app, title).openAndWait();
}
var TickTickBridgeSettings = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "TickTick Bridge" });
    new import_obsidian.Setting(containerEl).setName("API Token").setDesc("\u062A\u0648\u06A9\u0646 \u0634\u062E\u0635\u06CC TickTick\u061B \u0641\u0642\u0637 \u062F\u0631 \u062A\u0646\u0638\u06CC\u0645\u0627\u062A \u0627\u0641\u0632\u0648\u0646\u0647 \u0646\u06AF\u0647\u062F\u0627\u0631\u06CC \u0645\u06CC\u200C\u0634\u0648\u062F.").addText((input) => {
      input.inputEl.type = "password";
      input.setValue(this.plugin.settings.apiToken).onChange(async (value) => {
        this.plugin.settings.apiToken = value.trim();
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian.Setting(containerEl).setName("Time zone").addText((input) => input.setValue(this.plugin.settings.timeZone).onChange(async (value) => {
      this.plugin.settings.timeZone = value || "Asia/Tehran";
      await this.plugin.saveSettings();
    }));
    new import_obsidian.Setting(containerEl).setName("Daily notes folder").addText((input) => input.setValue(this.plugin.settings.dailyNoteFolder).onChange(async (value) => {
      this.plugin.settings.dailyNoteFolder = value;
      await this.plugin.saveSettings();
    }));
    new import_obsidian.Setting(containerEl).setName("Project root").addText((input) => input.setValue(this.plugin.settings.projectRoot).onChange(async (value) => {
      this.plugin.settings.projectRoot = value;
      await this.plugin.saveSettings();
    }));
  }
};
