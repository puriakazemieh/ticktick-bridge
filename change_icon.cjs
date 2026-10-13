const fs = require('fs');
let ts = fs.readFileSync('src/obsidian/main.ts', 'utf8');

ts = ts.replace(/this\.addRibbonIcon\("refresh-cw"/g, 'this.addRibbonIcon("arrow-down-up"');
ts = ts.replace(/setIcon\(this\.syncRibbonIcon, syncing \? "loader-circle" : "refresh-cw"\);/g, 'setIcon(this.syncRibbonIcon, syncing ? "loader-circle" : "arrow-down-up");');
ts = ts.replace(/\.setIcon\("refresh-cw"\)\.onClick/g, '.setIcon("arrow-down-up").onClick');

fs.writeFileSync('src/obsidian/main.ts', ts);
console.log('Icon replaced');
