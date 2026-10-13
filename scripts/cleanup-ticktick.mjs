import { readFile } from "node:fs/promises";
import path from "node:path";

const vault = process.argv[2];
const limit = Math.max(1, Number(process.argv[3] ?? 30));
const pauseMs = Math.max(0, Number(process.argv[4] ?? 0));
if (!vault) throw new Error("Usage: node scripts/cleanup-ticktick.mjs <vault-path> [limit]");

const settings = JSON.parse(await readFile(path.join(vault, ".obsidian", "plugins", "ticktick-bridge", "data.json"), "utf8"));
if (!settings.apiToken) throw new Error("TickTick Bridge API token is missing.");
const headers = { Authorization: `Bearer ${settings.apiToken}`, "Content-Type": "application/json" };
const baseUrl = "https://api.ticktick.com/open/v1";
const cleanTitle = value => String(value ?? "")
  .replace(/\s*\[[^\]]*\]\(obsidian:\/\/open[^)]*\)/giu, "")
  .replace(/\s*obsidian:\/\/open[^\s<\])]+/giu, "")
  .replace(/\s{2,}/g, " ")
  .trim();

const projectsResponse = await fetch(`${baseUrl}/project`, { headers });
if (!projectsResponse.ok) throw new Error(`Could not list TickTick projects (${projectsResponse.status}).`);
const projects = await projectsResponse.json();
const targets = [];
for (const project of projects) {
  const dataResponse = await fetch(`${baseUrl}/project/${encodeURIComponent(project.id)}/data`, { headers });
  if (!dataResponse.ok) throw new Error(`Could not read a TickTick project (${dataResponse.status}).`);
  const data = await dataResponse.json();
  for (const task of data.tasks ?? []) {
    const tags = (task.tags ?? []).filter(tag => String(tag).toLowerCase() !== "ticktick");
    if (/obsidian:\/\/open/i.test(String(task.title ?? "")) || tags.length !== (task.tags ?? []).length) {
      targets.push({ ...task, title: cleanTitle(task.title), tags });
    }
  }
}

const batch = targets.slice(0, limit);
let updated = 0;
let failed = 0;
for (let index = 0; index < batch.length; index += 5) {
  const results = await Promise.all(batch.slice(index, index + 5).map(async task => {
    const response = await fetch(`${baseUrl}/task/${encodeURIComponent(task.id)}`, {
      method: "POST",
      headers,
      body: JSON.stringify(task),
    });
    return response.ok;
  }));
  for (const ok of results) ok ? updated++ : failed++;
  if (pauseMs && index + 5 < batch.length) await new Promise(resolve => setTimeout(resolve, pauseMs));
}
console.log(JSON.stringify({ queued: targets.length, attempted: batch.length, updated, failed }));
