const fs = require('fs');
let css = fs.readFileSync('styles.css', 'utf8');

css = css.replace(/\.ticktick-task-grid\s+\.ticktick-task-card\s*\{[\s\S]*?padding:\s*0\.65rem\s+0\.85rem;/, '.ticktick-task-grid .ticktick-task-card {\n  display: grid;\n  grid-template-columns: auto minmax(0, 1fr) 2.45rem;\n  grid-template-rows: auto auto;\n  align-items: center;\n  gap: 0.1rem 0.3rem;\n  min-height: 2.9rem;\n  position: relative;\n  padding: 0.4rem 0.2rem 0.4rem 0.5rem;');

css = css.replace(/\.ticktick-task-grid\s+\.ticktick-task-card\s+\.daily-task-checkbox\s*\{[\s\S]*?grid-row:\s*1;/, '.ticktick-task-grid .ticktick-task-card .daily-task-checkbox {\n  appearance: none;\n  -webkit-appearance: none;\n  grid-column: 3;\n  grid-row: 1 / 3;\n  align-self: center;\n  justify-self: center;');

css = css.replace(/\.ticktick-task-grid\s+\.ticktick-task-card\s+\.daily-task-date\s*\{[\s\S]*?font-size:\s*0\.65rem;/, '.ticktick-task-grid .ticktick-task-card .daily-task-date {\n  grid-column: 2;\n  grid-row: 2;\n  justify-self: end;\n  width: fit-content;\n  padding: 0.05rem 0.35rem;\n  color: var(--text-muted);\n  background: transparent;\n  border: none;\n  border-radius: 0.3rem;\n  font-size: 0.6rem;');

css = css.replace(/\.ticktick-task-grid\s+\.ticktick-task-cards\s*\{[\s\S]*?gap:\s*0\.72rem;\n\s*\}/, '.ticktick-task-grid .ticktick-task-cards {\n  display: grid;\n  grid-template-columns: repeat(auto-fit, minmax(min(100%, 10.8rem), 1fr));\n  gap: 0.45rem;\n}');

fs.writeFileSync('styles.css', css);
console.log('done replacing with flexible regex');
