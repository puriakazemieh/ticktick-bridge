/**
 * @file morning-briefing.js
 * Pure in-memory engine for Morning Briefing and Daily Kickoff.
 */

import { extractTaskTimeRange } from './timeblocking.js';
import { isHabitScheduledForDay } from './date.js';

/**
 * @typedef {Object} MorningBriefingData
 * @property {string} today YYYY-MM-DD
 * @property {Array<Object>} overdueTasks
 * @property {Array<{ task: Object, timeLabel: string, startMinutes: number }>} todayTimedTasks
 * @property {Array<Object>} todayUntimedTasks
 * @property {Array<Object>} todayHabits
 * @property {number} yesterdayCompletedCount
 * @property {number} totalTodayTasksCount
 * @property {string} motivationalQuote
 */

const PERSIAN_QUOTES = [
  'هر روز فرصتی نو برای پیشرفت و خلق ارزش است.',
  'شروع پرانرژی روز، تضمین‌کننده تمرکز و پیروزی‌های بزرگ است.',
  'کارهای مهم را اول وقت انجام دهید تا روزتان با آرامش سپری شود.',
  'پیوستگی در گام‌های کوچک، دستاوردهای شگفت‌انگیز می‌سازد.',
  'تمرکز عمیق یعنی هنر «نه» گفتن به موارد غیرضروری.'
];

/**
 * Compiles a structured morning briefing from in-memory cache data.
 * @param {Array<Object>} tasks
 * @param {Array<Object>} habits
 * @param {Object} options
 * @param {string} options.today YYYY-MM-DD
 * @param {string} [options.timeZone]
 * @param {Record<string, string>} [options.projectsMap]
 * @returns {MorningBriefingData}
 */
export function computeMorningBriefing(tasks, habits, options) {
  const today = options.today || new Date().toISOString().slice(0, 10);
  const timeZone = options.timeZone || 'Asia/Tehran';
  const projectsMap = options.projectsMap || {};

  const allTasks = Array.isArray(tasks) ? tasks : [];
  const allHabits = Array.isArray(habits) ? habits : [];

  // Yesterday date string
  const todayDate = new Date(`${today}T00:00:00Z`);
  const yestDate = new Date(todayDate.getTime() - 86400000);
  const yesterday = yestDate.toISOString().slice(0, 10);

  const overdueTasks = [];
  const todayTimedTasks = [];
  const todayUntimedTasks = [];
  let yesterdayCompletedCount = 0;

  for (const task of allTasks) {
    // Check yesterday's wins
    if (task.status !== 0) {
      const compDate = task.completedTime ? task.completedTime.slice(0, 10) : null;
      if (compDate === yesterday) {
        yesterdayCompletedCount++;
      }
      continue;
    }

    const dueDate = task.dueDate ? task.dueDate.slice(0, 10) : null;
    if (!dueDate) continue;

    // Overdue check
    if (dueDate < today) {
      overdueTasks.push(task);
      continue;
    }

    // Today's tasks
    if (dueDate === today) {
      const timeRange = extractTaskTimeRange(task, today, { timeZone });
      if (timeRange) {
        todayTimedTasks.push({
          task,
          timeLabel: `${timeRange.startString} - ${timeRange.endString}`,
          startMinutes: timeRange.startMinutes
        });
      } else {
        todayUntimedTasks.push(task);
      }
    }
  }

  // Sort timed tasks chronologically
  todayTimedTasks.sort((a, b) => a.startMinutes - b.startMinutes);

  // Sort untimed tasks by priority (High -> Med -> Low -> None)
  todayUntimedTasks.sort((a, b) => (Number(b.priority) || 0) - (Number(a.priority) || 0));

  // Sort overdue tasks by date ascending (oldest overdue first)
  overdueTasks.sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));

  // Scheduled habits for today
  const todayHabits = allHabits.filter(h => isHabitScheduledForDay(h, today));

  // Pseudo-random deterministic quote based on day number
  const dayHash = today.split('-').reduce((acc, part) => acc + parseInt(part, 10), 0);
  const motivationalQuote = PERSIAN_QUOTES[dayHash % PERSIAN_QUOTES.length];

  return {
    today,
    overdueTasks,
    todayTimedTasks,
    todayUntimedTasks,
    todayHabits,
    yesterdayCompletedCount,
    totalTodayTasksCount: todayTimedTasks.length + todayUntimedTasks.length,
    motivationalQuote
  };
}

/**
 * Formats a Morning Briefing into clean Markdown for Obsidian notes.
 * @param {MorningBriefingData} briefing
 * @param {Object} [options]
 * @param {string} [options.jalaliDateStr]
 * @returns {string}
 */
export function formatMorningBriefingMarkdown(briefing, options = {}) {
  const dateHeader = options.jalaliDateStr ? ` (${options.jalaliDateStr})` : ` (${briefing.today})`;
  const lines = [];

  lines.push(`## 🌅 پیشخوان مرور صبحگاهی${dateHeader}`);
  lines.push('');
  lines.push(`> 💡 **پیام روز**: ${briefing.motivationalQuote}`);
  lines.push(`> 📊 **وضعیت**: ${briefing.totalTodayTasksCount} تسک برای امروز، ${briefing.overdueTasks.length} تسک معوقه، و ${briefing.todayHabits.length} عادت در برنامه.`);
  if (briefing.yesterdayCompletedCount > 0) {
    lines.push(`> 🏆 **دستاورد دیروز**: ${briefing.yesterdayCompletedCount} تسک با موفقیت انجام شد.`);
  }
  lines.push('');

  // Overdue
  if (briefing.overdueTasks.length > 0) {
    lines.push(`### 🚨 تسک‌های معوقه نیازمند رسیدگی (${briefing.overdueTasks.length} مورد)`);
    for (const t of briefing.overdueTasks) {
      const prioLabel = t.priority === 5 ? ' 🚩 بالا' : '';
      lines.push(`- [ ] ${t.title}${prioLabel} *(سررسید: ${t.dueDate ? t.dueDate.slice(0, 10) : 'نامشخص'})*`);
    }
    lines.push('');
  }

  // Timed tasks
  if (briefing.todayTimedTasks.length > 0) {
    lines.push('### ⏰ زمان‌بندی امروز');
    for (const item of briefing.todayTimedTasks) {
      lines.push(`- [ ] **${item.timeLabel}**: ${item.task.title}`);
    }
    lines.push('');
  }

  // Priorities
  if (briefing.todayUntimedTasks.length > 0) {
    lines.push('### 🎯 اولویت‌های امروز');
    for (const t of briefing.todayUntimedTasks) {
      const prioEmoji = t.priority === 5 ? '🚩 بالا: ' : t.priority === 3 ? '🚩 متوسط: ' : '';
      lines.push(`- [ ] ${prioEmoji}${t.title}`);
    }
    lines.push('');
  }

  // Habits
  if (briefing.todayHabits.length > 0) {
    lines.push('### 🌿 عادت‌های امروز');
    for (const h of briefing.todayHabits) {
      const goalStr = h.goal ? ` (هدف: ${h.goal} ${h.unit || ''})` : '';
      lines.push(`- [ ] ${h.name || 'عادت'}${goalStr}`);
    }
    lines.push('');
  }

  return lines.join('\n').trim();
}

/**
 * Safely injects or updates a Morning Briefing section inside existing markdown note content.
 * @param {string} existingMarkdown
 * @param {string} briefingMarkdown
 * @param {string} [targetHeading='## 🌅 پیشخوان مرور صبحگاهی']
 * @returns {string}
 */
export function injectBriefingIntoDailyNote(existingMarkdown, briefingMarkdown, targetHeading = '## 🌅 پیشخوان مرور صبحگاهی') {
  if (!existingMarkdown || typeof existingMarkdown !== 'string') {
    return briefingMarkdown;
  }

  const headingIndex = existingMarkdown.indexOf(targetHeading);
  if (headingIndex === -1) {
    // Heading does not exist. Prepend or append cleanly.
    // Check if there is frontmatter
    const fmMatch = existingMarkdown.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n/);
    if (fmMatch) {
      const endOfFm = fmMatch[0].length;
      return existingMarkdown.slice(0, endOfFm) + '\n' + briefingMarkdown + '\n\n' + existingMarkdown.slice(endOfFm).trimStart();
    }
    return briefingMarkdown + '\n\n' + existingMarkdown.trimStart();
  }

  // Heading exists: find where this section ends (next heading of level 1 or 2, or end of file)
  const afterHeading = existingMarkdown.slice(headingIndex + targetHeading.length);
  const nextHeadingMatch = afterHeading.match(/\r?\n#{1,2}\s+/);

  if (nextHeadingMatch && typeof nextHeadingMatch.index === 'number') {
    const sectionEndIndex = headingIndex + targetHeading.length + nextHeadingMatch.index;
    return existingMarkdown.slice(0, headingIndex) + briefingMarkdown + existingMarkdown.slice(sectionEndIndex);
  } else {
    // Replaces to the end of the note
    return existingMarkdown.slice(0, headingIndex) + briefingMarkdown + '\n';
  }
}
