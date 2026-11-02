/**
 * TickTick Bridge — Annual Activity & Habit Heatmap Core Engine
 * Fast cache-first heatmap matrix computation with streak tracking and Jalali month grouping.
 */

import { toDateKey, gregorianDateKeyToJalali } from "./date.js";
import { shiftCalendarDay, weekdayIndex } from "./calendar-range.js";

/**
 * Normalizes habit checkin stamp (e.g. 20261102 or "2026-11-02") to "YYYY-MM-DD".
 */
export function normalizeHabitStamp(stamp) {
  if (!stamp) return null;
  const str = String(stamp).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const match = str.match(/^(\d{4})(\d{2})(\d{2})/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  return null;
}

/**
 * Calculates level 0..4 based on daily activity count.
 */
export function calculateHeatmapLevel(score) {
  if (!score || score <= 0) return 0;
  if (score <= 2) return 1;
  if (score <= 5) return 2;
  if (score <= 9) return 3;
  return 4;
}

/**
 * Computes 52 weeks (364 days) of activity aligned Saturday-to-Friday.
 */
export function computeAnnualHeatmapData(tasks = [], habitCheckins = {}, habits = [], options = {}) {
  const timeZone = options.timeZone || "Asia/Tehran";
  const today = options.today || new Date().toISOString().slice(0, 10);
  const weeksCount = Number(options.weeksCount ?? 52);

  // Align end to current week's Friday (weekday 5)
  const todayWeekday = weekdayIndex(today);
  const daysUntilFriday = (5 - todayWeekday + 7) % 7;
  const rangeEnd = shiftCalendarDay(today, daysUntilFriday);

  // Range starts weeksCount weeks before (Saturday)
  const totalDays = weeksCount * 7;
  const rangeStart = shiftCalendarDay(rangeEnd, -(totalDays - 1));

  // Initialize day map
  const dayMap = new Map();
  for (let i = 0; i < totalDays; i++) {
    const dKey = shiftCalendarDay(rangeStart, i);
    dayMap.set(dKey, {
      dateKey: dKey,
      jalaliKey: gregorianDateKeyToJalali(dKey) || dKey,
      weekday: weekdayIndex(dKey), // 6 = Sat, 0 = Sun ... 5 = Fri
      tasks: [],
      habits: [],
      score: 0,
      level: 0,
      isFuture: dKey > today
    });
  }

  // 1. Map completed tasks
  for (const t of tasks) {
    if (!t || Number(t.status ?? 0) === 0) continue; // Only completed tasks
    const completedDay = toDateKey(t.completedTime || t.dueDate, t.timeZone || timeZone);
    if (completedDay && dayMap.has(completedDay)) {
      dayMap.get(completedDay).tasks.push(String(t.title ?? ""));
    }
  }

  // 2. Map completed habits
  const habitNameMap = new Map(habits.map(h => [String(h.id), String(h.name || "عادت")]));
  for (const [habitId, checkinEntries] of Object.entries(habitCheckins || {})) {
    if (!Array.isArray(checkinEntries)) continue;
    const hName = habitNameMap.get(String(habitId)) || "عادت";

    for (const entry of checkinEntries) {
      if (!entry) continue;
      const isCompleted = Number(entry.status ?? 0) === 2 || (Number(entry.value ?? 0) >= Number(entry.goal ?? 1));
      if (!isCompleted) continue;

      const dayKey = normalizeHabitStamp(entry.stamp);
      if (dayKey && dayMap.has(dayKey)) {
        dayMap.get(dayKey).habits.push(hName);
      }
    }
  }

  // 3. Compute score and level for each day
  let totalTasksCompleted = 0;
  let totalHabitsCompleted = 0;
  let activeDaysCount = 0;

  for (const day of dayMap.values()) {
    day.score = day.tasks.length + day.habits.length;
    day.level = calculateHeatmapLevel(day.score);
    if (!day.isFuture) {
      totalTasksCompleted += day.tasks.length;
      totalHabitsCompleted += day.habits.length;
      if (day.score > 0) activeDaysCount++;
    }
  }

  // 4. Compute streaks (only up to today)
  const pastDays = Array.from(dayMap.values()).filter(d => !d.isFuture);
  pastDays.sort((a, b) => a.dateKey.localeCompare(b.dateKey));

  let currentStreak = 0;
  let longestStreak = 0;
  let runningStreak = 0;

  for (let i = 0; i < pastDays.length; i++) {
    const d = pastDays[i];
    if (d.score > 0) {
      runningStreak++;
      if (runningStreak > longestStreak) longestStreak = runningStreak;
    } else {
      runningStreak = 0;
    }
  }

  // Calculate current streak from the end
  let i = pastDays.length - 1;
  // If today has 0 activity yet, allow yesterday to continue streak
  if (i >= 0 && pastDays[i].score === 0) {
    i--;
  }
  while (i >= 0 && pastDays[i].score > 0) {
    currentStreak++;
    i--;
  }

  // 5. Structure into 52 weeks (each week has 7 days from Saturday to Friday)
  const allDays = Array.from(dayMap.values());
  const weeks = [];
  const monthLabels = []; // { colIndex, label }
  let lastJalaliMonth = "";

  for (let w = 0; w < weeksCount; w++) {
    const weekDays = allDays.slice(w * 7, (w + 1) * 7);
    // Sort week days Saturday (6) to Friday (5)
    // Saturday is day 0 in Iranian work week
    weekDays.sort((a, b) => {
      const orderA = (a.weekday + 1) % 7;
      const orderB = (b.weekday + 1) % 7;
      return orderA - orderB;
    });

    weeks.push({
      weekIndex: w,
      days: weekDays
    });

    // Check Jalali month label
    const firstDay = weekDays[0];
    const jMonth = firstDay.jalaliKey ? firstDay.jalaliKey.slice(5, 7) : "";
    if (jMonth && jMonth !== lastJalaliMonth) {
      lastJalaliMonth = jMonth;
      monthLabels.push({
        colIndex: w,
        monthCode: jMonth,
        jalaliKey: firstDay.jalaliKey
      });
    }
  }

  return {
    rangeStart,
    rangeEnd,
    weeksCount,
    weeks,
    monthLabels,
    summary: {
      totalTasksCompleted,
      totalHabitsCompleted,
      totalActivities: totalTasksCompleted + totalHabitsCompleted,
      activeDaysCount,
      currentStreak,
      longestStreak
    }
  };
}
