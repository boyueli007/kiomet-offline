// Bundles the game into one self-contained HTML file (no server, no network).
// Every module is concatenated in dependency order; `import`/`export` glue is stripped
// because all top-level names are unique.
import fs from 'fs';

const ROOT = new URL('.', import.meta.url).pathname;
const mods = [
    'data.js', 'geom.js', 'towerindex.js', 'rules.js', 'glyphs.js',
    'fog.js', 'world.js', 'bot.js', 'render.js', 'effects.js', 'alerts.js', 'app.js',
];

let body = '';
for (const m of mods) {
    let src = fs.readFileSync(ROOT + 'src/' + m, 'utf8');
    src = src.replace(/^import\s+[^;]*?;\s*$/gm, '');
    src = src.replace(/^export\s+(const|let|var|function|class|async)\s/gm, '$1 ');
    src = src.replace(/^export\s*\{[^}]*\};?\s*$/gm, '');
    body += `\n// ---- ${m} ----\n` + src;
}

let html = fs.readFileSync(ROOT + 'index.html', 'utf8');
// Replace the module bootstrap (the only <script type="module"> in the page).
html = html.replace(/<script type="module">[\s\S]*?<\/script>/,
    '<script>\n"use strict";\n' + body + '\nwindow.kiomet = new App();\n</script>');
fs.writeFileSync(ROOT + 'kiomet.html', html);
console.log('kiomet.html', (html.length / 1024).toFixed(0) + 'KB');
