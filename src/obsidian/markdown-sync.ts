import { App, TFile } from "obsidian";
import { attachTaskBinding, lineLocator, locateLine, parseTaskBinding, removeTaskBinding } from "../core/task-binding.js";
import { diffTask, normalizedTask } from "../core/task-diff.js";
import { parseMarkdownTask } from "../core/markdown-task.js";
import { ManagedStorage } from "./managed-storage";

type SyncSettings = { checkboxImportTag: string; timeZone: string; scheduledCheckboxProjectId: string };
type Action = { type: "create" | "push" | "pull" | "conflict" | "quarantine"; path: string; line: number; message: string; task?: any; remote?: any; binding?: any; diff?: any };
type SyncState = { bindings: Record<string, any>; pending: Record<string, any>; conflicts: Action[] };

const STATE_ID = "markdown-sync-state";
const emptyState = (): SyncState => ({ bindings: {}, pending: {}, conflicts: [] });
const keyFor = (path: string, id: string) => `${path}:${id}`;
const tagPattern = (tag: string) => new RegExp(`(^|\\s)#${tag.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}(?=\\s|$)`, "i");

export class MarkdownSync {
  private state: SyncState = emptyState();
  private loaded = false;
  private previewActions: Action[] = [];
  constructor(private app: App, private storage: ManagedStorage, private getClient: () => any, private getSettings: () => SyncSettings, private projectForNewTask: () => Promise<string>) {}
  async initialize() { await this.load(); }
  private async load() {
    if (this.loaded) return;
    const saved = await this.storage.readJournal(STATE_ID);
    this.state = saved?.metadata && typeof saved.metadata === "object" ? { ...emptyState(), ...saved.metadata } : emptyState();
    this.loaded = true;
  }
  private async save() { await this.storage.persistJournal(STATE_ID, this.state); }
  private taskTag(line: string) { return tagPattern(this.getSettings().checkboxImportTag.trim().replace(/^#/, "") || "ticktick").test(line); }
  async preview(files = this.app.vault.getMarkdownFiles()) {
    await this.load();
    const actions: Action[] = [];
    const seen = new Set<string>();
    for (const file of files) {
      const source = await this.app.vault.read(file); const lines = source.split(/\r?\n/);
      for (let line = 0; line < lines.length; line++) {
        const local = parseMarkdownTask(lines[line], file.path, line); if (!local || !this.taskTag(lines[line])) continue;
        const binding = parseTaskBinding(lines[line]);
        if (!binding) { actions.push({ type: "create", path: file.path, line, message: "چک‌باکس جدید" , task: local }); continue; }
        const identity = `${binding.projectId ?? "legacy"}:${binding.id}`;
        if (seen.has(identity)) { actions.push({ type: "quarantine", path: file.path, line, message: "شناسهٔ TickTick تکراری است.", task: local, binding }); continue; }
        seen.add(identity);
        let remote: any = null;
        try { remote = binding.projectId ? await this.getClient().getTask(binding.projectId, binding.id) : await this.findLegacyTask(binding.id); }
        catch { actions.push({ type: "quarantine", path: file.path, line, message: "وظیفهٔ راه‌دور پیدا نشد یا قابل‌خواندن نیست.", task: local, binding }); continue; }
        if (!remote?.id) { actions.push({ type: "quarantine", path: file.path, line, message: "پاسخ TickTick هویت معتبری ندارد.", task: local, binding }); continue; }
        const stateKey = keyFor(file.path, binding.id); const baseline = this.state.bindings[stateKey]?.baseline ?? normalizedTask(remote);
        const result = diffTask(baseline, { ...local, projectId: binding.projectId }, remote);
        if (result.conflicts.length) actions.push({ type: "conflict", path: file.path, line, message: "تعارض هم‌زمان", task: local, remote, binding, diff: result });
        else if (result.localOnly.length) actions.push({ type: "push", path: file.path, line, message: result.localOnly.join(", "), task: local, remote, binding, diff: result });
        else if (result.remoteOnly.length) actions.push({ type: "pull", path: file.path, line, message: result.remoteOnly.join(", "), task: local, remote, binding, diff: result });
        else this.state.bindings[stateKey] = { locator: lineLocator(lines, line), baseline: normalizedTask(remote), projectId: remote.projectId ?? binding.projectId };
      }
    }
    this.previewActions = actions; this.state.conflicts = actions.filter(action => action.type === "conflict" || action.type === "quarantine"); await this.save();
    return this.summary(actions);
  }
  private async findLegacyTask(id: string) {
    const projects = await this.getClient().listProjects();
    for (const project of projects ?? []) { const data = await this.getClient().getProjectData(project.id); const task = (data.tasks ?? []).find((item: any) => item.id === id); if (task) return { ...task, projectId: project.id }; }
    return null;
  }
  private summary(actions: Action[]) { return { actions, create: actions.filter(x => x.type === "create").length, push: actions.filter(x => x.type === "push").length, pull: actions.filter(x => x.type === "pull").length, conflict: actions.filter(x => x.type === "conflict").length, quarantine: actions.filter(x => x.type === "quarantine").length }; }
  async apply() {
    await this.load();
    const preview = await this.preview();
    const actions = this.previewActions.filter(action => action.type === "create" || action.type === "push" || action.type === "pull");
    if (!actions.length) return { ...preview, applied: 0 };
    await this.storage.writeSnapshot("markdown-sync", { actionCount: actions.length, paths: [...new Set(actions.map(a => a.path))] });
    let applied = 0;
    for (const action of actions) { try { await this.applyAction(action); applied++; } catch (error) { this.state.conflicts.push({ ...action, type: "quarantine", message: error instanceof Error ? error.message : "عملیات نامشخص" }); } }
    await this.save(); await this.storage.writeReport("markdown-sync", { applied, conflicts: this.state.conflicts.length, actionCount: actions.length });
    return { ...preview, applied };
  }
  private async applyAction(action: Action) {
    const file = this.app.vault.getAbstractFileByPath(action.path); if (!(file instanceof TFile)) throw new Error("فایل Markdown جابه‌جا یا حذف شده است.");
    const original = await this.app.vault.read(file); const newline = original.includes("\r\n") ? "\r\n" : "\n"; const lines = original.split(/\r?\n/);
    const line = locateLine(lines, lineLocator(lines, action.line)); if (line === null) throw new Error("خط وظیفه تغییر کرده و به‌شکل امن پیدا نشد.");
    if (action.type === "create") {
      const projectId = await this.projectForNewTask(); const local = parseMarkdownTask(lines[line], action.path, line)!;
      const pendingId = `${action.path}:${line}:${Date.now()}`; this.state.pending[pendingId] = { phase: "prepared", path: action.path, locator: lineLocator(lines, line), createdAt: new Date().toISOString() }; await this.save();
      const remote = await this.getClient().createTask({ title: local.title, projectId, timeZone: this.getSettings().timeZone, isAllDay: true });
      if (!remote?.id || !remote?.projectId) { this.state.pending[pendingId].phase = "ambiguous"; await this.save(); throw new Error("ایجاد TickTick هویت قابل‌تأیید برنگرداند؛ دوباره تلاش خودکار انجام نشد."); }
      lines[line] = attachTaskBinding(lines[line], { id: remote.id, projectId: remote.projectId }); await this.app.vault.modify(file, lines.join(newline));
      this.state.bindings[keyFor(action.path, remote.id)] = { locator: lineLocator(lines, line), baseline: normalizedTask(remote), projectId: remote.projectId }; delete this.state.pending[pendingId]; return;
    }
    const binding = action.binding; const remote = await this.getClient().getTask(binding.projectId, binding.id);
    if (!remote?.id) throw new Error("وظیفهٔ TickTick پیش از نوشتن دوباره خوانده نشد.");
    if (action.type === "push") {
      if (action.diff.localOnly.includes("completed")) await this.getClient().completeTask(binding.projectId, binding.id);
      const changed = action.diff.localOnly.filter((field: string) => field !== "completed");
      if (changed.length) await this.getClient().updateTask({ ...remote, title: action.task.title, projectId: binding.projectId });
      this.state.bindings[keyFor(action.path, binding.id)] = { locator: lineLocator(lines, line), baseline: normalizedTask({ ...remote, title: action.task.title, completed: action.task.completed }), projectId: binding.projectId };
    } else {
      const next = action.diff.merged; let updated = lines[line];
      if (action.diff.remoteOnly.includes("title") && action.task?.title) updated = updated.replace(action.task.title, String(next.title));
      if (action.diff.remoteOnly.includes("completed") && !action.diff.recurringRemoteCompletion) updated = updated.replace(/(\s*[-*+]\s+\[)[ xX](\])/, `$1${next.completed ? "x" : " "}$2`);
      lines[line] = updated; await this.app.vault.modify(file, lines.join(newline)); this.state.bindings[keyFor(action.path, binding.id)] = { locator: lineLocator(lines, line), baseline: normalizedTask(remote), projectId: binding.projectId };
    }
  }
  async conflicts() { await this.load(); return this.state.conflicts; }
  bindingForTask(taskId: string) {
    const entry = Object.entries(this.state.bindings).find(([key]) => key.endsWith(`:${taskId}`));
    return entry ? { key: entry[0], ...entry[1] } : null;
  }
  async rescheduleBoundTask(taskId: string, targetDay: string) {
    await this.load();
    const binding = this.bindingForTask(taskId);
    if (!binding?.projectId) throw new Error("این task به یک خط Markdown تأییدشده متصل نیست.");
    await this.storage.writeSnapshot("calendar-reschedule", { taskId, projectId: binding.projectId, targetDay });
    const remote = await this.getClient().getTask(binding.projectId, taskId);
    if (!remote?.id) throw new Error("وظیفهٔ TickTick پیش از جابه‌جایی دوباره خوانده نشد.");
    if (remote.repeatFlag) throw new Error("برای تسک تکرارشونده، سری را از ویرایشگر TickTick تغییر بده؛ occurrence محلی ساخته نمی‌شود.");
    const oldStart = String(remote.startDate ?? "").slice(0, 10); const oldDue = String(remote.dueDate ?? "").slice(0, 10);
    const duration = oldStart && oldDue ? Math.max(0, Math.round((Date.parse(`${oldDue}T12:00:00Z`) - Date.parse(`${oldStart}T12:00:00Z`)) / 86400000)) : 0;
    const dueDate = duration ? new Date(`${targetDay}T12:00:00Z`) : null;
    if (dueDate) dueDate.setUTCDate(dueDate.getUTCDate() + duration);
    const next = { ...remote, startDate: `${targetDay}T00:00:00+03:30`, dueDate: `${(dueDate ? dueDate.toISOString().slice(0, 10) : targetDay)}T00:00:00+03:30`, isAllDay: true };
    await this.getClient().updateTask(next);
    this.state.bindings[binding.key] = { ...binding, baseline: normalizedTask(next) };
    await this.save(); await this.storage.writeReport("calendar-reschedule", { taskId, projectId: binding.projectId, oldStart, oldDue, targetDay });
    return next;
  }
  async completeBoundTask(taskId: string) {
    await this.load();
    const binding = this.bindingForTask(taskId);
    if (!binding?.projectId) throw new Error("این task به یک خط Markdown تأییدشده متصل نیست.");
    await this.storage.writeSnapshot("board-complete", { taskId, projectId: binding.projectId });
    const remote = await this.getClient().getTask(binding.projectId, taskId);
    if (!remote?.id) throw new Error("وظیفهٔ TickTick پیش از تکمیل دوباره خوانده نشد.");
    await this.getClient().completeTask(binding.projectId, taskId);
    this.state.bindings[binding.key] = { ...binding, baseline: normalizedTask({ ...remote, completed: true }) };
    await this.save(); await this.storage.writeReport("board-complete", { taskId, projectId: binding.projectId });
  }
  async resolve(conflict: Action, choice: "local" | "remote" | "merge" | "unbind" | "skip") {
    await this.load();
    if (choice === "unbind") {
      const file = this.app.vault.getAbstractFileByPath(conflict.path);
      if (file instanceof TFile) { const text = await this.app.vault.read(file); const lines = text.split(/\r?\n/); const line = locateLine(lines, lineLocator(lines, conflict.line)); if (line !== null) await this.app.vault.modify(file, lines.map((value, index) => index === line ? removeTaskBinding(value) : value).join(text.includes("\r\n") ? "\r\n" : "\n")); }
    }
    if ((choice === "local" || choice === "remote") && conflict.binding && conflict.task && conflict.remote) {
      const file = this.app.vault.getAbstractFileByPath(conflict.path);
      const fresh = await this.getClient().getTask(conflict.binding.projectId, conflict.binding.id);
      if (!fresh?.id) throw new Error("وظیفهٔ TickTick برای حل تعارض دوباره خوانده نشد.");
      if (choice === "local") {
        if (conflict.task.completed && Number(fresh.status) === 0) await this.getClient().completeTask(conflict.binding.projectId, conflict.binding.id);
        await this.getClient().updateTask({ ...fresh, title: conflict.task.title, projectId: conflict.binding.projectId, status: conflict.task.completed ? 2 : 0 });
        this.state.bindings[keyFor(conflict.path, conflict.binding.id)] = { baseline: normalizedTask({ ...fresh, title: conflict.task.title, completed: conflict.task.completed }), projectId: conflict.binding.projectId };
      } else if (file instanceof TFile) {
        const text = await this.app.vault.read(file); const lines = text.split(/\r?\n/); const line = locateLine(lines, lineLocator(lines, conflict.line));
        if (line === null) throw new Error("خط Markdown برای حل تعارض امن پیدا نشد.");
        let updated = lines[line].replace(conflict.task.title, String(fresh.title ?? conflict.task.title));
        updated = updated.replace(/(\s*[-*+]\s+\[)[ xX](\])/, `$1${Number(fresh.status) !== 0 ? "x" : " "}$2`);
        lines[line] = updated; await this.app.vault.modify(file, lines.join(text.includes("\r\n") ? "\r\n" : "\n"));
        this.state.bindings[keyFor(conflict.path, conflict.binding.id)] = { baseline: normalizedTask(fresh), projectId: conflict.binding.projectId };
      }
    }
    if (choice !== "merge" && choice !== "skip") this.state.conflicts = this.state.conflicts.filter(item => item !== conflict);
    await this.save(); await this.storage.writeReport("markdown-sync-conflict", { choice, path: conflict.path, line: conflict.line, fields: conflict.diff?.conflicts?.map((item: any) => item.field) ?? [] });
  }
  async repairLegacyBindings() { const result = await this.preview(); return { repaired: 0, ...result }; }
}
