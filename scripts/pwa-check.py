# Real-browser PWA verification (vite preview on :4180): manifest, installability (CDP), service worker,
# offline use, app shortcuts, share target. Usage: python3 scripts/pwa-check.py
import os, time, json, urllib.request
from playwright.sync_api import sync_playwright
BASE = os.environ.get('BASE', 'http://127.0.0.1:4180/')
PW = 'correct horse battery'
ok = True
def check(name, cond, extra=''):
    global ok
    print(('PASS ' if cond else 'FAIL ') + name + (f'  [{extra}]' if extra else '')); ok = ok and bool(cond)
def unlock(pg):
    pg.wait_for_selector('input[type=password]')
    ins = pg.locator('input[type=password]')
    for i in range(ins.count()): ins.nth(i).fill(PW)
    pg.keyboard.press('Enter'); pg.wait_for_selector('.ProseMirror'); time.sleep(.8)

# --- manifest sanity (static)
m = json.load(urllib.request.urlopen(BASE + 'manifest.webmanifest'))
check('manifest id/scope/start_url', m.get('id') == '/' and m.get('scope') == '/' and m.get('start_url') == '/')
purposes = {(i['sizes'], i.get('purpose')) for i in m['icons']}
check('icons 192+512 any and maskable', {('192x192', 'any'), ('512x512', 'any'), ('192x192', 'maskable'), ('512x512', 'maskable')} <= purposes)
check('shortcuts + share_target', len(m.get('shortcuts', [])) >= 3 and m.get('share_target', {}).get('action') == '/')
shots_ok = all(urllib.request.urlopen(BASE + s['src'].lstrip('/')).status == 200 for s in m.get('screenshots', []))
check('screenshots reachable (wide + narrow)', shots_ok and {s['form_factor'] for s in m['screenshots']} == {'wide', 'narrow'})
for i in m['icons']:
    assert urllib.request.urlopen(BASE + i['src'].lstrip('/')).status == 200

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 1280, 'height': 800}); pg = ctx.new_page(); pg.set_default_timeout(12000)
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(BASE); pg.wait_for_selector('input[type=password]')
    reg = pg.evaluate("navigator.serviceWorker.ready.then(r => !!r.active)")
    check('service worker active', reg is True)
    pg.reload(); pg.wait_for_selector('input[type=password]')
    check('page controlled by service worker after reload', pg.evaluate("!!navigator.serviceWorker.controller"))
    cdp = ctx.new_cdp_session(pg)
    inst = cdp.send('Page.getInstallabilityErrors')
    check('installable (no CDP installability errors)', not inst.get('installabilityErrors'), json.dumps(inst.get('installabilityErrors'))[:200])
    check('manifest linked', pg.evaluate("!!document.querySelector('link[rel=manifest]')"))
    check('theme-color + apple meta', pg.evaluate("!!document.querySelector('meta[name=theme-color]') && !!document.querySelector('meta[name=apple-mobile-web-app-capable]')"))

    # --- offline: reload the app shell with no network, unlock and write
    ctx.set_offline(True); time.sleep(.4)
    pg.reload(); pg.wait_for_selector('input[type=password]')
    check('app shell loads offline', True)
    unlock(pg)
    check('offline chip visible', pg.get_by_text('Offline', exact=True).first.is_visible())
    pg.fill('input[placeholder="Untitled entry"]', 'Offline entry'); pg.click('.ProseMirror'); pg.keyboard.type('written without internet'); time.sleep(2.5)
    check('entry saved while offline', 'saved' in pg.locator('[class*=meta]').first.inner_text().lower() or 'word' in pg.locator('[class*=meta]').first.inner_text().lower())
    ctx.set_offline(False); time.sleep(.5)
    check('offline chip gone when back online', pg.get_by_text('Offline', exact=True).count() == 0)

    # --- Security panel storage row
    pg.get_by_role('button', name='Security').first.click(); time.sleep(.8)
    txt = pg.get_by_role('dialog', name='Security').inner_text()
    check('storage protection row present', 'cleanup' in txt.lower(), txt.split('\n')[0][:40])
    pg.keyboard.press('Escape')

    # --- shortcut + share target (fresh launches with query strings; offline-safe via SW)
    pg2 = ctx.new_page(); pg2.set_default_timeout(12000)
    pg2.goto(BASE + '?action=search'); unlock(pg2); time.sleep(.8)
    check('shortcut ?action=search opens Search', pg2.get_by_role('dialog', name='Search entries').is_visible())
    check('URL cleaned after launch', '?' not in pg2.url)
    pg3 = ctx.new_page(); pg3.set_default_timeout(12000)
    pg3.goto(BASE + '?title=Shared%20title&text=Hello%20from%20another%20app&url=https%3A%2F%2Fexample.com'); unlock(pg3); time.sleep(1.8)
    check('share target fills title', pg3.locator('input[placeholder="Untitled entry"]').input_value() == 'Shared title')
    body = pg3.locator('.ProseMirror').inner_text()
    check('share target fills text + link', 'Hello from another app' in body and 'https://example.com' in body, body[:60].replace('\n', ' '))
    check('no page errors', not errs, '; '.join(errs)[:200])
    b.close()
print('ALL OK' if ok else 'SOME FAILED')
