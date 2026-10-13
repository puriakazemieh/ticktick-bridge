const fs = require('fs');
let ts = fs.readFileSync('src/obsidian/main.ts', 'utf8');

const target = const repeatDays = parseRecurringDays(task.repeatFlag);
            if (repeatDays) meta.createDiv({ cls: "ticktick-recurring-days", text: repeatDays });
            
            const due = toDateKey(task.dueDate, task.timeZone || this.settings.timeZone);
            const start = toDateKey(task.startDate, task.timeZone || this.settings.timeZone);;

const replacement = const due = toDateKey(task.dueDate, task.timeZone || this.settings.timeZone);
            const start = toDateKey(task.startDate, task.timeZone || this.settings.timeZone);
            const repeatDays = parseRecurringDays(task.repeatFlag, due || start || "");
            if (repeatDays) meta.createDiv({ cls: "ticktick-recurring-days", text: repeatDays });;

ts = ts.replace(target, replacement);

fs.writeFileSync('src/obsidian/main.ts', ts);
console.log('done');
