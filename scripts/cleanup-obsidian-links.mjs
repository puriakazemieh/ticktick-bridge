/**
 * Removes stale obsidian:// Markdown links from every TickTick task title and
 * description. Run only with the vault path as its argument; the API token is
 * read locally from this plugin's Obsidian data file and is never printed.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const vaultPath = process.argv[2];
if (!vaultPath) throw new Error("Usage: node scripts/cleanup-obsidian-links.mjs <vault-path>");

const dataPath = join(vaultPath, ".obsidian", "plugins", "ticktick-bridge", "data.json");
const settings = JSON.parse(await readFile(dataPath, "utf8"));
const token = String(settings.apiToken ?? "").trim();
if (!token) throw new Error("TickTick Bridge API token is not configured.");

const api = "https://api.ticktick.com/open/v1";
const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

async function request(path, init = {}) {
  // TickTick occasionally answers a transient 500 while its project list is
  // being refreshed. Retrying makes a one-off cleanup safe and complete.
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(`${api}${path}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) } });
    if (response.ok) return response.status === 204 ? null : response.json();
    if (response.status < 500 || attempt === 2) throw new Error(`${init.method ?? "GET"} ${path} failed (${response.status})`);
    await new Promise(resolve => setTimeout(resolve, 800 * (attempt + 1)));
  }
}

function stripObsidian(value) {
  return String(value ?? "")
    .replace(/\s*\[[^\]]*\]\(\s*obsidian:\/\/[^)]*\)/gi, "")
    .replace(/obsidian:\/\/[^\s<\])]+/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const projects = await request("/project");
let scannedTasks = 0;
let changed = 0;
let updated = 0;
let failed = 0;

for (const project of projects) {
  const document = await request(`/project/${project.id}/data`);
  for (const task of document.tasks ?? []) {
    scannedTasks++;
    const title = stripObsidian(task.title);
    const content = stripObsidian(task.content);
    const desc = stripObsidian(task.desc);
    if (title === String(task.title ?? "") && content === String(task.content ?? "") && desc === String(task.desc ?? "")) continue;
    changed++;
    try {
      await request(`/task/${task.id}`, { method: "POST", body: JSON.stringify({ ...task, title, content, desc }) });
      updated++;
    } catch {
      failed++;
    }
  }
}

console.log(JSON.stringify({ scannedProjects: projects.length, scannedTasks, changed, updated, failed }));
if (failed) process.exitCode = 1;
