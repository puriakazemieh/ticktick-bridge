const fs = require('fs');
let css = fs.readFileSync('styles.css', 'utf8');

// Replace ticktick-task-cards grid-template-columns to match habits exactly
css = css.replace(/\.ticktick-task-grid \.ticktick-task-cards \{[\s\S]*?\}/, '.ticktick-task-grid .ticktick-task-cards {\n    display: grid;\n    grid-template-columns: repeat(auto-fit, minmax(min(100%, 10.8rem), 1fr));\n    gap: 0.45rem;\n  }');

// Replace ticktick-task-card
const cardRegex = /\.ticktick-task-grid \.ticktick-task-card \{[\s\S]*?padding: 0\.65rem 0\.85rem;\n\s*\}/;
const cardReplacement = .ticktick-task-grid .ticktick-task-card {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) 2.45rem;
    grid-template-rows: auto auto;
    align-items: center;
    gap: 0.1rem 0.3rem;
    min-height: 2.9rem;
    position: relative;
    padding: 0.4rem 0.2rem 0.4rem 0.5rem;
  };
css = css.replace(cardRegex, cardReplacement);

// Replace checkbox
const checkboxRegex = /\.ticktick-task-grid \.ticktick-task-card \.daily-task-checkbox \{[\s\S]*?border: 2px solid.*?\n\s*\}/;
const checkboxReplacement = .ticktick-task-grid .ticktick-task-card .daily-task-checkbox {
    appearance: none;
    -webkit-appearance: none;
    grid-column: 3;
    grid-row: 1 / 3;
    justify-self: center;
    width: 1.15rem;
    height: 1.15rem;
    margin: 0;
    border: 2px solid color-mix(in srgb, var(--interactive-accent) 65%, var(--background-modifier-border));
  };
css = css.replace(checkboxRegex, checkboxReplacement);

// Replace main (title)
const mainRegex = /\.ticktick-task-grid \.ticktick-task-card \.daily-task-main \{[\s\S]*?text-align: right;\n\s*\}/;
const mainReplacement = .ticktick-task-grid .ticktick-task-card .daily-task-main {
    grid-column: 1 / 3;
    grid-row: 1;
    text-align: right;
    min-width: 0;
  };
css = css.replace(mainRegex, mainReplacement);

// Replace title font size
css = css.replace(/font-size: 0\.88rem;/g, 'font-size: 0.76rem;');

// Replace date
const dateRegex = /\.ticktick-task-grid \.ticktick-task-card \.daily-task-date \{[\s\S]*?border-radius: 0\.3rem;\n\s*\}/;
const dateReplacement = .ticktick-task-grid .ticktick-task-card .daily-task-date {
    grid-column: 2;
    grid-row: 2;
    justify-self: end;
    width: fit-content;
    padding: 0.05rem 0.35rem;
    font-size: 0.6rem;
    color: var(--text-muted);
    background: transparent;
    border: none;
    border-radius: 0.3rem;
  };
css = css.replace(dateRegex, dateReplacement);

// Replace actions
const actionsRegex = /\.ticktick-task-grid \.ticktick-task-card \.daily-task-actions \{[\s\S]*?border-top: 1px solid.*?\n\s*\}/;
const actionsReplacement = .ticktick-task-grid .ticktick-task-card .daily-task-actions {
    grid-column: 1;
    grid-row: 2;
    display: flex;
    gap: 0.15rem;
    justify-content: flex-start;
    margin-top: 0;
    padding-top: 0;
    border-top: none;
  };
css = css.replace(actionsRegex, actionsReplacement);

// Replace action button
const actionBtnRegex = /\.ticktick-task-grid \.ticktick-task-card \.daily-task-action \{[\s\S]*?background: color-mix.*?\n\s*\}/;
const actionBtnReplacement = .ticktick-task-grid .ticktick-task-card .daily-task-action {
    min-height: unset;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.35rem;
    height: 1.35rem;
    border: 1px solid color-mix(in srgb, var(--background-modifier-border) 65%, transparent);
    border-radius: 50%;
    color: var(--text-muted);
    background: transparent;
  }\n  .ticktick-task-grid .ticktick-task-card .daily-task-action svg { width: 0.7rem; height: 0.7rem; };
css = css.replace(actionBtnRegex, actionBtnReplacement);

fs.writeFileSync('styles.css', css);
console.log('CSS updated');
