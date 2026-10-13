export function toDateKey(value, timeZone = "Asia/Tehran") {
  if (!value) return null;
  const raw = String(value);
  const dateOnly = raw.match(/^(\d{4}-\d{2}-\d{2})$/)?.[1];
  if (dateOnly) return dateOnly;
  const instant = new Date(raw);
  if (!Number.isNaN(instant.getTime())) return todayInZone(timeZone, instant);
  return raw.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ?? null;
}

export function todayInZone(timeZone = "Asia/Tehran", now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = Object.fromEntries(parts.filter(({ type }) => type !== "literal").map(({ type, value }) => [type, value]));
  return `${value.year}-${value.month}-${value.day}`;
}

/** Convert the Jalali YYYY-MM-DD used in this vault's daily-note filenames
 * into the Gregorian key used by TickTick.  Intl performs the calendar
 * conversion; the short search absorbs the one-day Nowruz variation. */
export function jalaliDateKeyToGregorian(value) {
  const match = String(value ?? "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const monthDays = [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 29];
  const offset = monthDays.slice(0, month - 1).reduce((total, count) => total + count, 0) + day - 1;
  const approximate = new Date(Date.UTC(year + 621, 2, 21 + offset, 12));
  const formatter = new Intl.DateTimeFormat("en-US-u-ca-persian", { timeZone: "UTC", year: "numeric", month: "2-digit", day: "2-digit" });
  for (let adjustment = -4; adjustment <= 4; adjustment++) {
    const candidate = new Date(approximate);
    candidate.setUTCDate(candidate.getUTCDate() + adjustment);
    const parts = Object.fromEntries(formatter.formatToParts(candidate)
      .filter(part => part.type !== "literal")
      .map(part => [part.type, Number(part.value)]));
    if (parts.year === year && parts.month === month && parts.day === day) return candidate.toISOString().slice(0, 10);
  }
  return null;
}

export function isScheduledForDay(task, day) {
  if (task.status !== undefined && task.status !== 0) return false;
  const due = toDateKey(task.dueDate, task.timeZone || "Asia/Tehran");
  const start = toDateKey(task.startDate, task.timeZone || "Asia/Tehran");
  if (!due) return false;
  if (start && day >= start && day <= due) return true;
  return due <= day;
}

export function isRecurring(task) {
  return Boolean(task.repeatFlag);
}

export function toHabitStamp(day) {
  const key = toDateKey(day);
  if (!key) throw new Error("A YYYY-MM-DD date is required for a habit check-in.");
  return Number(key.replaceAll("-", ""));
}

export function isHabitScheduledForDay(habit, day) {
  if (habit.status !== undefined && habit.status !== 0) return false;
  const stamp = toHabitStamp(day);
  if ((habit.exDates ?? []).map(Number).includes(stamp)) return false;
  const rule = String(habit.repeatRule ?? "RRULE:FREQ=DAILY").toUpperCase();
  if (!rule.includes("FREQ=WEEKLY")) return true;
  const byDay = rule.match(/BYDAY=([^;]+)/)?.[1]?.split(",") ?? [];
  if (!byDay.length) return true;
  const jsDay = new Date(`${day}T12:00:00`).getDay();
  return byDay.includes(["SU", "MO", "TU", "WE", "TH", "FR", "SA"][jsDay]);
}
