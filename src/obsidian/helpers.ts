import { App, Component, MarkdownRenderer, Platform, setIcon } from "obsidian";
import { checklistSummary } from "../core/checklist.js";
import { isHabitScheduledForDay, jalaliDateKeyToGregorian } from "../core/date.js";
import type { BridgeCache, TaskDraft, TickTickTask, TickTickHabit } from "./types";

export function currentPlatformName() {
  if (Platform.isWin) return "Windows";
  if (Platform.isMacOS) return "macOS";
  if (Platform.isLinux) return "Linux";
  return "Unknown";
}

export function appendChecklistSummary(parent: HTMLElement, task: Pick<TickTickTask, "items">, enabled: boolean) {
  const summary = checklistSummary(task.items);
  if (!summary.total) return;
  const detail = parent.createEl("details", { cls: "ticktick-checklist-readonly" });
  detail.createEl("summary", { text: `Checklist: ${summary.completed}/${summary.total}${enabled ? " · فقط خواندنی" : " · غیرفعال"}` });
  for (const item of (task.items ?? [])) {
    detail.createEl("div", { text: `${Number(item.status ?? 0) !== 0 ? "☑" : "☐"} ${String(item.title ?? item.content ?? "")}` });
  }
}

export function formatTaskDate(dueDate: string, today: string) {
  if (!dueDate) return "بدون تاریخ";
  if (dueDate === today) return "امروز";
  const date = new Date(`${dueDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return dueDate;
  const label = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric", month: "numeric", day: "numeric" }).format(date);
  return dueDate < today ? `عقب‌افتاده · ${label}` : label;
}

export function formatTaskSchedule(startDate: string, dueDate: string, today: string) {
  if (!startDate || !dueDate || startDate === dueDate) return formatTaskDate(dueDate, today);
  const format = (dateKey: string) => {
    const value = new Date(`${dateKey}T12:00:00`);
    return Number.isNaN(value.getTime()) ? dateKey : new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric", month: "numeric", day: "numeric" }).format(value);
  };
  return `از ${format(startDate)} تا ${format(dueDate)}`;
}

export function formatRecurringTaskSchedule(startDate: string, dueDate: string, today: string) {
  if (!startDate || !dueDate || startDate === dueDate) return formatTaskSchedule(startDate, dueDate, today);
  const weekday = (dateKey: string) => new Intl.DateTimeFormat("fa-IR-u-ca-persian", { weekday: "long" }).format(new Date(`${dateKey}T12:00:00`));
  return `از ${weekday(startDate)} تا ${weekday(dueDate)}`;
}

export function cleanTaskDescription(value: unknown) {
  return String(value ?? "")
    .replace(/^\s*\[[^\]]+\]\(obsidian:\/\/[^)]+\)\s*$/gim, "")
    .replace(/obsidian:\/\/[^\s<\])]+/gi, "")
    .replace(/^\s*-{10,}\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function cleanTaskTitle(value: unknown) {
  return String(value ?? "")
    .replace(/\s*\[[^\]]+\]\(obsidian:\/\/[^)]+\)\s*/gi, " ")
    .trim();
}

export function habitIcon(icon: unknown) {
  const value = String(icon ?? "").toLowerCase();
  if (value.includes("reading")) return "📖";
  if (value.includes("listen") || value.includes("music")) return "🎧";
  if (value.includes("stretch") || value.includes("sport") || value.includes("exercise")) return "🧘";
  if (value.includes("language") || value.includes("learn")) return "🗣️";
  return "✓";
}

export function habitDashboardSection(habit: { sectionName?: unknown }) {
  return String(habit.sectionName ?? "بدون دسته");
}

export function habitDashboardCadence(habit: { tags?: unknown; tagNames?: unknown; tag?: unknown; repeatRule?: unknown }) {
  const values = [habit.tags, habit.tagNames, habit.tag]
    .flatMap(value => Array.isArray(value) ? value : value == null ? [] : [value])
    .map(value => String(value).trim().toLocaleLowerCase("fa"));
  if (values.some(value => value === "روزانه" || value === "daily")) return "عادت‌های روزانه";
  if (values.some(value => value === "هفتگی" || value === "weekly")) return "عادت‌های هفتگی";
  return String(habit.repeatRule ?? "").toUpperCase().includes("FREQ=WEEKLY") ? "عادت‌های هفتگی" : "عادت‌های روزانه";
}

export function habitDashboardGroup(habit: { sectionName?: unknown; tags?: unknown; tagNames?: unknown; tag?: unknown; repeatRule?: unknown }) {
  return `${habitDashboardCadence(habit)}\u0000${habitDashboardSection(habit)}`;
}

export function habitDashboardGroupLabel(group: string) {
  const [cadence, section] = group.split("\u0000");
  return section ? `${cadence} · ${section}` : cadence;
}

export function habitStreak(history: Array<{ completed: boolean }>) {
  let total = 0;
  for (const entry of history.slice().reverse()) {
    if (!entry.completed) break;
    total++;
  }
  return total;
}

export function parseRecurringDays(repeatFlag: unknown, dateKey?: string): string {
  const rule = String(repeatFlag ?? "").toUpperCase();
  const match = rule.match(/BYDAY=([^;]+)/);
  const map: Record<string, string> = { "SA": "شنبه", "SU": "یکشنبه", "MO": "دوشنبه", "TU": "سه‌شنبه", "WE": "چهارشنبه", "TH": "پنج‌شنبه", "FR": "جمعه" };
  const order = ["SA", "SU", "MO", "TU", "WE", "TH", "FR"];
  const jsDayMap = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

  let days: string[] = [];
  if (match) {
    days = match[1].split(",");
  } else if (rule.includes("FREQ=WEEKLY") && dateKey) {
    const d = new Date(`${dateKey}T12:00:00`);
    if (!Number.isNaN(d.getTime())) {
      days = [jsDayMap[d.getDay()]];
    }
  }

  if (days.length > 0) {
    days.sort((a, b) => order.indexOf(a) - order.indexOf(b));
    if (days.length === 7) return "هر روز";
    const mapped = days.map(d => map[d]).filter(Boolean);
    if (days.length >= 2 && days.join(",") === order.slice(order.indexOf(days[0]), order.indexOf(days[0]) + days.length).join(",")) {
      return `از ${mapped[0]} تا ${mapped[mapped.length - 1]}`;
    }
    return mapped.map(d => d + "‌ها").join("، ");
  }

  if (rule.includes("FREQ=DAILY")) return "هر روز";
  if (rule.includes("FREQ=WEEKLY")) return "هر هفته";
  if (rule.includes("FREQ=MONTHLY")) return "ماهانه";
  if (rule.includes("FREQ=YEARLY")) return "سالانه";
  return "";
}

export function recurringKind(repeatFlag: unknown): "weekly" | "monthly" | "yearly" | "daily" | "other" {
  const rule = String(repeatFlag ?? "").toUpperCase();
  if (rule.includes("FREQ=WEEKLY")) return "weekly";
  if (rule.includes("FREQ=MONTHLY")) return "monthly";
  if (rule.includes("FREQ=YEARLY")) return "yearly";
  if (rule.includes("FREQ=DAILY")) return "daily";
  return "other";
}

export function recurringTaskKind(task: Record<string, unknown>): ReturnType<typeof recurringKind> {
  const tagValues = [task.tags, task.tagNames, task.tag]
    .flatMap(value => Array.isArray(value) ? value : value == null ? [] : [value])
    .map(value => String(value).trim().replace(/^#/, "").toLocaleLowerCase("fa"));
  const taggedKind = (name: string, kind: ReturnType<typeof recurringKind>) =>
    tagValues.includes(name) || new RegExp(`(?:^|\\s)#${name}(?=\\s|$)`, "iu").test(`${task.title ?? ""}\n${task.content ?? ""}\n${task.desc ?? ""}`) ? kind : null;
  return taggedKind("روزانه", "daily") ?? taggedKind("هفتگی", "weekly") ?? taggedKind("ماهانه", "monthly") ?? taggedKind("سالانه", "yearly") ?? recurringKind(task.repeatFlag);
}

export function shiftIsoDay(day: string, amount: number) {
  const value = new Date(`${day}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

export function normalizeCache(value: unknown): BridgeCache {
  const candidate = value as Partial<BridgeCache> | null;
  if (!candidate || typeof candidate !== "object") {
    return { savedAt: "", tasks: [], projects: [], projectBoards: {}, habits: [], habitCheckins: {}, pending: [], conflicts: [], rateLimitedUntil: 0 };
  }
  return {
    savedAt: typeof candidate.savedAt === "string" ? candidate.savedAt : "",
    tasks: Array.isArray(candidate.tasks) ? candidate.tasks : [],
    projects: Array.isArray(candidate.projects) ? candidate.projects : [],
    projectBoards: candidate.projectBoards && typeof candidate.projectBoards === "object" ? candidate.projectBoards : {},
    habits: Array.isArray(candidate.habits) ? candidate.habits : [],
    habitCheckins: candidate.habitCheckins && typeof candidate.habitCheckins === "object" ? candidate.habitCheckins : {},
    pending: Array.isArray(candidate.pending) ? candidate.pending : [],
    conflicts: Array.isArray(candidate.conflicts) ? candidate.conflicts : [],
    rateLimitedUntil: Math.max(0, Number(candidate.rateLimitedUntil ?? 0)),
  };
}

export function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function nextWeekday(day: string, weekday: number, forceNextWeek: boolean) {
  const current = new Date(`${day}T12:00:00Z`).getUTCDay();
  let offset = (weekday - current + 7) % 7;
  if (forceNextWeek || offset === 0) offset += 7;
  return shiftIsoDay(day, offset);
}

export function checkboxSchedule(source: string, today: string) {
  const rules: Array<{ pattern: RegExp; due: () => string }> = [
    { pattern: /#امروز(?=\s|$)/giu, due: () => today },
    { pattern: /#فردا(?=\s|$)/giu, due: () => shiftIsoDay(today, 1) },
    { pattern: /#پس(?:[-_‌\s])?فردا(?=\s|$)/giu, due: () => shiftIsoDay(today, 2) },
    { pattern: /#این(?:[-_‌\s])?هفته(?=\s|$)/giu, due: () => nextWeekday(today, 5, false) },
    { pattern: /#هفته(?:[-_‌\s])?بعد(?=\s|$)/giu, due: () => nextWeekday(today, 6, true) },
    {
      pattern: /#ماه(?:[-_‌\s])?بعد(?=\s|$)/giu,
      due: () => {
        const date = new Date(`${today}T12:00:00Z`);
        date.setUTCMonth(date.getUTCMonth() + 1, 1);
        return date.toISOString().slice(0, 10);
      }
    },
  ];
  const weekdays: Record<string, number> = { "شنبه": 6, "یکشنبه": 0, "دوشنبه": 1, "سه‌شنبه": 2, "چهارشنبه": 3, "پنجشنبه": 4, "جمعه": 5 };
  for (const [name, weekday] of Object.entries(weekdays)) {
    rules.push({ pattern: new RegExp(`#${name}(?=\\s|$)`, "giu"), due: () => nextWeekday(today, weekday, false) });
  }
  for (const rule of rules) {
    if (rule.pattern.test(source)) {
      return { dueDate: rule.due(), title: source.replace(rule.pattern, "").replace(/\s+/g, " ").trim() };
    }
  }
  return { dueDate: "", title: source.replace(/\s+/g, " ").trim() };
}

export function isHabitScheduledForCachedDay(habit: TickTickHabit, day: string) {
  return isHabitScheduledForDay(habit, day);
}

export function dailyNoteDateFromPath(path: string) {
  const match = path.match(/(?:^|[\\/])(1[34]\d{2}-\d{2}-\d{2})\.md$/);
  return match ? jalaliDateKeyToGregorian(match[1]) ?? undefined : undefined;
}

export function persianMonthSegments(start: string, due: string) {
  const format = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { month: "long" });
  const output: Array<{ label: string; days: number }> = [];
  for (let day = start; day <= due; day = shiftIsoDay(day, 1)) {
    const label = format.format(new Date(`${day}T12:00:00Z`));
    const current = output.at(-1);
    if (current?.label === label) current.days++;
    else output.push({ label, days: 1 });
  }
  return output;
}

export async function addDescriptionToggle(app: App, component: Component, body: HTMLElement, actions: HTMLElement, task: TaskDraft) {
  const description = cleanTaskDescription(task.desc || task.content);
  const button = actions.createEl("button", { cls: "mod-icon", attr: { "aria-label": "توضیحات" } });
  setIcon(button, "file-text");
  const panel = body.createDiv({ cls: "ticktick-bridge-description" });
  panel.addClass("is-hidden");
  await MarkdownRenderer.render(app, description || "توضیحی برای این تسک ثبت نشده است.", panel, "", component);
  button.addEventListener("click", () => panel.classList.toggle("is-hidden"));
}

export function reminderTrigger(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return "";
  return `TRIGGER:P0DT${hours}H${minutes}M0S`;
}

export function reminderTimeFromTask(task: TaskDraft) {
  for (const reminder of Array.isArray(task.reminders) ? task.reminders : []) {
    const match = String(reminder).match(/P0?DT(\d+)H(\d+)M/i);
    if (match) return `${match[1].padStart(2, "0")}:${match[2].padStart(2, "0")}`;
  }
  return "";
}

export function toTaskPayload(draft: TaskDraft, timeZone: string) {
  const { projectName, dueDate, reminderTime, reminders: _reminders, ...task } = draft as TaskDraft & { projectName?: string; reminderTime?: string; reminders?: string[] };
  const day = String(dueDate ?? "").slice(0, 10);
  return {
    ...task,
    title: String(task.title ?? "").trim(),
    desc: String(task.desc || task.content || "").trim(),
    content: "",
    projectId: task.projectId,
    dueDate: day ? `${day}T00:00:00+0330` : null,
    startDate: task.startDate ?? null,
    timeZone,
    isAllDay: true,
    reminders: reminderTime ? [reminderTrigger(reminderTime)] : [],
    repeatFlag: String(task.repeatFlag ?? "").trim() || null,
  };
}

export function publicCacheMetadata(cache: BridgeCache) {
  const task = (item: TickTickTask) => ({ id: item?.id, projectId: item?.projectId, title: item?.title, status: item?.status, dueDate: item?.dueDate, startDate: item?.startDate });
  const habit = (item: TickTickHabit) => ({ id: item?.id, name: item?.name, status: item?.status, sectionId: item?.sectionId, sectionName: item?.sectionName });
  return { savedAt: cache.savedAt, tasks: cache.tasks.map(task), habits: cache.habits.map(habit), pendingCount: cache.pending.length, conflictCount: cache.conflicts.length };
}
