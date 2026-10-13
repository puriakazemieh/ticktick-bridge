const fs = require('fs');
let css = fs.readFileSync('styles.css', 'utf8');

css = css.replace(/\.ticktick-task-grid \.ticktick-task-cards \{[\s\S]*?\}/, '.ticktick-task-grid .ticktick-task-cards {\n  display: grid;\n  grid-template-columns: repeat(auto-fit, minmax(min(100%, 10.8rem), 1fr));\n  gap: 0.45rem;\n}');

css = css.replace(/\.ticktick-task-grid \.ticktick-task-card \{[\s\S]*?padding: 0\.65rem 0\.85rem;\n\s*\}/, '.ticktick-task-grid .ticktick-task-card {\n  display: grid;\n  grid-template-columns: auto minmax(0, 1fr) 2.45rem;\n  grid-template-rows: auto auto;\n  align-items: center;\n  gap: 0.1rem 0.3rem;\n  min-height: 2.9rem;\n  position: relative;\n  padding: 0.4rem 0.2rem 0.4rem 0.5rem;\n}');

css = css.replace(/\.ticktick-task-grid \.ticktick-task-card \.daily-task-checkbox \{[\s\S]*?border: 2px solid.*?\n\s*\}/, '.ticktick-task-grid .ticktick-task-card .daily-task-checkbox {\n  appearance: none;\n  -webkit-appearance: none;\n  grid-column: 3;\n  grid-row: 1 / 3;\n  justify-self: center;\n  width: 1.15rem;\n  height: 1.15rem;\n  margin: 0;\n  border: 2px solid color-mix(in srgb, var(--interactive-accent) 65%, var(--background-modifier-border));\n}');

css = css.replace(/\.ticktick-task-grid \.ticktick-task-card \.daily-task-main \{[\s\S]*?text-align: right;\n\s*\}/, '.ticktick-task-grid .ticktick-task-card .daily-task-main {\n  grid-column: 1 / 3;\n  grid-row: 1;\n  text-align: right;\n  min-width: 0;\n}');

css = css.replace(/font-size: 0\.88rem;/g, 'font-size: 0.76rem;');

css = css.replace(/\.ticktick-task-grid \.ticktick-task-card \.daily-task-date \{[\s\S]*?border-radius: 0\.3rem;\n\s*\}/, '.ticktick-task-grid .ticktick-task-card .daily-task-date {\n  grid-column: 2;\n  grid-row: 2;\n  justify-self: end;\n  width: fit-content;\n  padding: 0.05rem 0.35rem;\n  font-size: 0.6rem;\n  color: var(--text-muted);\n  background: transparent;\n  border: none;\n  border-radius: 0.3rem;\n}');

css = css.replace(/\.ticktick-task-grid \.ticktick-task-card \.daily-task-actions \{[\s\S]*?border-top: 1px solid.*?\n\s*\}/, '.ticktick-task-grid .ticktick-task-card .daily-task-actions {\n  grid-column: 1;\n  grid-row: 2;\n  display: flex;\n  gap: 0.15rem;\n  justify-content: flex-start;\n  margin-top: 0;\n  padding-top: 0;\n  border-top: none;\n}');

css = css.replace(/\.ticktick-task-grid \.ticktick-task-card \.daily-task-action \{[\s\S]*?background: color-mix.*?\n\s*\}/, '.ticktick-task-grid .ticktick-task-card .daily-task-action {\n  min-height: unset;\n  padding: 0;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  width: 1.35rem;\n  height: 1.35rem;\n  border: 1px solid color-mix(in srgb, var(--background-modifier-border) 65%, transparent);\n  border-radius: 50%;\n  color: var(--text-muted);\n  background: transparent;\n}\n.ticktick-task-grid .ticktick-task-card .daily-task-action svg { width: 0.7rem; height: 0.7rem; }');

fs.writeFileSync('styles.css', css);
console.log('CSS updated successfully');
