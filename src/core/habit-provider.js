/**
 * Habits deliberately use their own provider. The official Task API must not
 * be misused for Habit data, and local Habits files remain valid offline.
 */
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
    return (await this.listHabits()).map(habit => ({ ...habit, day }));
  }
}
