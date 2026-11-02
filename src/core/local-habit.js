/**
 * TickTick Bridge — Local Habit Parser & Migration Safety Layer
 * Parses observed local Habit markdown files (frontmatter and structure)
 * and safely exposes them alongside TickTick habits without data loss or remote corruption.
 */

const KNOWN_FRONTMATTER_KEYS = new Set([
  "habit",
  "type",
  "target",
  "unit",
  "startDate",
  "records",
  "icon",
  "group",
  "useGroupColor",
  "tags"
]);

export function parseYamlFrontmatter(text) {
  if (typeof text !== "string") return null;
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) return null;

  const yamlContent = match[1];
  const lines = yamlContent.split(/\r?\n/);
  const result = {};

  let currentKey = null;
  let currentList = null;
  let currentDict = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    // Indented list item e.g. "  - item"
    const listItemMatch = line.match(/^[\t ]+-\s+(.*)$/);
    if (listItemMatch && currentKey && currentList) {
      let val = listItemMatch[1].trim().replace(/^['"]|['"]$/g, "");
      currentList.push(val);
      continue;
    }

    // Indented dict item e.g. "  2026-09-19: 2"
    const dictItemMatch = line.match(/^[\t ]+([^:\s]+):\s*(.*)$/);
    if (dictItemMatch && currentKey && currentDict) {
      const subKey = dictItemMatch[1].trim();
      let subVal = dictItemMatch[2].trim();
      if (/^-?\d+(\.\d+)?$/.test(subVal)) {
        subVal = Number(subVal);
      } else if (subVal === "true") {
        subVal = true;
      } else if (subVal === "false") {
        subVal = false;
      } else {
        subVal = subVal.replace(/^['"]|['"]$/g, "");
      }
      currentDict[subKey] = subVal;
      continue;
    }

    // Top-level key: value (no leading whitespace required)
    const topMatch = line.match(/^([^:\s]+):\s*(.*)$/);
    if (topMatch) {
      currentKey = topMatch[1].trim();
      currentList = null;
      currentDict = null;
      let rawVal = topMatch[2].trim();

      if (!rawVal) {
        if (currentKey === "records") {
          currentDict = {};
          result[currentKey] = currentDict;
        } else if (currentKey === "tags") {
          currentList = [];
          result[currentKey] = currentList;
        } else {
          result[currentKey] = "";
        }
      } else if (rawVal.startsWith("[") && rawVal.endsWith("]")) {
        result[currentKey] = rawVal
          .slice(1, -1)
          .split(",")
          .map(s => s.trim().replace(/^['"]|['"]$/g, ""))
          .filter(Boolean);
      } else if (/^-?\d+(\.\d+)?$/.test(rawVal)) {
        result[currentKey] = Number(rawVal);
      } else if (rawVal === "true") {
        result[currentKey] = true;
      } else if (rawVal === "false") {
        result[currentKey] = false;
      } else {
        result[currentKey] = rawVal.replace(/^['"]|['"]$/g, "");
      }
    }
  }

  return result;
}

export function isLocalHabit(markdownText) {
  if (typeof markdownText !== "string") return false;
  return /^---\r?\n[\s\S]*?\bhabit:\s*true\b[\s\S]*?\r?\n---/m.test(markdownText);
}

export function extractHabitTitle(markdownText, fallback = "عادت بدون نام") {
  if (typeof markdownText !== "string") return fallback;
  const headingMatch = markdownText.match(/^#\s+(.+)$/m);
  if (headingMatch && headingMatch[1].trim()) {
    return headingMatch[1].trim();
  }
  return fallback;
}

export function parseLocalHabit(markdownText, { path = "", fallbackTitle = "" } = {}) {
  const frontmatter = parseYamlFrontmatter(markdownText);
  if (!frontmatter || frontmatter.habit !== true) {
    return null;
  }

  const derivedTitle = fallbackTitle || (path ? path.split("/").pop()?.replace(/\.md$/, "") : "");
  const title = extractHabitTitle(markdownText, derivedTitle || "عادت بدون نام");

  const type = String(frontmatter.type ?? "binary").toLowerCase();
  const rawTarget = frontmatter.target !== undefined ? Number(frontmatter.target) : (type === "repetition" ? 2 : 1);
  const goal = Math.max(1, Number.isNaN(rawTarget) ? 1 : rawTarget);

  const rawRecords = frontmatter.records && typeof frontmatter.records === "object" ? frontmatter.records : {};
  const records = {};
  for (const [dateKey, val] of Object.entries(rawRecords)) {
    const num = Number(val);
    if (!Number.isNaN(num)) {
      records[String(dateKey).trim()] = num;
    }
  }

  const unsupported = {};
  for (const [key, val] of Object.entries(frontmatter)) {
    if (!KNOWN_FRONTMATTER_KEYS.has(key)) {
      unsupported[key] = val;
    }
  }

  const hasUnsupportedType = !["binary", "repetition"].includes(type);
  const needsMapping = Object.keys(unsupported).length > 0 || hasUnsupportedType;

  return {
    id: path ? `local:${path}` : `local:${title}`,
    name: title,
    type,
    goal,
    target: goal,
    unit: typeof frontmatter.unit === "string" ? frontmatter.unit.trim() : "",
    startDate: typeof frontmatter.startDate === "string" ? frontmatter.startDate.trim() : null,
    records,
    icon: typeof frontmatter.icon === "string" ? frontmatter.icon.trim() : "",
    sectionName: typeof frontmatter.group === "string" ? frontmatter.group.trim() : "",
    group: typeof frontmatter.group === "string" ? frontmatter.group.trim() : "",
    useGroupColor: Boolean(frontmatter.useGroupColor),
    tags: Array.isArray(frontmatter.tags) ? frontmatter.tags.map(String) : [],
    source: "local",
    path,
    unsupported,
    needsMapping
  };
}

export function localHabitForDay(habit, dayKey) {
  if (!habit) return null;
  const value = Number(habit.records?.[dayKey] ?? 0);
  const goal = Math.max(1, Number(habit.goal ?? habit.target ?? 1));
  const status = value >= goal ? 2 : (value > 0 ? 1 : 0);

  return {
    ...habit,
    checkin: {
      stamp: Number(String(dayKey).replaceAll("-", "")),
      value,
      goal,
      status
    }
  };
}

export function previewHabitMigration(localHabit) {
  if (!localHabit) return null;

  const losses = [];
  losses.push("رکوردهای روزانه گذشته به TickTick منتقل نمی‌شوند؛ تاریخچه در سرور از روز جاری محاسبه خواهد شد.");
  if (localHabit.needsMapping) {
    const unKeys = Object.keys(localHabit.unsupported ?? {});
    if (unKeys.length) {
      losses.push(`فیلدهای پشتیبانی‌نشده محلی نیاز به نگاشت دارند: ${unKeys.join(", ")}`);
    }
    if (!["binary", "repetition"].includes(localHabit.type)) {
      losses.push(`نوع عادت '${localHabit.type}' در TickTick پشتیبانی نمی‌شود.`);
    }
  }

  return {
    sourceId: localHabit.id,
    sourcePath: localHabit.path,
    name: localHabit.name,
    targetPayload: {
      name: localHabit.name,
      type: localHabit.type,
      goal: localHabit.goal,
      unit: localHabit.unit,
      sectionName: localHabit.sectionName,
      icon: localHabit.icon,
      tags: localHabit.tags
    },
    losses,
    needsMapping: localHabit.needsMapping,
    isBlocked: true,
    blockReason: "ایجاد ریموت عادت در TickTick تا زمان اعتبارسنجی قرارداد رسمی API در حالت ایمن مسدود است."
  };
}

export function filterHabitsBySource(habits, filter = "all") {
  const list = Array.isArray(habits) ? habits : [];
  if (filter === "all") return list;
  if (filter === "local") return list.filter(h => h.source === "local");
  if (filter === "ticktick") return list.filter(h => !h.source || h.source === "ticktick");
  if (filter === "linked") return list.filter(h => h.source === "linked");
  return list;
}
