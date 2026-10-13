import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const vault = process.argv[2];
const apply = process.argv.includes("--apply");
if (!vault) throw new Error("Usage: node scripts/sync-project-tasks.mjs <vault-path> [--apply]");

const root = path.join(vault, "Projects", "برنامه کلان ۱۴۰۵");
const map = JSON.parse(await readFile(new URL("../config/project-map.json", import.meta.url), "utf8"));
const settings = JSON.parse(await readFile(path.join(vault, ".obsidian", "plugins", "ticktick-bridge", "data.json"), "utf8"));
if (!settings.apiToken) throw new Error("TickTick Bridge API token is missing.");

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const output = [];
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await walk(target));
    else if (entry.isFile() && entry.name.endsWith(".md")) output.push(target);
  }
  return output;
}

function frontmatter(markdown) {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return null;
  const value = key => match[1].match(new RegExp(`^${key}:\\s*["']?([^\\r\\n"']+)["']?\\s*$`, "mi"))?.[1]?.trim() ?? "";
  const inlineTags = match[1].match(/^tags:\s*\[([^\]]*)\]/mi)?.[1];
  const blockTags = match[1].match(/^tags:\s*\r?\n((?:\s+-\s*[^\r\n]+\r?\n?)+)/mi)?.[1];
  const tags = inlineTags
    ? inlineTags.split(",").map(tag => tag.trim().replace(/^['"]|['"]$/g, "")).filter(Boolean)
    : blockTags ? [...blockTags.matchAll(/^\s+-\s*(.+)$/gmi)].map(match => match[1].trim().replace(/^['"]|['"]$/g, "")) : [];
  return { title: value("title"), type: value("type"), status: value("status").toLowerCase(), start: value("start"), due: value("due"), priority: value("priority").toLowerCase(), tags, description: match[2].trim() };
}

const priority = { low: 1, medium: 3, high: 5 };
const files = await walk(root);
const candidates = [];
for (const file of files) {
  const relative = path.relative(root, file).split(path.sep);
  const area = relative[0];
  if (!map[area] || !relative.includes("_tasks")) continue;
  const data = frontmatter(await readFile(file, "utf8"));
  if (!data?.title || data.type !== "task" || ["done", "completed", "cancelled", "archived"].includes(data.status)) continue;
  candidates.push({ ...data, area, sourcePath: path.relative(vault, file), ...map[area] });
}

const headers = { Authorization: `Bearer ${settings.apiToken}`, "Content-Type": "application/json" };
const baseUrl = "https://api.ticktick.com/open/v1";
const projectIds = [...new Set(candidates.map(task => task.projectId))];
const existing = new Set();
for (const projectId of projectIds) {
  const response = await fetch(`${baseUrl}/project/${encodeURIComponent(projectId)}/data`, { headers });
  if (!response.ok) throw new Error(`Could not read TickTick project (${response.status}).`);
  const data = await response.json();
  for (const task of data.tasks ?? []) existing.add(`${projectId}:${task.columnId ?? ""}:${task.title}`);
}

const pending = candidates.filter(task => !existing.has(`${task.projectId}:${task.columnId}:${task.title}`));
const summary = Object.fromEntries(Object.entries(map).map(([area, destination]) => [area, {
  destination,
  source: candidates.filter(task => task.area === area).length,
  create: pending.filter(task => task.area === area).length,
}]));
if (!apply) {
  console.log(JSON.stringify({ mode: "preview", total: candidates.length, pending: pending.length, summary }, null, 2));
  process.exit(0);
}

let created = 0;
let failed = 0;
for (let index = 0; index < pending.length; index += 4) {
  const results = await Promise.all(pending.slice(index, index + 4).map(async task => {
  const payload = {
    title: task.title,
    content: task.description,
    desc: "",
    projectId: task.projectId,
    columnId: task.columnId,
    startDate: task.start ? `${task.start.slice(0, 10)}T00:00:00+0330` : null,
    dueDate: task.due ? `${task.due.slice(0, 10)}T00:00:00+0330` : null,
    timeZone: "Asia/Tehran",
    isAllDay: true,
    priority: priority[task.priority] ?? 0,
    tags: task.tags.filter(tag => tag.toLowerCase() !== "ticktick"),
  };
  const response = await fetch(`${baseUrl}/task`, { method: "POST", headers, body: JSON.stringify(payload) });
  return response.ok;
  }));
  for (const ok of results) ok ? created++ : failed++;
  if (index + 4 < pending.length) await new Promise(resolve => setTimeout(resolve, 400));
}
console.log(JSON.stringify({ mode: "apply", total: candidates.length, created, skippedExisting: candidates.length - pending.length, failed, summary }, null, 2));
if (failed) process.exitCode = 1;
