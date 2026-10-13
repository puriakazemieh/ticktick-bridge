const fs = require('fs');
let css = fs.readFileSync('styles.css', 'utf8');

// Update ticktick-task-card
css = css.replace(/grid-template-columns: auto minmax\(0, 1fr\) 2\.45rem;/, 'grid-template-columns: 2.45rem minmax(0, 1fr) auto;');

// Checkbox to Col 1
css = css.replace(/\.ticktick-task-grid \.ticktick-task-card \.daily-task-checkbox \{[\s\S]*?grid-column: 3;/, '.ticktick-task-grid .ticktick-task-card .daily-task-checkbox {\n  appearance: none;\n  -webkit-appearance: none;\n  grid-column: 1;');

// Date to Col 2 (stay in Col 2, but justify-self: start since it's RTL and we want it on the left of the title space? No, let's keep it near the actions or title)
// Actually, in RTL, justify-self: start means Right side. justify-self: end means Left side.
// The date should probably be on the left, next to the actions. 
// So date is Col 2, justify-self: end; (which is Left)
// Actions to Col 3 (Left)
css = css.replace(/\.ticktick-task-grid \.ticktick-task-card \.daily-task-actions \{[\s\S]*?grid-column: 1;/, '.ticktick-task-grid .ticktick-task-card .daily-task-actions {\n  grid-column: 3;');

fs.writeFileSync('styles.css', css);
console.log('Grid updated');
