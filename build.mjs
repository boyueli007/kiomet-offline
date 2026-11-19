// Bundles the game into one self-contained HTML file (no server, no network).
import fs from 'fs';

const ROOT = new URL('.', import.meta.url).pathname;
const mods = ['data.js', 'geom.js', 'rules.js', 'glyphs.js', 'world.js', 'bot.js', 'render.js', 'app.js'];
const sources = {};
for (const m of mods) sources[m] = fs.readFileSync(ROOT + 'src/' + m, 'utf8');

// Concatenate modules, stripping import/export glue (all names are unique).
const order = mods;
let body = '';
for (const m of order) {
  let src = sources[m];
  src = src.replace(/^import\s+[^;]*?;\s*$/gm, '');
  src = src.replace(/^export\s+(const|let|var|function|class|async)\s/gm, '$1 ');
  src = src.replace(/^export\s*\{[^}]*\};?\s*$/gm, '');
  body += `\n// ---- ${m} ----\n` + src;
}

let html = fs.readFileSync(ROOT + 'index.html', 'utf8');
const boot = fs.readFileSync(ROOT + 'src/app.js', 'utf8');
html = html.replace(/<script type="module">[\s\S]*?<\/script>/, '');
html = html.replace('<script>\n// Fallback splash', '<script>\n"use strict";\n' + body +
  '\nwindow.kiomet = new App();\n\n// Fallback splash');
fs.writeFileSync(ROOT + 'kiomet.html', html);
console.log('kiomet.html', (html.length / 1024).toFixed(0) + 'KB');
