const fs = require('fs');
let css = fs.readFileSync('styles.css', 'utf8');

css = css.replace('.ticktick-task-grid .ticktick-task-card {\n    display: grid;\n    grid-template-columns: auto minmax(0, 1fr);\n    grid-template-rows: auto auto auto auto;\n    align-items: center;\n    gap: 0.4rem 0.55rem;\n    min-height: 4.2rem;\n    position: relative;\n    padding: 0.65rem 0.85rem;', '.ticktick-task-grid .ticktick-task-card {\n    display: grid;\n    grid-template-columns: auto minmax(0, 1fr) 2.45rem;\n    grid-template-rows: auto auto;\n    align-items: center;\n    gap: 0.1rem 0.3rem;\n    min-height: 2.9rem;\n    position: relative;\n    padding: 0.4rem 0.2rem 0.4rem 0.5rem;');

css = css.replace('.ticktick-task-grid .ticktick-task-card .daily-task-checkbox {\n    appearance: none;\n    -webkit-appearance: none;\n    grid-column: 1;\n    grid-row: 1;', '.ticktick-task-grid .ticktick-task-card .daily-task-checkbox {\n    appearance: none;\n    -webkit-appearance: none;\n    grid-column: 3;\n    grid-row: 1 / 3;\n    align-self: center;\n    justify-self: center;');

css = css.replace('.ticktick-task-grid .ticktick-task-card .daily-task-date {\n    grid-column: 1 / -1;\n    grid-row: 2;\n    justify-self: end;\n    width: fit-content;\n    padding: 0.2rem 0.55rem;\n    color: var(--text-muted);\n    background: color-mix(in srgb, var(--background-primary-alt) 85%, var(--interactive-accent));\n    border: 1px solid color-mix(in srgb, var(--interactive-accent) 12%, var(--background-modifier-border));\n    border-radius: 999px;\n    font-size: 0.65rem;', '.ticktick-task-grid .ticktick-task-card .daily-task-date {\n    grid-column: 2;\n    grid-row: 2;\n    justify-self: end;\n    width: fit-content;\n    padding: 0.05rem 0.35rem;\n    color: var(--text-muted);\n    background: transparent;\n    border: none;\n    border-radius: 0.3rem;\n    font-size: 0.6rem;');

css = css.replace('.ticktick-task-grid .ticktick-task-cards {\n    display: grid;\n    grid-template-columns: repeat(auto-fit, minmax(min(100%, 11rem), 1fr));\n    gap: 0.72rem;\n  }', '.ticktick-task-grid .ticktick-task-cards {\n    display: grid;\n    grid-template-columns: repeat(auto-fit, minmax(min(100%, 10.8rem), 1fr));\n    gap: 0.45rem;\n  }');

fs.writeFileSync('styles.css', css);
console.log('done');
