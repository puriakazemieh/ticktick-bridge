import { isHabitScheduledForDay, isScheduledForDay, toHabitStamp } from "./date.js";

export class TickTickApiError extends Error {
  constructor(message, { status, body } = {}) {
    super(message);
    this.name = "TickTickApiError";
    this.status = status;
    this.body = body;
  }
}

async function fetchTransport(url, init) {
  const response = await fetch(url, init);
  return { status: response.status, text: await response.text() };
}

function parseBody(text) {
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text; }
}

/** Portable client: pass Obsidian's requestUrl through `transport` in the plugin. */
export class TickTickClient {
  constructor({ token, transport = fetchTransport, baseUrl = "https://api.ticktick.com/open/v1" }) {
    if (!token?.trim()) throw new Error("TickTick API token is required.");
    this.token = token.trim();
    this.transport = transport;
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async request(path, { method = "GET", body } = {}) {
    const response = await this.transport(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const parsed = parseBody(response.text);
    if (response.status < 200 || response.status >= 300) {
      throw new TickTickApiError("TickTick request failed.", { status: response.status, body: parsed });
    }
    return parsed;
  }

  listProjects() { return this.request("/project"); }
  getProject(projectId) { return this.request(`/project/${encodeURIComponent(projectId)}`); }
  getProjectData(projectId) { return this.request(`/project/${encodeURIComponent(projectId)}/data`); }
  getTask(projectId, taskId) { return this.request(`/project/${encodeURIComponent(projectId)}/task/${encodeURIComponent(taskId)}`); }
  createTask(task) { return this.request("/task", { method: "POST", body: task }); }
  updateTask(task) {
    if (!task?.id) throw new Error("Task id is required for update.");
    return this.request(`/task/${encodeURIComponent(task.id)}`, { method: "POST", body: task });
  }
  deleteTask(projectId, taskId) {
    return this.request(`/project/${encodeURIComponent(projectId)}/task/${encodeURIComponent(taskId)}`, { method: "DELETE" });
  }
  /** TickTick advances recurring tasks itself; never calculate the next date locally. */
  completeTask(projectId, taskId) {
    return this.request(`/project/${encodeURIComponent(projectId)}/task/${encodeURIComponent(taskId)}/complete`, { method: "POST" });
  }
  listHabits() { return this.request("/habit"); }
  listHabitSections() { return this.request("/habit/sections"); }
  getHabit(habitId) { return this.request(`/habit/${encodeURIComponent(habitId)}`); }
  getHabitCheckins(habitIds, fromDay, toDay) {
    const params = new URLSearchParams({
      habitIds: habitIds.join(","),
      from: String(toHabitStamp(fromDay)),
      to: String(toHabitStamp(toDay)),
    });
    return this.request(`/habit/checkins?${params}`);
  }
  /**
   * @param {string} habitId
   * @param {string} day
   * @param {{ value?: number, goal?: number, status?: number }} [options]
   */
  checkInHabit(habitId, day, { value = 1, goal = 1, status = undefined } = {}) {
    // A partial counter check-in must not be sent as status 1.  TickTick
    // interprets that status as "skipped" in its habit UI, even when `value`
    // is below the goal.  With no explicit status TickTick keeps the entry as
    // an in-progress counter check-in and derives completion from value/goal.
    const body = { stamp: toHabitStamp(day), value, goal };
    if (status !== undefined && status !== null) body.status = status;
    return this.request(`/habit/${encodeURIComponent(habitId)}/checkin`, {
      method: "POST",
      body,
    });
  }

  async listOpenTasks() {
    const projects = await this.listProjects();
    const collections = await Promise.all(projects.map(async project => {
      const data = await this.getProjectData(project.id);
      return (data.tasks ?? []).map(task => ({ ...task, projectName: project.name }));
    }));
    return collections.flat().filter(task => task.status === 0);
  }

  async tasksForDay(day) {
    const tasks = await this.listOpenTasks();
    return tasks.filter(task => isScheduledForDay(task, day));
  }

  async listRecurringTasks() {
    const tasks = await this.listOpenTasks();
    return tasks
      .filter(task => Boolean(task.repeatFlag))
      .sort((left, right) => String(left.dueDate ?? "9999-12-31").localeCompare(String(right.dueDate ?? "9999-12-31")) || String(left.title ?? "").localeCompare(String(right.title ?? ""), "fa"));
  }

  async habitsForDay(day) {
    const [habits, sections] = await Promise.all([this.listHabits(), this.listHabitSections()]);
    const sectionNames = new Map(sections.map(section => [section.id, section.name]));
    const active = habits.filter(habit => isHabitScheduledForDay(habit, day));
    if (!active.length) return [];
    const checkinDocuments = await this.getHabitCheckins(active.map(habit => habit.id), day, day);
    const values = new Map((checkinDocuments ?? []).flatMap(document => (document.checkins ?? [])
      // TickTick returns `stamp` as either a number or a numeric string,
      // depending on the endpoint/cache layer. Normalize it before matching.
      .filter(checkin => Number(checkin.stamp) === toHabitStamp(day))
      .map(checkin => [document.habitId, checkin])));
    return active.map(habit => ({ ...habit, sectionName: sectionNames.get(habit.sectionId) ?? "بدون دسته", checkin: values.get(habit.id) ?? null }));
  }

  async habitsWithHistory(day, days = 28) {
    const [habits, sections] = await Promise.all([this.listHabits(), this.listHabitSections()]);
    const sectionNames = new Map(sections.map(section => [section.id, section.name]));
    const start = new Date(`${day}T12:00:00Z`);
    start.setUTCDate(start.getUTCDate() - Math.max(0, days - 1));
    const fromDay = start.toISOString().slice(0, 10);
    const documents = await this.getHabitCheckins(habits.map(habit => habit.id), fromDay, day);
    const checkins = new Map((documents ?? []).flatMap(document => (document.checkins ?? [])
      .map(checkin => [`${document.habitId}:${checkin.stamp}`, checkin])));
    const dates = Array.from({ length: days }, (_, index) => {
      const value = new Date(`${fromDay}T12:00:00Z`);
      value.setUTCDate(value.getUTCDate() + index);
      return value.toISOString().slice(0, 10);
    });
    return habits.map(habit => {
      const goal = Math.max(1, Number(habit.goal ?? 1));
      const history = dates.filter(date => isHabitScheduledForDay(habit, date)).map(date => {
        const checkin = checkins.get(`${habit.id}:${toHabitStamp(date)}`) ?? null;
        const value = Number(checkin?.value ?? 0);
        return { date, value, completed: checkin?.status === 2 || value >= goal };
      });
      const checkin = checkins.get(`${habit.id}:${toHabitStamp(day)}`) ?? null;
      return { ...habit, sectionName: sectionNames.get(habit.sectionId) ?? "بدون دسته", checkin, history };
    });
  }
}
