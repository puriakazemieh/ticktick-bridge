const fs = require('fs');
let css = fs.readFileSync('styles.css', 'utf8');

const replacements = [
  {
    find: .ticktick-task-grid .ticktick-task-card {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    grid-template-rows: auto auto auto auto;
    align-items: center;
    gap: 0.4rem 0.55rem;
    min-height: 4.2rem;
    position: relative;
    padding: 0.65rem 0.85rem;,
    replace: .ticktick-task-grid .ticktick-task-card {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto 2.45rem;
    grid-template-rows: auto auto;
    align-items: center;
    gap: 0.1rem 0.3rem;
    min-height: 2.9rem;
    position: relative;
    padding: 0.4rem 0.2rem 0.4rem 0.5rem;
  },
  {
    find: .ticktick-task-grid .ticktick-task-card .daily-task-checkbox {
    appearance: none;
    -webkit-appearance: none;
    grid-column: 1;
    grid-row: 1;,
    replace: .ticktick-task-grid .ticktick-task-card .daily-task-checkbox {
    appearance: none;
    -webkit-appearance: none;
    grid-column: 3;
    grid-row: 1 / 3;
    align-self: center;
    justify-self: center;
  },
  {
    find: .ticktick-task-grid .ticktick-task-card .daily-task-date {
    grid-column: 1 / -1;
    grid-row: 2;
    justify-self: end;
    width: fit-content;
    padding: 0.2rem 0.55rem;
    color: var(--text-muted);
    background: color-mix(in srgb, var(--background-primary-alt) 85%, var(--interactive-accent));
    border: 1px solid color-mix(in srgb, var(--interactive-accent) 12%, var(--background-modifier-border));
    border-radius: 999px;
    font-size: 0.65rem;,
    replace: .ticktick-task-grid .ticktick-task-card .daily-task-date {
    grid-column: 2;
    grid-row: 2;
    justify-self: end;
    width: fit-content;
    padding: 0.05rem 0.35rem;
    color: var(--text-muted);
    background: transparent;
    border: none;
    border-radius: 0.3rem;
    font-size: 0.6rem;
  }
];

let replaced = 0;
for (const r of replacements) {
  if (css.includes(r.find)) {
    css = css.replace(r.find, r.replace);
    replaced++;
  } else {
    console.log('Failed to find block:\n' + r.find);
  }
}

fs.writeFileSync('styles.css', css);
console.log('Replaced ' + replaced + ' blocks.');
