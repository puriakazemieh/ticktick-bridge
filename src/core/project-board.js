import { toDateKey, todayInZone } from "./date.js";
import { shiftCalendarDay } from "./calendar-range.js";
import { matchesTaskFilter } from "./task-filter.js";

export function normalizeProjectData(document = {}, fallbackProject = {}) {
  const project = { ...fallbackProject, ...(document.project ?? {}), id: document.project?.id ?? fallbackProject.id ?? document.projectId, name: document.project?.name ?? fallbackProject.name ?? "بدون نام" };
  const columns = (document.columns ?? []).map((column, index) => ({ id: String(column.id ?? ""), name: String(column.name ?? `ستون ${index + 1}`), sortOrder: Number(column.sortOrder ?? index) }));
  const names = new Map(columns.map(column => [column.id, column.name]));
  const tasks = (document.tasks ?? []).map(task => ({ ...task, projectId: task.projectId ?? project.id, projectName: project.name, projectColor: project.color, columnId: task.columnId ?? "", columnName: names.get(String(task.columnId ?? "")) ?? "Tasks" }));
  return { project, columns, tasks };
}

export function sidebarTree(projects, tasks = []) {
  const groups = new Map();
  for (const [index, project] of (projects ?? []).entries()) {
    const group = String(project.groupName ?? project.folderName ?? "");
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push({ ...project, sidebarIndex: index, openCount: tasks.filter(task => String(task.projectId) === String(project.id) && Number(task.status ?? 0) === 0).length });
  }
  const key = (value) => String(value ?? "").replace(/ي/g, "ی").replace(/ك/g, "ک").replace(/[\s‌]+/g, "").trim();
  const groupRank = (name) => ({ "": 0, "کار": 10, "لیستها": 20 }[key(name)] ?? 50);
  const projectRank = (name) => ({ "اقدام": 0, "شخصی": 1, "برنامهریزی": 10, "مدیریتمالی": 11, "فروشگاه": 12, "توسنتکو": 13, "شایدیهروزی": 20, "آرشیو": 21 }[key(name)] ?? 100);
  const remoteOrder = (project) => Number(project.sortOrder ?? project.order ?? Number.NaN);
  const compareProjects = (left, right) => {
    const rank = projectRank(left.name) - projectRank(right.name);
    if (rank) return rank;
    const leftOrder = remoteOrder(left); const rightOrder = remoteOrder(right);
    if (Number.isFinite(leftOrder) && Number.isFinite(rightOrder) && leftOrder !== rightOrder) return leftOrder - rightOrder;
    return left.sidebarIndex - right.sidebarIndex;
  };
  return [...groups.entries()]
    .map(([name, items], index) => ({ name, index, projects: items.sort(compareProjects) }))
    .sort((left, right) => groupRank(left.name) - groupRank(right.name) || left.index - right.index)
    .map(({ name, projects }) => ({ name, projects }));
}

export const RECURRING_BOARD_VIEW_ID = "ticktick:view:recurring";
export const ALL_BOARD_VIEW_ID = "ticktick:view:all";
export const INBOX_BOARD_VIEW_ID = "ticktick:view:inbox";
export const UNSCHEDULED_BOARD_VIEW_ID = "ticktick:view:unscheduled";
export const TODAY_BOARD_VIEW_ID = "ticktick:view:today";
export const UPCOMING_BOARD_VIEW_ID = "ticktick:view:upcoming";
export const OVERDUE_BOARD_VIEW_ID = "ticktick:view:overdue";
export const HIGH_PRIORITY_BOARD_VIEW_ID = "ticktick:view:high-priority";
export const COMPLETED_BOARD_VIEW_ID = "ticktick:view:completed";
export const TAG_BOARD_VIEW_PREFIX = "ticktick:view:tag:";
export const SAVED_BOARD_VIEW_PREFIX = "ticktick:view:saved:";

/** Virtual board entries are derived from the local TickTick cache. They never
 * represent remote projects, so selecting one must not enable project edits or
 * cross-column moves. */
export function virtualBoardEntries(tasks = [], options = {}) {
  const timeZone = options.timeZone || "Asia/Tehran";
  const todayKey = options.todayKey || todayInZone(timeZone);
  const open = tasks.filter(task => Number(task?.status ?? 0) === 0);
  const tags = new Map();
  for (const task of open) {
    for (const tag of Array.isArray(task.tags) ? task.tags : []) {
      const name = String(tag ?? "").trim();
      if (name) tags.set(name, (tags.get(name) ?? 0) + 1);
    }
  }

  const tomorrow = shiftCalendarDay(todayKey, 1);
  const nextWeekEnd = shiftCalendarDay(todayKey, 7);

  const recurringCount = open.filter(task => Boolean(task.repeatFlag)).length;
  const unscheduledCount = open.filter(task => !toDateKey(task.dueDate, task.timeZone || timeZone) && !toDateKey(task.startDate, task.timeZone || timeZone)).length;
  const todayCount = open.filter(task => {
    const due = toDateKey(task.dueDate, task.timeZone || timeZone);
    const start = toDateKey(task.startDate, task.timeZone || timeZone);
    if (due === todayKey || start === todayKey) return true;
    if (start && due && start <= todayKey && due >= todayKey) return true;
    return false;
  }).length;
  const upcomingCount = open.filter(task => {
    const due = toDateKey(task.dueDate, task.timeZone || timeZone) ?? toDateKey(task.startDate, task.timeZone || timeZone);
    return Boolean(due && due >= tomorrow && due <= nextWeekEnd);
  }).length;
  const overdueCount = open.filter(task => {
    const due = toDateKey(task.dueDate, task.timeZone || timeZone);
    return Boolean(due && due < todayKey);
  }).length;
  const inboxCount = open.filter(task => Boolean(task.isInbox) || String(task.projectId ?? "").toLowerCase() === "inbox" || !task.projectId).length;
  const highPriorityCount = open.filter(task => Number(task.priority) === 5).length;
  const completedCount = tasks.filter(task => Number(task.status ?? 0) !== 0).length;

  const smartViews = [
    { id: RECURRING_BOARD_VIEW_ID, key: "recurring", name: "تکرارشونده‌ها", icon: "repeat-2", count: recurringCount },
    { id: UNSCHEDULED_BOARD_VIEW_ID, key: "unscheduled", name: "بدون تاریخ", icon: "calendar-off", count: unscheduledCount },
    { id: TODAY_BOARD_VIEW_ID, key: "today", name: "امروز", icon: "sun", count: todayCount },
    { id: UPCOMING_BOARD_VIEW_ID, key: "upcoming", name: "هفتهٔ آینده", icon: "calendar-days", count: upcomingCount },
    { id: OVERDUE_BOARD_VIEW_ID, key: "overdue", name: "عقب‌افتاده", icon: "alert-circle", count: overdueCount },
    { id: INBOX_BOARD_VIEW_ID, key: "inbox", name: "ورودی", icon: "inbox", count: inboxCount },
    { id: HIGH_PRIORITY_BOARD_VIEW_ID, key: "highPriority", name: "اولویت بالا", icon: "alert-triangle", count: highPriorityCount },
    { id: COMPLETED_BOARD_VIEW_ID, key: "completed", name: "تکمیل‌شده‌ها", icon: "check-circle-2", count: completedCount },
  ];

  return {
    all: { id: ALL_BOARD_VIEW_ID, name: "همهٔ لیست‌ها", count: open.length },
    inbox: { id: INBOX_BOARD_VIEW_ID, name: "ورودی", count: inboxCount },
    recurring: { id: RECURRING_BOARD_VIEW_ID, name: "تکرارشونده‌ها", count: recurringCount },
    unscheduled: { id: UNSCHEDULED_BOARD_VIEW_ID, name: "بدون تاریخ", count: unscheduledCount },
    today: { id: TODAY_BOARD_VIEW_ID, name: "امروز", count: todayCount },
    upcoming: { id: UPCOMING_BOARD_VIEW_ID, name: "هفتهٔ آینده", count: upcomingCount },
    overdue: { id: OVERDUE_BOARD_VIEW_ID, name: "عقب‌افتاده", count: overdueCount },
    highPriority: { id: HIGH_PRIORITY_BOARD_VIEW_ID, name: "اولویت بالا", count: highPriorityCount },
    completed: { id: COMPLETED_BOARD_VIEW_ID, name: "تکمیل‌شده‌ها", count: completedCount },
    smartViews,
    savedViews: (Array.isArray(options.savedViews) ? options.savedViews : []).map(view => ({
      id: `${SAVED_BOARD_VIEW_PREFIX}${view.id}`,
      viewId: view.id,
      name: view.name,
      icon: "bookmark",
      count: (view.filter?.statuses && view.filter.statuses.length > 0)
        ? tasks.filter(task => matchesTaskFilter(task, view.filter, options)).length
        : open.filter(task => matchesTaskFilter(task, view.filter, options)).length,
      rawView: view,
    })),
    tags: [...tags.entries()]
      .sort(([left], [right]) => left.localeCompare(right, "fa"))
      .map(([name, count]) => ({ id: `${TAG_BOARD_VIEW_PREFIX}${encodeURIComponent(name)}`, name, count })),
  };
}

export function selectSmartViewTasks(selection, tasks = [], options = {}) {
  const timeZone = options.timeZone || "Asia/Tehran";
  const todayKey = options.todayKey || todayInZone(timeZone);
  const open = tasks.filter(task => Number(task?.status ?? 0) === 0);

  if (selection === ALL_BOARD_VIEW_ID) {
    return { name: "همهٔ لیست‌ها", tasks: open };
  }
  if (selection === RECURRING_BOARD_VIEW_ID) {
    return { name: "تکرارشونده‌ها", tasks: open.filter(task => Boolean(task.repeatFlag)) };
  }
  if (selection === UNSCHEDULED_BOARD_VIEW_ID) {
    return {
      name: "بدون تاریخ",
      tasks: open.filter(task => !toDateKey(task.dueDate, task.timeZone || timeZone) && !toDateKey(task.startDate, task.timeZone || timeZone))
    };
  }
  if (selection === TODAY_BOARD_VIEW_ID) {
    return {
      name: "امروز",
      tasks: open.filter(task => {
        const due = toDateKey(task.dueDate, task.timeZone || timeZone);
        const start = toDateKey(task.startDate, task.timeZone || timeZone);
        if (due === todayKey || start === todayKey) return true;
        if (start && due && start <= todayKey && due >= todayKey) return true;
        return false;
      })
    };
  }
  if (selection === UPCOMING_BOARD_VIEW_ID) {
    const tomorrow = shiftCalendarDay(todayKey, 1);
    const nextWeekEnd = shiftCalendarDay(todayKey, 7);
    return {
      name: "هفتهٔ آینده",
      tasks: open.filter(task => {
        const due = toDateKey(task.dueDate, task.timeZone || timeZone) ?? toDateKey(task.startDate, task.timeZone || timeZone);
        return Boolean(due && due >= tomorrow && due <= nextWeekEnd);
      })
    };
  }
  if (selection === OVERDUE_BOARD_VIEW_ID) {
    return {
      name: "عقب‌افتاده",
      tasks: open.filter(task => {
        const due = toDateKey(task.dueDate, task.timeZone || timeZone);
        return Boolean(due && due < todayKey);
      })
    };
  }
  if (selection === INBOX_BOARD_VIEW_ID) {
    return {
      name: "ورودی",
      tasks: open.filter(task => Boolean(task.isInbox) || String(task.projectId ?? "").toLowerCase() === "inbox" || !task.projectId)
    };
  }
  if (selection === HIGH_PRIORITY_BOARD_VIEW_ID) {
    return {
      name: "اولویت بالا",
      tasks: open.filter(task => Number(task.priority) === 5)
    };
  }
  if (selection === COMPLETED_BOARD_VIEW_ID) {
    return {
      name: "تکمیل‌شده‌ها",
      tasks: tasks.filter(task => Number(task.status ?? 0) !== 0)
    };
  }
  if (String(selection ?? "").startsWith(TAG_BOARD_VIEW_PREFIX)) {
    const tag = decodeURIComponent(String(selection).slice(TAG_BOARD_VIEW_PREFIX.length));
    return {
      name: `#${tag}`,
      tasks: open.filter(task => (task.tags ?? []).some(value => String(value) === tag))
    };
  }
  if (String(selection ?? "").startsWith(SAVED_BOARD_VIEW_PREFIX)) {
    const viewId = String(selection).slice(SAVED_BOARD_VIEW_PREFIX.length);
    const savedViews = Array.isArray(options.savedViews) ? options.savedViews : [];
    const view = savedViews.find(v => String(v.id) === viewId);
    if (view) {
      const matching = (view.filter?.statuses && view.filter.statuses.length > 0)
        ? tasks.filter(task => matchesTaskFilter(task, view.filter, options))
        : open.filter(task => matchesTaskFilter(task, view.filter, options));
      return {
        name: view.name,
        tasks: matching,
        savedView: view
      };
    }
  }
  return null;
}

export function virtualBoardData(selection, tasks = [], projects = [], options = {}) {
  const selected = selectSmartViewTasks(selection, tasks, options);
  if (!selected) return null;

  const { name, tasks: matching, savedView } = selected;
  const grouping = options.grouping || savedView?.grouping || "project";
  const timeZone = options.timeZone || "Asia/Tehran";
  const todayKey = options.todayKey || todayInZone(timeZone);

  let columns = [];
  let mappedTasks = [];

  if (grouping === "priority") {
    columns = [
      { id: "p-high", name: "اولویت بالا", color: "var(--text-error, #e53935)", sortOrder: 0, synthetic: true },
      { id: "p-medium", name: "اولویت متوسط", color: "var(--text-warning, #fb8c00)", sortOrder: 1, synthetic: true },
      { id: "p-low", name: "اولویت پایین", color: "var(--text-accent, #1e88e5)", sortOrder: 2, synthetic: true },
      { id: "p-none", name: "بدون اولویت", color: "var(--text-muted, #757575)", sortOrder: 3, synthetic: true },
    ];
    mappedTasks = matching.map(task => {
      const priority = Number(task.priority ?? 0);
      const columnId = priority === 5 ? "p-high" : priority === 3 ? "p-medium" : priority === 1 ? "p-low" : "p-none";
      return { ...task, columnId };
    });
  } else if (grouping === "date") {
    const tomorrow = shiftCalendarDay(todayKey, 1);
    const nextWeekEnd = shiftCalendarDay(todayKey, 7);
    const dateDefs = [
      { id: "d-overdue", name: "عقب‌افتاده", color: "var(--text-error, #e53935)", sortOrder: 0, synthetic: true },
      { id: "d-today", name: "امروز", color: "var(--interactive-accent, #2196f3)", sortOrder: 1, synthetic: true },
      { id: "d-tomorrow", name: "فردا", color: "var(--text-accent, #00acc1)", sortOrder: 2, synthetic: true },
      { id: "d-week", name: "این هفته", color: "var(--text-success, #43a047)", sortOrder: 3, synthetic: true },
      { id: "d-later", name: "آینده", color: "var(--text-muted, #7e57c2)", sortOrder: 4, synthetic: true },
      { id: "d-unscheduled", name: "بدون تاریخ", color: "var(--text-muted, #9e9e9e)", sortOrder: 5, synthetic: true },
    ];
    mappedTasks = matching.map(task => {
      const due = toDateKey(task.dueDate, task.timeZone || timeZone) ?? toDateKey(task.startDate, task.timeZone || timeZone);
      let columnId = "d-unscheduled";
      if (!due) columnId = "d-unscheduled";
      else if (due < todayKey) columnId = "d-overdue";
      else if (due === todayKey) columnId = "d-today";
      else if (due === tomorrow) columnId = "d-tomorrow";
      else if (due <= nextWeekEnd) columnId = "d-week";
      else columnId = "d-later";
      return { ...task, columnId };
    });
    const usedColIds = new Set(mappedTasks.map(t => t.columnId));
    columns = dateDefs.filter(d => usedColIds.has(d.id));
    if (columns.length === 0) columns = dateDefs;
  } else if (grouping === "tag") {
    const allTags = new Set();
    let hasUntagged = false;
    for (const task of matching) {
      const taskTags = Array.isArray(task.tags) ? task.tags : [];
      if (taskTags.length === 0) {
        hasUntagged = true;
      } else {
        for (const t of taskTags) {
          const clean = String(t ?? "").trim();
          if (clean) allTags.add(clean);
        }
      }
    }
    const sortedTags = [...allTags].sort((a, b) => a.localeCompare(b, "fa"));
    columns = sortedTags.map((tag, index) => ({
      id: `t-${encodeURIComponent(tag)}`,
      name: `#${tag}`,
      sortOrder: index,
      synthetic: true,
    }));
    if (hasUntagged || columns.length === 0) {
      columns.push({
        id: "t-none",
        name: "بدون برچسب",
        sortOrder: columns.length,
        synthetic: true,
      });
    }
    mappedTasks = matching.map(task => {
      const taskTags = Array.isArray(task.tags) ? task.tags : [];
      const primaryTag = taskTags.find(t => String(t ?? "").trim());
      const columnId = primaryTag ? `t-${encodeURIComponent(primaryTag)}` : "t-none";
      return { ...task, columnId };
    });
  } else {
    // Default: grouping === "project"
    const usedProjectIds = new Set(matching.map(task => String(task.projectId ?? "")));
    columns = projects.filter(project => usedProjectIds.has(String(project.id))).map((project, index) => ({
      id: String(project.id), name: String(project.name ?? "بدون پروژه"), color: project.color, sortOrder: index, synthetic: true,
    }));
    const known = new Set(columns.map(column => column.id));
    for (const task of matching) {
      const projectId = String(task.projectId ?? "");
      if (known.has(projectId)) continue;
      known.add(projectId);
      columns.push({ id: projectId, name: projectId.toLowerCase() === "inbox" || !projectId ? "ورودی" : String(task.projectName ?? "بدون پروژه"), sortOrder: columns.length, synthetic: true });
    }
    mappedTasks = matching.map(task => ({ ...task, columnId: String(task.projectId ?? "") }));
  }

  return {
    project: { id: selection, name, virtual: true, grouping },
    columns,
    tasks: mappedTasks,
  };
}

const isNote = task => String(task?.kind ?? task?.type ?? task?.taskType ?? "").toUpperCase() === "NOTE";
const isPinned = task => Boolean(task?.pinned ?? task?.isPinned ?? task?.pin ?? task?.pinnedTime ?? task?.pinnedAt ?? task?.pinTime);
const groupName = priority => ({ 5: "High", 3: "Medium", 1: "Low" }[Number(priority)] ?? "No priority");

export function boardColumns(data, showCompleted = false) {
  const isCompletedView = data.project?.id === COMPLETED_BOARD_VIEW_ID;
  const effectiveShowCompleted = showCompleted || isCompletedView;
  const columns = data.columns.length ? data.columns : [{ id: "", name: "Tasks", synthetic: true, sortOrder: 0 }];
  const isPriorityGrouping = data.project?.grouping === "priority";

  return columns.map(column => {
    const matching = data.tasks.filter(task => String(task.columnId ?? "") === String(column.id) && (effectiveShowCompleted || Number(task.status ?? 0) === 0));
    const ordered = matching.slice().sort((a, b) => Number(isPinned(b)) - Number(isPinned(a)) || Number(a.sortOrder ?? a.order ?? 0) - Number(b.sortOrder ?? b.order ?? 0) || String(a.title).localeCompare(String(b.title), "fa"));
    
    if (isPriorityGrouping) {
      const groups = [
        { name: "Pinned", tasks: ordered.filter(task => isPinned(task)) },
        { name: "", tasks: ordered.filter(task => !isPinned(task)) },
      ].filter(group => group.tasks.length);
      return { ...column, count: matching.length, groups };
    }

    const groups = ["Pinned", "High", "Medium", "Low", "No priority", ...(effectiveShowCompleted ? ["Completed"] : [])].map(name => ({ name, tasks: ordered.filter(task => {
      if (name === "Pinned") return isPinned(task);
      if (isPinned(task)) return false;
      return Number(task.status ?? 0) !== 0 ? name === "Completed" : groupName(task.priority) === name;
    }) })).filter(group => group.tasks.length);
    return { ...column, count: matching.length, groups };
  });
}
