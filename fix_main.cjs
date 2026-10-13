const fs = require('fs');
let css = fs.readFileSync('styles.css', 'utf8');

css = css.replace(/\.ticktick-task-grid \.ticktick-task-card \.daily-task-main \{[\s\S]*?grid-column: 1 \/ 3;/, '.ticktick-task-grid .ticktick-task-card .daily-task-main {\n  grid-column: 2 / 4;');

fs.writeFileSync('styles.css', css);
console.log('main updated');
