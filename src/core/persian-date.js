import { toDateKey } from "./date.js";

export function formatPersianDate(value, timeZone = "Asia/Tehran") {
  const day = toDateKey(value, timeZone);
  if (!day) return "بدون تاریخ";
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric", month: "long", day: "numeric" }).format(new Date(`${day}T12:00:00Z`));
}
