import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { THEMES, DEFAULT_THEME } from '../src/theme/themeList.js';

const dir = path.dirname(fileURLToPath(import.meta.url));
const themesCss = readFileSync(path.join(dir, '../src/theme/themes.css'), 'utf8');
const switcherCss = readFileSync(
  path.join(dir, '../src/components/ThemeSwitcher.module.css'),
  'utf8'
);

test('every theme has a token block in themes.css', () => {
  for (const { id } of THEMES) {
    const pattern = new RegExp(`:root\\[data-theme=['"]${id}['"]\\]`);
    assert.ok(pattern.test(themesCss), `themes.css is missing a block for "${id}"`);
  }
});

test('every theme token block defines the full expected token set', () => {
  const requiredTokens = [
    '--cover-base',
    '--cover-highlight',
    '--cover-shadow',
    '--paper-base',
    '--paper-shadow',
    '--metal-light',
    '--metal-base',
    '--metal-dark',
    '--ink-primary',
    '--ink-secondary',
    '--backdrop',
  ];

  for (const { id } of THEMES) {
    const blockMatch = themesCss.match(
      new RegExp(`:root\\[data-theme=['"]${id}['"]\\]\\s*{([^}]*)}`)
    );
    assert.ok(blockMatch, `could not locate the ${id} block body`);
    const body = blockMatch[1];
    for (const token of requiredTokens) {
      assert.ok(body.includes(token), `${id} is missing ${token}`);
    }
  }
});

test('every theme has a static preview swatch in ThemeSwitcher.module.css', () => {
  for (const { id } of THEMES) {
    const pattern = new RegExp(`\\[data-theme-preview=['"]${id}['"]\\]`);
    assert.ok(pattern.test(switcherCss), `ThemeSwitcher.module.css has no preview for "${id}"`);
  }
});

test('DEFAULT_THEME is one of the declared themes', () => {
  assert.ok(THEMES.some((t) => t.id === DEFAULT_THEME));
});
