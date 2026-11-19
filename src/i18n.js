// SPDX-FileCopyrightText: 2026 Kiomet clone contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Translation layer. Every user-visible string lives in src/i18n/<lang>.js; the game code
// only ever calls t('some.key', {vars}). Key names are shared across languages, so a missing
// translation falls back to Chinese (the default language) instead of showing a raw key.
//
// Layout direction: a language may declare `dir: 'rtl'`. `applyDirection()` puts it on the
// <html> element, where the [dir="rtl"] rules in index.html mirror the absolute UI.

import zh from './i18n/zh.js';
import en from './i18n/en.js';
import ru from './i18n/ru.js';
import ar from './i18n/ar.js';
import ja from './i18n/ja.js';

// In the single-file build the bundler strips imports and rewrites `export default X` to
// `const __default_<module> = X`, which drops the original binding name. Resolve each
// dictionary at call time (not at module top level) so whichever form the build provides is
// the one that is picked up, and a temporal-dead-zone read can't happen.
const GLOBAL = typeof globalThis !== 'undefined' ? globalThis : {};
function raw(...names) {
    for (const n of names) {
        try {
            // eslint-disable-next-line no-eval
            const v = (0, eval)(n);
            if (v) return v;
        } catch { /* not defined in this build: try the next spelling */ }
    }
    return null;
}

export const LANGUAGES = [
    { code: 'zh', dict: () => raw('zh', '__default_i18n_zh_js') },
    { code: 'en', dict: () => raw('en', '__default_i18n_en_js') },
    { code: 'ja', dict: () => raw('ja', '__default_i18n_ja_js') },
    { code: 'ru', dict: () => raw('ru', '__default_i18n_ru_js') },
    { code: 'ar', dict: () => raw('ar', '__default_i18n_ar_js') },
];

export const DEFAULT_LANG = 'zh';
const STORAGE_KEY = 'kiomet-lang';

// Flat lookup: code -> dictionary, memoised on first use so the bundler's naming differences
// are resolved lazily rather than at module-evaluation time.
const resolved = new Map();
function dictFor(code) {
    if (resolved.has(code)) return resolved.get(code);
    const entry = LANGUAGES.find((l) => l.code === code);
    const d = entry ? entry.dict() : null;
    if (d) resolved.set(code, d);
    return d;
}

function baseDict() {
    return dictFor(DEFAULT_LANG) || {};
}

let currentCode = DEFAULT_LANG;
let currentDict = dictFor(DEFAULT_LANG);

// BCP-47 tags used for <html lang> and for the picker's aria label.
export function metaOf(code) {
    const d = dictFor(code) || baseDict();
    return d.meta || baseDict().meta;
}

export function langCodes() {
    return LANGUAGES.map((l) => l.code);
}

export function currentLang() {
    return currentCode;
}

// Alias used by the UI picker (kept separate from the storage helpers below).
export function langCode() {
    return currentCode;
}

// Remember a choice for next visit. Kept here so there is exactly one place that writes it.
export function storedLang() {
    try {
        const v = localStorage.getItem(STORAGE_KEY);
        return v && dictFor(v) ? v : null;
    } catch {
        return null;
    }
}

export function resolveLang() {
    return storedLang() || DEFAULT_LANG;
}

export function setLang(code) {
    if (!dictFor(code)) code = DEFAULT_LANG;
    currentCode = code;
    currentDict = dictFor(code);
    try { localStorage.setItem(STORAGE_KEY, code); } catch { /* private mode: keep in memory */ }
    applyDirection();
    return currentDict;
}

// Right-to-left languages flip the whole shell.
export function applyDirection() {
    const meta = (currentDict || baseDict()).meta || { dir: 'ltr' };
    if (typeof document === 'undefined') return meta;
    const html = document.documentElement;
    html.setAttribute('lang', meta.htmlLang || currentCode);
    html.setAttribute('dir', meta.dir || 'ltr');
    // Some fonts need an explicit family for a script the default stack lacks.
    if (meta.font) html.style.setProperty('--ui-font', meta.font);
    else html.style.removeProperty('--ui-font');
    return meta;
}

export function isRtl() {
    return (((currentDict || baseDict()).meta || {}).dir || 'ltr') === 'rtl';
}

// {name} placeholders are replaced; unknown placeholders are left alone on purpose so a typo
// shows up in the UI instead of silently rendering "undefined".
export function t(key, vars) {
    const dict = currentDict || baseDict();
    let s = dict[key];
    if (s == null) s = baseDict()[key];
    if (s == null) return key;
    if (!vars) return s;
    return String(s).replace(/\{(\w+)\}/g, (m, name) => (vars[name] != null ? String(vars[name]) : m));
}

// Tower/unit display names. `ident` is the identifier used by data.js (e.g. 'Headquarters').
export function tName(kind, ident) {
    if (ident == null) return '';
    return t(`${kind}.${ident}`);
}

// Rough plural: English/Japanese/Chinese/Arabic all read fine with the singular form for the
// counts used here, and Russian needs the genitive-plural trick for "1 vs many" only in a
// couple of places, both of which use a fixed phrase instead. Kept as a helper so future
// languages can override it without touching call sites.
export function plural(n, one, many) {
    return Number(n) === 1 ? one : many;
}
