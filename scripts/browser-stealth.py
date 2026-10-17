# Stealth (decoy) vault end-to-end. Usage: (vite preview on :4180) python3 scripts/browser-stealth.py
import os, time
from playwright.sync_api import sync_playwright
BASE = os.environ.get('BASE', 'http://127.0.0.1:4180/')
REAL, DECOY = 'correct horse battery', 'decoy-pass-1234'
ok = True
def via_menu(pg, label):
    pg.get_by_role('button', name='More').click(); time.sleep(.3)
    pg.locator('[role=menu] >> text=/^' + label + '/').first.click()
def check(name, cond, extra=''):
    global ok
    print(('PASS ' if cond else 'FAIL ') + name + (f'  [{extra}]' if extra else '')); ok = ok and bool(cond)
def unlock(pg, pw):
    pg.wait_for_selector('input[type=password]')
    ins = pg.locator('input[type=password]')
    for i in range(ins.count()): ins.nth(i).fill(pw)
    pg.keyboard.press('Enter')
def lock(pg):
    pg.get_by_role('button', name='Lock', exact=True).first.click(); time.sleep(.6)
def search_hits(pg, term):
    pg.get_by_role('button', name='Search', exact=True).first.click(); time.sleep(.6)
    pg.fill('input[type=search]', term); time.sleep(.9)
    n = pg.locator('[aria-label="Search entries"] li').count()
    pg.keyboard.press('Escape'); time.sleep(.3); return n
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_context(viewport={'width': 1280, 'height': 800}).new_page(); pg.set_default_timeout(10000)
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(BASE); unlock(pg, REAL); pg.wait_for_selector('.ProseMirror'); time.sleep(.8)
    pg.fill('input[placeholder="Untitled entry"]', 'REALTITLE')
    pg.click('.ProseMirror'); pg.keyboard.type('real secret text'); time.sleep(2.5)
    via_menu(pg, 'Settings'); time.sleep(.5)
    check('stealth section visible in real diary', pg.get_by_label('Stealth vault').is_visible())
    pg.fill('#stealth-pass', DECOY); pg.fill('#stealth-confirm', DECOY)
    pg.get_by_role('button', name='Create stealth vault').click(); time.sleep(4)
    check('vault created', 'A stealth vault is set up' in pg.get_by_role('dialog', name='Settings').inner_text())
    pg.keyboard.press('Escape'); time.sleep(.3)
    lock(pg)
    # wrong passphrase still fails
    unlock(pg, 'totally wrong pass'); time.sleep(5)
    check('wrong passphrase rejected', pg.get_by_text('Incorrect passphrase').count() == 1)
    # decoy opens a separate diary
    pg.fill('input[type=password]', ''); unlock(pg, DECOY); pg.wait_for_selector('.ProseMirror', timeout=20000); time.sleep(1)
    check('decoy diary has no real title', pg.locator('input[placeholder="Untitled entry"]').input_value() == '')
    check('real entry not searchable in decoy', search_hits(pg, 'REALTITLE') == 0)
    via_menu(pg, 'Settings'); time.sleep(.5)
    check('no stealth section inside decoy', pg.get_by_label('Stealth vault').count() == 0)
    pg.keyboard.press('Escape'); time.sleep(.3)
    pg.fill('input[placeholder="Untitled entry"]', 'DECOYTITLE')
    pg.click('.ProseMirror'); pg.keyboard.type('harmless text'); time.sleep(2.5)
    lock(pg)
    unlock(pg, REAL); pg.wait_for_selector('.ProseMirror', timeout=20000); time.sleep(1.2)
    check('real diary back with real entry', search_hits(pg, 'REALTITLE') == 1)
    check('decoy entry absent from real diary', search_hits(pg, 'DECOYTITLE') == 0)
    check('no page errors', not errs, '; '.join(errs)[:200])
    b.close()
print('ALL OK' if ok else 'SOME FAILED')
