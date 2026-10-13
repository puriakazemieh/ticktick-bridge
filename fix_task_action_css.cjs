const fs = require('fs');
let css = fs.readFileSync('styles.css', 'utf8');

css = css.replace(/\.ticktick-task-grid \.ticktick-task-card \.daily-task-action \{[\s\S]*?transition:.*?\n\s*\}/, '.ticktick-task-grid .ticktick-task-card .daily-task-action {\n  min-height: unset;\n  padding: 0;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  width: 1.35rem;\n  height: 1.35rem;\n  border: 1px solid color-mix(in srgb, var(--background-modifier-border) 65%, transparent);\n  border-radius: 50%;\n  color: var(--text-muted);\n  background: transparent;\n  cursor: pointer;\n  transition: all 150ms ease;\n}\n.ticktick-task-grid .ticktick-task-card .daily-task-action svg { width: 0.75rem; height: 0.75rem; }');

fs.writeFileSync('styles.css', css);
console.log('Action CSS updated');
