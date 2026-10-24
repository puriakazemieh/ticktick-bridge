export function normalizeProjectData(document = {}, fallbackProject = {}) {
  const project = { ...fallbackProject, ...(document.project ?? {}), id: document.project?.id ?? fallbackProject.id ?? document.projectId, name: document.project?.name ?? fallbackProject.name ?? "بدون نام" };
  const columns = (document.columns ?? []).map((column, index) => ({ id: String(column.id ?? ""), name: String(column.name ?? `ستون ${index + 1}`), sortOrder: Number(column.sortOrder ?? index) }));
  const names = new Map(columns.map(column => [column.id, column.name]));
  const tasks = (document.tasks ?? []).map(task => ({ ...task, projectId: task.projectId ?? project.id, projectName: project.name, projectColor: project.color, columnId: task.columnId ?? "", columnName: names.get(String(task.columnId ?? "")) ?? "Tasks" }));
  return { project, columns, tasks };
}
export function sidebarTree(projects, tasks = []) {
  const groups = new Map();
  for (const project of projects ?? []) {
    const group = String(project.groupName ?? project.folderName ?? "");
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push({ ...project, openCount: tasks.filter(task => String(task.projectId) === String(project.id) && Number(task.status ?? 0) === 0).length });
  }
  return [...groups.entries()].map(([name, items]) => ({ name, projects: items.sort((a, b) => String(a.name).localeCompare(String(b.name), "fa")) }));
}
const groupName = priority => ({ 5: "High", 3: "Medium", 1: "Low" }[Number(priority)] ?? "No priority");
export function boardColumns(data, showCompleted = false) {
  const columns = data.columns.length ? data.columns : [{ id: "", name: "Tasks", synthetic: true, sortOrder: 0 }];
  return columns.map(column => {
    const matching = data.tasks.filter(task => String(task.columnId ?? "") === String(column.id) && (showCompleted || Number(task.status ?? 0) === 0));
    const groups = ["High", "Medium", "Low", "No priority", ...(showCompleted ? ["Completed"] : [])].map(name => ({ name, tasks: matching.filter(task => Number(task.status ?? 0) !== 0 ? name === "Completed" : groupName(task.priority) === name).sort((a, b) => Number(a.sortOrder ?? a.order ?? 0) - Number(b.sortOrder ?? b.order ?? 0) || String(a.title).localeCompare(String(b.title), "fa")) })).filter(group => group.tasks.length);
    return { ...column, count: matching.length, groups };
  });
}
