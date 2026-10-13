const fs = require('fs');
let css = fs.readFileSync('styles.css', 'utf8');

css = css.replace(/justify-self: center;\n  width: 1\.15rem;/, 'justify-self: center;\n  align-self: center;\n  width: 1.15rem;');

fs.writeFileSync('styles.css', css);
console.log('Fixed checkbox align');
