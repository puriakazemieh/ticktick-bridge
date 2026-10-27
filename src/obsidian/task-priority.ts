import type { TaskPriorityInfo } from "./types";

export function taskPriority(input: unknown): TaskPriorityInfo {
  const value = Number(input ?? 0);
  if (value >= 5) return { value: 5, label: "بالا", icon: "🔴", className: "is-high" };
  if (value >= 3) return { value: 3, label: "متوسط", icon: "🟠", className: "is-medium" };
  if (value >= 1) return { value: 1, label: "کم", icon: "🔵", className: "is-low" };
  return { value: 0, label: "بدون اولویت", icon: "⚪", className: "is-none" };
}
