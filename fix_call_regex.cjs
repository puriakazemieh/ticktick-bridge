const fs = require('fs');
let ts = fs.readFileSync('src/obsidian/main.ts', 'utf8');

ts = ts.replace(/const repeatDays = parseRecurringDays\(task\.repeatFlag\);\s*if \(repeatDays\) meta\.createDiv\(\{ cls: "ticktick-recurring-days", text: repeatDays \}\);\s*const due = toDateKey\(task\.dueDate, task\.timeZone \|\| this\.settings\.timeZone\);\s*const start = toDateKey\(task\.startDate, task\.timeZone \|\| this\.settings\.timeZone\);/,
'const due = toDateKey(task.dueDate, task.timeZone || this.settings.timeZone);\n            const start = toDateKey(task.startDate, task.timeZone || this.settings.timeZone);\n            const repeatDays = parseRecurringDays(task.repeatFlag, due || start || "");\n            if (repeatDays) meta.createDiv({ cls: "ticktick-recurring-days", text: repeatDays });');

fs.writeFileSync('src/obsidian/main.ts', ts);
console.log('done regex replace');
