import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLaunchParams, shareToContent } from '../src/pwa/launch.js';
import { detectIOS, detectIOSBrowser, detectIPad, isStandalone } from '../src/pwa/installPrompt.js';
import { formatBytes, getStorageStatus, requestPersistence } from '../src/pwa/storage.js';

test('launch params: shortcuts and share target', () => {
  assert.deepEqual(parseLaunchParams('?action=search'), { action: 'search', share: null });
  assert.equal(parseLaunchParams('?action=hack').action, null);
  const p = parseLaunchParams('?title=Hi&text=Line1%0ALine2&url=https%3A%2F%2Fx.test');
  assert.deepEqual(p.share, { title: 'Hi', text: 'Line1\nLine2', url: 'https://x.test' });
  const c = shareToContent(p.share);
  assert.equal(c.title, 'Hi');
  assert.equal(c.content.length, 3);
  assert.equal(c.content[2].content[0].text, 'https://x.test');
  assert.deepEqual(parseLaunchParams(''), { action: null, share: null });
});
test('share content never injects markup (plain text nodes only)', () => {
  const c = shareToContent({ title: '', text: '<img src=x onerror=1>', url: '' });
  assert.equal(c.content[0].content[0].text, '<img src=x onerror=1>');
  assert.equal(c.content[0].type, 'paragraph');
});
test('iOS detection and standalone', () => {
  assert.equal(detectIOS('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)', 'iPhone', 5), true);
  assert.equal(detectIOS('Mozilla/5.0 (Macintosh)', 'MacIntel', 5), true); // iPadOS reports as Mac
  assert.equal(detectIOS('Mozilla/5.0 (Windows NT 10.0)', 'Win32', 0), false);
  assert.equal(isStandalone({ matchMedia: () => ({ matches: true }), navigator: {} }), true);
  assert.equal(isStandalone({ matchMedia: () => ({ matches: false }), navigator: { standalone: true } }), true);
  assert.equal(isStandalone({ matchMedia: () => ({ matches: false }), navigator: {} }), false);
});
test('storage helpers', async () => {
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(1536), '1.5 KB');
  assert.equal(formatBytes(5 * 1024 * 1024), '5.0 MB');
  assert.deepEqual(await getStorageStatus({}), { supported: false, persisted: false, usage: 0, quota: 0 });
  const nav = { storage: { persisted: async () => false, persist: async () => true, estimate: async () => ({ usage: 10, quota: 100 }) } };
  assert.equal(await requestPersistence(nav), true);
  assert.deepEqual(await getStorageStatus(nav), { supported: true, persisted: false, usage: 10, quota: 100 });
  assert.equal(await requestPersistence({}), false);
});

test('iOS browser detection picks the right install guidance', () => {
  const safari = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
  const chrome = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/118.0 Mobile/15E148 Safari/604.1';
  const insta = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 300.0';
  const webview = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';
  assert.equal(detectIOSBrowser(safari), 'safari');
  assert.equal(detectIOSBrowser(chrome), 'chrome');
  assert.equal(detectIOSBrowser('... FxiOS/120 Mobile/15E148 Safari/605.1.15'), 'firefox');
  assert.equal(detectIOSBrowser('... EdgiOS/120 Mobile/15E148 Safari/605.1.15'), 'edge');
  assert.equal(detectIOSBrowser(insta), 'inapp');
  assert.equal(detectIOSBrowser(webview), 'inapp');
  assert.equal(detectIPad('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/17 Safari/605.1.15', 'MacIntel', 5), true);
  assert.equal(detectIPad(safari, 'iPhone', 5), false);
});
