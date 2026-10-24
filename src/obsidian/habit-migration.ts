import { App, TFile } from "obsidian";
import { parseLocalHabit } from "../core/local-habit.js";
import { ManagedStorage } from "./managed-storage";

export class HabitMigration {
  constructor(private app: App, private storage: ManagedStorage, private folder: () => string) {}
  async localHabits() {
    const prefix = this.folder().replace(/^\/+|\/+$/g, "");
    const files = this.app.vault.getMarkdownFiles().filter(file => file.path.startsWith(`${prefix}/`) && !file.path.startsWith(".ticktick/"));
    return Promise.all(files.map(async file => parseLocalHabit(await this.app.vault.read(file), file.path)));
  }
  async preview(remoteHabits: any[] = []) {
    const habits = await this.localHabits();
    const rows = habits.map(habit => ({ ...habit, selected: false, duplicate: remoteHabits.filter(remote => String(remote.name ?? "").trim() === habit.name).map(remote => remote.id), remotePayload: { name: habit.name, goal: habit.goal, unit: habit.unit, sectionName: habit.sectionName, cadence: habit.cadence }, loss: ["تاریخچهٔ محلی فقط خواندنی می‌ماند؛ import تاریخچه به TickTick پشتیبانی نمی‌شود.", ...(habit.needsMapping ? ["نیازمند نگاشت دستی"] : [])] }));
    await this.storage.writeReport("habit-migration-preview", { sourceCount: rows.length, needsMapping: rows.filter(row => row.needsMapping).length, duplicateCount: rows.filter(row => row.duplicate.length).length, remoteCreation: "blocked-unverified-official-api" });
    return rows;
  }
  async apply() { throw new Error("ایجاد Habit تا زمان تأیید endpoint رسمی TickTick غیرفعال است. پیش‌نمایش و تاریخچهٔ محلی بدون تغییر باقی می‌مانند."); }
}
