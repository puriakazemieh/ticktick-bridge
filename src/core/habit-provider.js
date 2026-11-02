/**
 * Habits deliberately use their own provider. The official Task API must not
 * be misused for Habit data, and local Habits files remain valid offline.
 */
import { localHabitForDay } from "./local-habit.js";

export class HabitProvider {
  async listForDay() { throw new Error("Habit provider is not configured."); }
  async setCheckin() { throw new Error("Habit provider is not configured."); }
}

export class LocalHabitProvider extends HabitProvider {
  constructor({ listHabits }) {
    super();
    this.listHabits = listHabits;
  }

  async listForDay(day) {
    const habits = await this.listHabits();
    return (Array.isArray(habits) ? habits : []).map(habit => localHabitForDay(habit, day));
  }
}
