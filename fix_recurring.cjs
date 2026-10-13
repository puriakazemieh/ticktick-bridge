const fs = require('fs');
let ts = fs.readFileSync('src/obsidian/main.ts', 'utf8');

// Replace the parseRecurringDays function entirely
const oldFunc = /function parseRecurringDays\(repeatFlag: unknown\): string \{[\s\S]*?return days\.map\(d => map\[d\]\)\.join\('، '\);\n\}/;

const newFunc = unction parseRecurringDays(repeatFlag: unknown, dateKey?: string): string {
  const rule = String(repeatFlag ?? "").toUpperCase();
  const match = rule.match(/BYDAY=([^;]+)/);
  const map: Record<string, string> = { "SA": "شنبه", "SU": "یکشنبه", "MO": "دوشنبه", "TU": "سه‌شنبه", "WE": "چهارشنبه", "TH": "پنج‌شنبه", "FR": "جمعه" };
  const order = ["SA", "SU", "MO", "TU", "WE", "TH", "FR"];
  const jsDayMap = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

  let days: string[] = [];
  if (match) {
    days = match[1].split(",");
  } else if (rule.includes("FREQ=WEEKLY") && dateKey) {
    const d = new Date(dateKey + "T12:00:00");
    if (!Number.isNaN(d.getTime())) {
      days = [jsDayMap[d.getDay()]];
    }
  }

  if (days.length > 0) {
    days.sort((a, b) => order.indexOf(a) - order.indexOf(b));
    if (days.length === 7) return "هر روز";
    const mapped = days.map(d => map[d]).filter(Boolean);
    if (days.length >= 2 && days.join(",") === order.slice(order.indexOf(days[0]), order.indexOf(days[0]) + days.length).join(",")) {
      return \از \ تا \\;
    }
    return mapped.map(d => d + "‌ها").join("، ");
  }

  if (rule.includes("FREQ=DAILY")) return "هر روز";
  if (rule.includes("FREQ=WEEKLY")) return "هر هفته";
  if (rule.includes("FREQ=MONTHLY")) return "ماهانه";
  if (rule.includes("FREQ=YEARLY")) return "سالانه";
  return "";
};

ts = ts.replace(oldFunc, newFunc);

// Reorder lines in the loop
const oldLines = const repeatDays = parseRecurringDays(task.repeatFlag);
            if (repeatDays) meta.createDiv({ cls: "ticktick-recurring-days", text: repeatDays });
            
            const due = toDateKey(task.dueDate, task.timeZone || this.settings.timeZone);
            const start = toDateKey(task.startDate, task.timeZone || this.settings.timeZone);;

const newLines = const due = toDateKey(task.dueDate, task.timeZone || this.settings.timeZone);
            const start = toDateKey(task.startDate, task.timeZone || this.settings.timeZone);
            const repeatDays = parseRecurringDays(task.repeatFlag, due || start || "");
            if (repeatDays) meta.createDiv({ cls: "ticktick-recurring-days", text: repeatDays });;

ts = ts.replace(oldLines, newLines);

fs.writeFileSync('src/obsidian/main.ts', ts);
console.log('Main TS updated');
