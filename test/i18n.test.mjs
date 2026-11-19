// SPDX-FileCopyrightText: 2026 Kiomet clone contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Translation coverage check: every language must define the same keys as the default
// (Chinese) dictionary, with the same `{placeholders}` in each string. Missing keys would
// silently fall back to Chinese, so this turns that into a test failure.
//
//   node test/i18n.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import zh from '../src/i18n/zh.js';
import en from '../src/i18n/en.js';
import ja from '../src/i18n/ja.js';
import ru from '../src/i18n/ru.js';
import ar from '../src/i18n/ar.js';

const DICTS = { zh, en, ja, ru, ar };
const BASE = 'zh';

const placeholders = (s) => {
    const out = new Set();
    for (const m of String(s).matchAll(/\{(\w+)\}/g)) out.add(m[1]);
    return [...out].sort();
};

const contentKeys = (d) => Object.keys(d).filter((k) => k !== 'meta');

test('every language defines the same keys as Chinese', () => {
    const base = new Set(contentKeys(zh));
    for (const [code, dict] of Object.entries(DICTS)) {
        if (code === BASE) continue;
        const keys = new Set(contentKeys(dict));
        const missing = [...base].filter((k) => !keys.has(k));
        const extra = [...keys].filter((k) => !base.has(k));
        assert.deepEqual(missing, [], `${code}: missing keys`);
        assert.deepEqual(extra, [], `${code}: keys not present in ${BASE}`);
    }
});

test('translations keep the placeholders their template uses', () => {
    for (const [code, dict] of Object.entries(DICTS)) {
        if (code === BASE) continue;
        for (const k of contentKeys(zh)) {
            assert.deepEqual(placeholders(dict[k]), placeholders(zh[k]),
                `${code}: placeholder mismatch in "${k}"`);
        }
    }
});

test('no string is empty and metadata is complete', () => {
    for (const [code, dict] of Object.entries(DICTS)) {
        assert.ok(dict.meta && dict.meta.name, `${code}: meta.name`);
        assert.ok(['ltr', 'rtl'].includes(dict.meta.dir), `${code}: meta.dir`);
        assert.ok(dict.meta.htmlLang, `${code}: meta.htmlLang`);
        for (const k of contentKeys(dict)) {
            assert.ok(String(dict[k]).trim().length > 0, `${code}: "${k}" is empty`);
        }
    }
});

test('Arabic is right-to-left and the rest are not', () => {
    assert.equal(ar.meta.dir, 'rtl');
    for (const code of ['zh', 'en', 'ja', 'ru']) assert.equal(DICTS[code].meta.dir, 'ltr');
});

test('tower and unit names are translated for every entry in the game data', async () => {
    const { TOWERS, UNITS } = await import('../src/data.js');
    for (const [code, dict] of Object.entries(DICTS)) {
        for (const tw of TOWERS) assert.ok(dict[`tower.${tw.name}`], `${code}: tower.${tw.name}`);
        for (const u of UNITS) assert.ok(dict[`unit.${u.name}`], `${code}: unit.${u.name}`);
    }
});
