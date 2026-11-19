// Bundles the game into one self-contained HTML file (no server, no network).
// Every module is concatenated in dependency order; `import`/`export` glue is stripped
// because all top-level names are unique.
import fs from 'fs';
import { fileURLToPath } from 'url';

// fileURLToPath (not `URL.pathname`) so Windows paths don't gain a leading slash ("/D:/...").
const ROOT = fileURLToPath(new URL('.', import.meta.url));
const mods = [
    'data.js', 'geom.js', 'towerindex.js', 'rules.js', 'glyphs.js',
    'fog.js', 'world.js', 'bot.js', 'render.js', 'effects.js', 'alerts.js',
    // Translation dictionaries first, then the lookup layer that binds them together.
    'i18n/zh.js', 'i18n/en.js', 'i18n/ja.js', 'i18n/ru.js', 'i18n/ar.js', 'i18n.js',
    'app.js',
];

let body = '';
for (const m of mods) {
    let src = fs.readFileSync(ROOT + 'src/' + m, 'utf8');
    // Strip module glue. Multi-line imports need the `m` flag on `^...$` (without it the
    // pattern only matches single-line imports and a leftover `import {` breaks the bundle).
    src = src.replace(/^import\s+[\s\S]*?from\s+['"][^'"]+['"];?[ \t]*$/gm, '');
    src = src.replace(/^import\s+['"][^'"]+['"];?[ \t]*$/gm, '');
    src = src.replace(/^export\s+default\s+/gm, 'const __default_' + m.replace(/[^a-z0-9]/gi, '_') + ' = ');
    src = src.replace(/^export\s+(const|let|var|function|class|async)\s/gm, '$1 ');
    src = src.replace(/^export\s*\{[^}]*\};?\s*$/gm, '');
    src = src.replace(/^export\s*\{[^}]*\}/gm, '');
    body += `\n// ---- ${m} ----\n` + src;
}

// A left-over module keyword means the bundle would throw a SyntaxError at load time.
const leftover = body.match(/^(import|export)\b.*$/gm);
if (leftover) {
    throw new Error('build: module syntax survived stripping:\n' + leftover.join('\n'));
}

let html = fs.readFileSync(ROOT + 'index.html', 'utf8');
// Replace the module bootstrap (the only <script type="module"> in the page).
html = html.replace(/<script type="module">[\s\S]*?<\/script>/,
    '<script>\n"use strict";\n' + body + '\nwindow.kiomet = new App();\n</script>');
fs.writeFileSync(ROOT + 'kiomet.html', html);
console.log('kiomet.html', (html.length / 1024).toFixed(0) + 'KB');
