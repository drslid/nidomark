import './fixtures/psl';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { computeFeatures } from '../lib/features';
import { NAMES, namesFor } from '../lib/names';
import { words } from '../lib/text';
import { CATEGORIES, GROUPS, folderRole, isBackupTitle, localName } from '../lib/taxonomy';

const LOCALES = path.join(__dirname, '..', 'public', '_locales');
// Locale codes of the Chrome Web Store (developer.chrome.com/docs/extensions/reference/api/i18n#locales).
const CHROME_LOCALES = new Set('ar am bg bn ca cs da de el en en_AU en_GB en_US es es_419 et fa fi fil fr gu he hi hr hu id it ja kn ko lt lv ml mr ms nl no pl pt_BR pt_PT ro ru sk sl sr sv sw ta te th tr uk vi zh_CN zh_TW'.split(' '));
type Messages = Record<string, { message: string }>;
const load = (code: string): Messages => JSON.parse(readFileSync(path.join(LOCALES, code, 'messages.json'), 'utf8')) as Messages;
const codes = readdirSync(LOCALES).sort();
const en = load('en');
const placeholders = (s: string) => [...s.matchAll(/\{(\d)\}/g)].map((m) => m[1]).sort().join(',');
const FOLDER_KEYS = [...GROUPS.map((g) => `g:${g.id}`), ...CATEGORIES.map((c) => c.id), 'mine', 'review', 'special', 'untitled'];

describe('translations', () => {
  it('covers the most spoken languages, with codes Chrome knows', () => {
    for (const c of ['en', 'fr', 'es', 'it', 'de', 'pt_BR', 'pt_PT', 'ru', 'uk', 'pl', 'nl', 'tr', 'ar', 'hi', 'bn', 'id', 'vi', 'ja', 'ko', 'zh_CN', 'zh_TW']) expect(codes).toContain(c);
    for (const c of codes) expect(CHROME_LOCALES.has(c), c).toBe(true);
  });

  it.each(codes)('%s: every message, with the same substitutions as English', (code) => {
    const m = load(code);
    expect(Object.keys(m)).toEqual(Object.keys(en));
    for (const [key, { message }] of Object.entries(m)) {
      expect(message.trim(), `${code}.${key}`).not.toBe('');
      expect(placeholders(message), `${code}.${key}`).toBe(placeholders(en[key]?.message ?? ''));
    }
  });

  it.each(codes)('%s: names its language, fits the store and keeps its backups recognisable', (code) => {
    const m = load(code);
    expect(m.lang?.message).toBe(code.replace('_', '-'));
    expect(m.extShortName?.message).toBe('Nidomark');
    expect(m.extName?.message.startsWith('Nidomark')).toBe(true);
    expect(m.extName?.message.length ?? 0).toBeLessThanOrEqual(75);
    expect(m.extDescription?.message.length ?? 0).toBeLessThanOrEqual(132);
    const backup = m.backupTitle?.message ?? '';
    expect(backup.startsWith('Nidomark')).toBe(true);
    expect(isBackupTitle(backup.replace('{1}', '14/11/2026 15:38'))).toBe(true);
  });

  it.each(codes.filter((c) => c !== 'en'))('%s: is translated, not left in English', (code) => {
    const m = load(code);
    const same = Object.entries(m).filter(([k, { message }]) => k !== 'lang' && /\p{L}{4,}/u.test(message) && message.length > 12 && message === en[k]?.message);
    expect(same.map(([k]) => k)).toEqual([]);
  });
});

describe('text in every script', () => {
  it('keeps whole words, vowel signs included', () => {
    expect(words('खाना पकाने की विधि')).toEqual(['खाना', 'पकाने', 'की', 'विधि']);
    expect(words('রান্নার রেসিপি')).toEqual(['রান্নার', 'রেসিপি']);
    expect(words('Рецепты пирогов')).toEqual(['рецепты', 'пирогов']);
    expect(words('Crème brûlée')).toEqual(['creme', 'brulee']);
  });

  it('knows generic titles in other languages, and nothing else', () => {
    const vague = (title: string) => computeFeatures({ id: 'x', parentId: '2', index: 0, title, url: 'https://example.org/a/b', folderPath: [], inBar: false }).vagueTitle;
    expect(['Startseite', 'Главная', 'ホーム', '首页', 'होम', 'Página de inicio'].map(vague)).toEqual(Array(6).fill(true));
    expect(['हिम', 'Rezepte', 'Пироги'].map(vague)).toEqual([false, false, false]);
  });
});

describe('folder names', () => {
  it.each(Object.keys(NAMES))('%s: every group, category and special folder, short', (lang) => {
    const names = NAMES[lang] as Record<string, string>;
    expect(Object.keys(names).sort()).toEqual([...FOLDER_KEYS].sort());
    for (const [k, v] of Object.entries(names)) {
      expect(v.trim(), `${lang}.${k}`).toBe(v);
      expect(v.length, `${lang}.${k}`).toBeGreaterThan(0);
      expect(v.length, `${lang}.${k}`).toBeLessThanOrEqual(32);
    }
  });

  it('has a language of names for every translated interface', () => {
    for (const code of codes.filter((c) => c !== 'en' && c !== 'fr')) expect(namesFor(code.replace('_', '-')), code).toBeDefined();
  });

  it.each(Object.keys(NAMES))('%s: every name is recognised as its own folder', (lang) => {
    const names = NAMES[lang] as Record<string, string>;
    const wrong: string[] = [];
    for (const [key, name] of Object.entries(names)) {
      const role = folderRole(name);
      if (key.startsWith('g:')) {
        // A group may share its name with one of its categories, as "Travel" does in English.
        const group = key.slice(2);
        const ok = (role.kind === 'group' && role.group === group) || (role.kind === 'category' && CATEGORIES.find((c) => c.id === role.category)?.group === group);
        if (!ok) wrong.push(`${key} "${name}" → ${JSON.stringify(role)}`);
      } else if (key === 'review' || key === 'untitled') {
        if (role.kind !== 'catch-all') wrong.push(`${key} "${name}" → ${JSON.stringify(role)}`);
      } else if (key !== 'mine' && key !== 'special' && !(role.kind === 'category' && role.category === key)) wrong.push(`${key} "${name}" → ${JSON.stringify(role)}`);
    }
    expect(wrong).toEqual([]);
  });

  it('names folders in the language of the interface, and recognises them in any language', () => {
    const cooking = CATEGORIES.find((c) => c.id === 'cooking');
    if (!cooking) throw new Error('cooking');
    expect(localName(cooking, 'fr')).toBe('Cuisine');
    expect(localName(cooking, 'en-US')).toBe('Cooking');
    for (const lang of Object.keys(NAMES)) {
      const name = localName(cooking, lang);
      expect(folderRole(name), `${lang}: ${name}`).toEqual({ kind: 'category', category: 'cooking' });
    }
  });
});
