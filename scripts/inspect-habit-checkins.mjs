import { readFile } from "node:fs/promises";
import { join } from "node:path";

const vault = process.argv[2];
const day = process.argv[3] ?? "2026-10-04";
if (!vault) throw new Error("Usage: node scripts/inspect-habit-checkins.mjs <vault-path> [YYYY-MM-DD]");
const settings = JSON.parse(await readFile(join(vault, ".obsidian", "plugins", "ticktick-bridge", "data.json"), "utf8"));
const token = String(settings.apiToken ?? "").trim();
if (!token) throw new Error("TickTick Bridge API token is not configured.");
const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
const base = "https://api.ticktick.com/open/v1";
const request = async path => {
  const response = await fetch(`${base}${path}`, { headers });
  if (!response.ok) throw new Error(`${path} failed (${response.status})`);
  return response.json();
};
const habits = await request("/habit");
const stamp = Number(day.replaceAll("-", ""));
const checkins = await request(`/habit/checkins?habitIds=${encodeURIComponent(habits.map(habit => habit.id).join(","))}&from=${stamp}&to=${stamp}`);
const details = await Promise.all(habits.map(async habit => {
  const detail = await request(`/habit/${habit.id}`);
  return { id: habit.id, name: habit.name, keys: Object.keys(detail), detail };
}));
console.log(JSON.stringify({
  day,
  stamp,
  habits: habits.map(habit => ({ id: habit.id, name: habit.name, goal: habit.goal, target: habit.target, repeatRule: habit.repeatRule })),
  checkins,
  details,
}, null, 2));
