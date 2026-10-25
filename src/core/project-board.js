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
const TAG_BOARD_VIEW_PREFIX = "ticktick:view:tag:";

/** Virtual board entries are derived from the local TickTick cache. They never
 * represent remote projects, so selecting one must not enable project edits or
 * cross-column moves. */
export function virtualBoardEntries(tasks = []) {
  const open = tasks.filter(task => Number(task?.status ?? 0) === 0);
  const tags = new Map();
  for (const task of open) {
    for (const tag of Array.isArray(task.tags) ? task.tags : []) {
      const name = String(tag ?? "").trim();
      if (name) tags.set(name, (tags.get(name) ?? 0) + 1);
    }
  }
  return {
    all: { id: ALL_BOARD_VIEW_ID, name: "همهٔ لیست‌ها", count: open.length },
    inbox: { id: INBOX_BOARD_VIEW_ID, name: "ورودی", count: open.filter(task => String(task.projectId ?? "").toLowerCase() === "inbox" || !task.projectId).length },
    recurring: { id: RECURRING_BOARD_VIEW_ID, name: "تکرارشونده‌ها", count: open.filter(task => Boolean(task.repeatFlag)).length },
    tags: [...tags.entries()]
      .sort(([left], [right]) => left.localeCompare(right, "fa"))
      .map(([name, count]) => ({ id: `${TAG_BOARD_VIEW_PREFIX}${encodeURIComponent(name)}`, name, count })),
  };
}

export function virtualBoardData(selection, tasks = [], projects = []) {
  const entries = virtualBoardEntries(tasks);
  let name = "";
  let matching = [];
  if (selection === ALL_BOARD_VIEW_ID) {
    name = entries.all.name;
    matching = tasks;
  } else if (selection === INBOX_BOARD_VIEW_ID) {
    name = entries.inbox.name;
    matching = tasks.filter(task => String(task.projectId ?? "").toLowerCase() === "inbox" || !task.projectId);
  } else if (selection === RECURRING_BOARD_VIEW_ID) {
    name = entries.recurring.name;
    matching = tasks.filter(task => Boolean(task.repeatFlag));
  } else if (String(selection ?? "").startsWith(TAG_BOARD_VIEW_PREFIX)) {
    const tag = decodeURIComponent(String(selection).slice(TAG_BOARD_VIEW_PREFIX.length));
    const entry = entries.tags.find(item => item.name === tag);
    if (!entry) return null;
    name = `#${tag}`;
    matching = tasks.filter(task => (task.tags ?? []).some(value => String(value) === tag));
  } else return null;

  const usedProjectIds = new Set(matching.map(task => String(task.projectId ?? "")));
  const columns = projects.filter(project => usedProjectIds.has(String(project.id))).map((project, index) => ({
    id: String(project.id), name: String(project.name ?? "بدون پروژه"), color: project.color, sortOrder: index, synthetic: true,
  }));
  const known = new Set(columns.map(column => column.id));
  for (const task of matching) {
    const projectId = String(task.projectId ?? "");
    if (known.has(projectId)) continue;
    known.add(projectId);
    columns.push({ id: projectId, name: projectId.toLowerCase() === "inbox" || !projectId ? "ورودی" : String(task.projectName ?? "بدون پروژه"), sortOrder: columns.length, synthetic: true });
  }
  return {
    project: { id: selection, name, virtual: true },
    columns,
    tasks: matching.map(task => ({ ...task, columnId: String(task.projectId ?? "") })),
  };
}

const isNote = task => String(task?.kind ?? task?.type ?? task?.taskType ?? "").toUpperCase() === "NOTE";
const isPinned = task => Boolean(task?.pinned ?? task?.isPinned ?? task?.pin ?? task?.pinnedTime ?? task?.pinnedAt ?? task?.pinTime);
const groupName = priority => ({ 5: "High", 3: "Medium", 1: "Low" }[Number(priority)] ?? "No priority");
export function boardColumns(data, showCompleted = false) {
  const columns = data.columns.length ? data.columns : [{ id: "", name: "Tasks", synthetic: true, sortOrder: 0 }];
  return columns.map(column => {
    const matching = data.tasks.filter(task => String(task.columnId ?? "") === String(column.id) && (showCompleted || Number(task.status ?? 0) === 0));
    const ordered = matching.slice().sort((a, b) => Number(isPinned(b)) - Number(isPinned(a)) || Number(a.sortOrder ?? a.order ?? 0) - Number(b.sortOrder ?? b.order ?? 0) || String(a.title).localeCompare(String(b.title), "fa"));
    const groups = ["Pinned", "High", "Medium", "Low", "No priority", ...(showCompleted ? ["Completed"] : [])].map(name => ({ name, tasks: ordered.filter(task => {
      if (name === "Pinned") return isPinned(task);
      if (isPinned(task)) return false;
      return Number(task.status ?? 0) !== 0 ? name === "Completed" : groupName(task.priority) === name;
    }) })).filter(group => group.tasks.length);
    return { ...column, count: matching.length, groups };
  });
}
