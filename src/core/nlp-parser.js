/**
 * TickTick Bridge — Natural Language Task Parser
 * Fast regex-based parser for Persian and English task inputs.
 * Extracts: Title, Due Date, Time, Priority (!1/!high), Tags (#tag), and Project (~proj/@proj).
 */

import { toDateKey } from "./date.js";
import { shiftCalendarDay, weekdayIndex } from "./calendar-range.js";

export function normalizeDigits(str) {
  return String(str ?? "")
    .replace(/[۰-۹]/g, d => String.fromCharCode(d.charCodeAt(0) - 1776 + 48))
    .replace(/[٠-٩]/g, d => String.fromCharCode(d.charCodeAt(0) - 1632 + 48));
}

export function findNextWeekday(fromDay, targetWeekday, isNextWeek = false) {
  const curWeekday = weekdayIndex(fromDay);
  let delta = (targetWeekday - curWeekday + 7) % 7;
  if (delta === 0 || isNextWeek) {
    delta += 7;
  }
  return shiftCalendarDay(fromDay, delta);
}

const PERSIAN_WEEKDAYS = {
  "شنبه": 6,
  "یکشنبه": 0,
  "دوشنبه": 1,
  "سه‌شنبه": 2,
  "چهارشنبه": 3,
  "پنجشنبه": 4,
  "جمعه": 5
};

const ENGLISH_WEEKDAYS = {
  "sunday": 0,
  "sun": 0,
  "monday": 1,
  "mon": 1,
  "tuesday": 2,
  "tue": 2,
  "wednesday": 3,
  "wed": 3,
  "thursday": 4,
  "thu": 4,
  "friday": 5,
  "fri": 5,
  "saturday": 6,
  "sat": 6
};

/**
 * Parses natural language input string into task attributes and visual chips.
 */
export function parseTaskNaturalLanguage(input = "", options = {}) {
  const today = options.today || new Date().toISOString().slice(0, 10);
  const timeZone = options.timeZone || "Asia/Tehran";
  const knownProjects = Array.isArray(options.projects) ? options.projects : [];

  let text = String(input).trim();
  if (!text) {
    return {
      title: "",
      dueDate: null,
      isAllDay: true,
      priority: 0,
      tags: [],
      projectName: null,
      projectId: null,
      chips: []
    };
  }

  const chips = [];
  let dueDate = null;
  let timeStr = null;
  let priority = 0;
  const tags = [];
  let projectName = null;
  let projectId = null;

  // 1. Parse Priority (!1, !high, !بالا, !2, !med, !متوسط, !3, !low, !کم, !0)
  const prioMatch = text.match(/(?:^|\s)!(1|high|h|بالا|2|med|m|متوسط|3|low|l|کم|0|none)(?=\s|$)/i);
  if (prioMatch) {
    const raw = prioMatch[1].toLowerCase();
    text = text.replace(prioMatch[0], " ");
    if (["1", "high", "h", "بالا"].includes(raw)) {
      priority = 5;
      chips.push({ type: "priority", label: "اولویت بالا", value: 5 });
    } else if (["2", "med", "m", "متوسط"].includes(raw)) {
      priority = 3;
      chips.push({ type: "priority", label: "اولویت متوسط", value: 3 });
    } else if (["3", "low", "l", "کم"].includes(raw)) {
      priority = 1;
      chips.push({ type: "priority", label: "اولویت کم", value: 1 });
    } else {
      priority = 0;
      chips.push({ type: "priority", label: "بدون اولویت", value: 0 });
    }
  }

  // 2. Parse Project (~ProjectName or @ProjectName)
  const projMatch = text.match(/(?:^|\s)[~@](\S+)(?=\s|$)/);
  if (projMatch) {
    const rawName = projMatch[1];
    text = text.replace(projMatch[0], " ");
    const matchedProj = knownProjects.find(p => String(p.name).toLowerCase() === rawName.toLowerCase());
    if (matchedProj) {
      projectName = matchedProj.name;
      projectId = String(matchedProj.id);
    } else {
      projectName = rawName;
    }
    chips.push({ type: "project", label: `پروژه: ${projectName}`, value: projectName });
  }

  // 3. Parse Tags (#tag1) - avoiding weekdays like #شنبه
  const tagMatches = Array.from(text.matchAll(/(?:^|\s)#([\p{L}\p{N}_-]+)(?=\s|$)/gu));
  for (const match of tagMatches) {
    const tagName = match[1];
    if (PERSIAN_WEEKDAYS[tagName] === undefined && ENGLISH_WEEKDAYS[tagName.toLowerCase()] === undefined) {
      tags.push(tagName);
      text = text.replace(match[0], " ");
      chips.push({ type: "tag", label: `#${tagName}`, value: tagName });
    }
  }

  // 4. Parse Time (ساعت ۵ عصر / ساعت 17:30 / 17:00 / 5pm / 9am)
  const persianTimeMatch = text.match(/(?:^|\s)(?:ساعت\s*)?(\d{1,2})(?::(\d{2}))?\s*(صبح|عصر|شب|بعدازظهر)?(?=\s|$)/);
  let handledTime = false;

  // English 12h/24h time match: 5pm / 5:30pm / 17:00 or ساعت 5pm
  const englishTimeMatch = text.match(/(?:^|\s)(?:ساعت\s*)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)(?=\s|$)/i);

  if (englishTimeMatch) {
    let hour = parseInt(englishTimeMatch[1], 10);
    const min = parseInt(englishTimeMatch[2] || "0", 10);
    const meridiem = englishTimeMatch[3].toLowerCase();
    if (meridiem === "pm" && hour < 12) hour += 12;
    if (meridiem === "am" && hour === 12) hour = 0;
    timeStr = `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
    text = text.replace(englishTimeMatch[0], " ");
    chips.push({ type: "time", label: `ساعت ${timeStr}`, value: timeStr });
    handledTime = true;
  } else {
    // 24-hour standalone (e.g. 14:30 or ساعت ۱۴:۳۰)
    const time24Match = text.match(/(?:^|\s)(?:ساعت\s*)?([\d۰-۹٠-٩]{1,2}):([\d۰-۹٠-٩]{2})(?=\s|$)/);
    if (time24Match) {
      const hour = parseInt(normalizeDigits(time24Match[1]), 10);
      const min = parseInt(normalizeDigits(time24Match[2]), 10);
      if (hour >= 0 && hour <= 23 && min >= 0 && min <= 59) {
        timeStr = `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
        text = text.replace(time24Match[0], " ");
        chips.push({ type: "time", label: `ساعت ${timeStr}`, value: timeStr });
        handledTime = true;
      }
    }
  }

  // Persian time syntax: "ساعت ۵ عصر" or "ساعت 10" or "ساعت ۱۰:۳۰"
  if (!handledTime) {
    const faTimeMatch = text.match(/(?:^|\s)ساعت\s*([\d۰-۹٠-٩]{1,2})(?::([\d۰-۹٠-٩]{2}))?\s*(صبح|عصر|شب|بعدازظهر)?(?=\s|$)/);
    if (faTimeMatch) {
      let hour = parseInt(normalizeDigits(faTimeMatch[1]), 10);
      const min = parseInt(normalizeDigits(faTimeMatch[2] || "0"), 10);
      const modifier = faTimeMatch[3];
      if ((modifier === "عصر" || modifier === "شب" || modifier === "بعدازظهر") && hour < 12) {
        hour += 12;
      }
      timeStr = `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
      text = text.replace(faTimeMatch[0], " ");
      chips.push({ type: "time", label: `ساعت ${timeStr}`, value: timeStr });
      handledTime = true;
    }
  }

  // 5. Parse Dates (Relative Persian and English)
  // Persian: پس‌فردا, فردا, امروز
  const pasFardaMatch = text.match(/(?:^|\s)(پس‌فردا|پس فردا)(?=\s|$)/);
  if (pasFardaMatch) {
    dueDate = shiftCalendarDay(today, 2);
    text = text.replace(pasFardaMatch[0], " ");
    chips.push({ type: "date", label: "پس‌فردا", value: dueDate });
  } else {
    const fardaMatch = text.match(/(?:^|\s)(فردا|tomorrow)(?=\s|$)/i);
    if (fardaMatch) {
      dueDate = shiftCalendarDay(today, 1);
      text = text.replace(fardaMatch[0], " ");
      chips.push({ type: "date", label: "فردا", value: dueDate });
    } else {
      const emroozMatch = text.match(/(?:^|\s)(امروز|today)(?=\s|$)/i);
      if (emroozMatch) {
        dueDate = today;
        text = text.replace(emroozMatch[0], " ");
        chips.push({ type: "date", label: "امروز", value: dueDate });
      }
    }
  }

  // Weekdays (e.g. شنبه بعد, دوشنبه, next friday)
  if (!dueDate) {
    // Next weekday check
    for (const [wName, wDay] of Object.entries(PERSIAN_WEEKDAYS)) {
      const nextMatch = new RegExp(`(?:^|\\s)${wName}\\s+بعد(?=\\s|$)`, "i");
      if (nextMatch.test(text)) {
        dueDate = findNextWeekday(today, wDay, true);
        text = text.replace(nextMatch, " ");
        chips.push({ type: "date", label: `${wName} بعد`, value: dueDate });
        break;
      }
      const regularMatch = new RegExp(`(?:^|\\s)${wName}(?=\\s|$)`, "i");
      if (regularMatch.test(text)) {
        dueDate = findNextWeekday(today, wDay, false);
        text = text.replace(regularMatch, " ");
        chips.push({ type: "date", label: wName, value: dueDate });
        break;
      }
    }
  }

  if (!dueDate) {
    // English weekdays
    for (const [wName, wDay] of Object.entries(ENGLISH_WEEKDAYS)) {
      const nextMatch = new RegExp(`(?:^|\\s)next\\s+${wName}(?=\\s|$)`, "i");
      if (nextMatch.test(text)) {
        dueDate = findNextWeekday(today, wDay, true);
        text = text.replace(nextMatch, " ");
        chips.push({ type: "date", label: `Next ${wName}`, value: dueDate });
        break;
      }
      const regularMatch = new RegExp(`(?:^|\\s)${wName}(?=\\s|$)`, "i");
      if (regularMatch.test(text)) {
        dueDate = findNextWeekday(today, wDay, false);
        text = text.replace(regularMatch, " ");
        chips.push({ type: "date", label: wName, value: dueDate });
        break;
      }
    }
  }

  // Clean remaining title
  const cleanTitle = text.replace(/\s+/g, " ").trim();

  // Combine date and time
  const tzOffset = "+0330";
  let fullDue = null;
  let isAllDay = true;

  if (dueDate) {
    if (timeStr) {
      fullDue = `${dueDate}T${timeStr}:00${tzOffset}`;
      isAllDay = false;
    } else {
      fullDue = `${dueDate}T00:00:00${tzOffset}`;
      isAllDay = true;
    }
  }

  return {
    title: cleanTitle,
    dueDate: fullDue,
    targetDay: dueDate,
    time: timeStr,
    isAllDay,
    priority,
    tags,
    projectName,
    projectId,
    chips
  };
}
