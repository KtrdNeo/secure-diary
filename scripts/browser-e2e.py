# End-to-end checks against the built app (needs python playwright + `npm run build`).
# Usage: (npx vite preview --port 4180 &) ; python3 scripts/browser-e2e.py
# Exits non-zero if any check fails.
import sys, time, tempfile, os
from playwright.sync_api import sync_playwright

BASE = os.environ.get('BASE', 'http://127.0.0.1:4180/')
PW1, PW2 = 'correct horse battery', 'a brand new passphrase'
fails = []

def check(name, cond, extra=''):
    print(('PASS ' if cond else 'FAIL ') + name + (f'  [{extra}]' if extra and not cond else ''))
    if not cond: fails.append(name)

def first_run(pg, pw):
    pg.goto(BASE)
    pg.wait_for_selector('input[type=password]', timeout=20000)
    ins = pg.locator('input[type=password]')
    for i in range(ins.count()): ins.nth(i).fill(pw)
    pg.keyboard.press('Enter')
    pg.wait_for_selector('button[aria-label="Lock"]', timeout=60000)

def unlock(pg, pw):
    pg.wait_for_selector('input[type=password]', timeout=20000)
    pg.fill('input[type=password]', pw); pg.keyboard.press('Enter')

with sync_playwright() as p:
    b = p.chromium.launch()
    ctxA = b.new_context(viewport={'width': 1280, 'height': 850}, accept_downloads=True)
    A = ctxA.new_page(); errs = []
    A.on('pageerror', lambda e: errs.append(str(e)))
    first_run(A, PW1)
    A.wait_for_selector('.ProseMirror')
    A.fill('input[placeholder="Untitled entry"]', 'Alpha')
    A.click('.ProseMirror'); A.keyboard.type('hello secure world'); time.sleep(3.5)

    # --- dialog focus management ---
    A.click('nav button:has-text("Settings")'); A.wait_for_selector('[role=dialog]')
    inside = A.evaluate("!!document.activeElement.closest('[role=dialog]')")
    check('focus moves into dialog on open', inside)
    stayed = True
    for _ in range(25):
        A.keyboard.press('Tab')
        if not A.evaluate("!!document.activeElement.closest('[role=dialog]')"): stayed = False
    check('Tab stays trapped inside dialog', stayed)
    A.keyboard.press('Escape'); time.sleep(.4)
    check('Esc closes dialog', A.locator('[role=dialog]').count() == 0)
    check('focus returns to opener', 'Settings' in (A.evaluate("document.activeElement.innerText||document.activeElement.getAttribute('aria-label')||''")))

    # --- change passphrase ---
    A.click('nav button:has-text("Settings")'); A.wait_for_selector('#cp-current')
    A.fill('#cp-current', PW1); A.fill('#cp-new', PW2); A.fill('#cp-confirm', PW2)
    A.click('button:has-text("Change passphrase")')
    A.wait_for_selector('input[type=password]', timeout=60000)   # locked after success
    unlock(A, PW1); time.sleep(3)
    check('old passphrase rejected after change', A.locator('text=Incorrect').count() == 1)
    # --- throttle ---
    for _ in range(2):
        A.fill('input[type=password]', 'nope nope nope'); A.keyboard.press('Enter'); time.sleep(2.5)
    check('unlock throttle appears after repeated failures', A.locator('text=/Too many attempts/').count() == 1)
    time.sleep(2.5)
    A.fill('input[type=password]', PW2); A.keyboard.press('Enter')
    A.wait_for_selector('button[aria-label="Lock"]', timeout=60000); time.sleep(2)
    check('entry survives passphrase change', A.input_value('input[placeholder="Untitled entry"]') == 'Alpha')

    # --- backup download ---
    A.click('footer button:has-text("Admin")'); A.click('[role=dialog] button:has-text("Backup")')
    with A.expect_download() as dl: A.click('button:has-text("Download backup")')
    path = os.path.join(tempfile.gettempdir(), 'sd-backup.json'); dl.value.save_as(path)
    A.keyboard.press('Escape')

    # --- restore on a brand-new device ---
    ctxB = b.new_context(viewport={'width': 1280, 'height': 850})
    B = ctxB.new_page(); B.on('pageerror', lambda e: errs.append(str(e)))
    B.goto(BASE); B.wait_for_selector('input[type=password]', timeout=20000)
    B.set_input_files('input[type=file]', path); time.sleep(1.5)
    check('restore on fresh device shows unlock form', B.locator('text=Unlock your diary').count() == 1, B.locator('body').inner_text()[:200])
    unlock(B, PW2)
    B.wait_for_selector('button[aria-label="Lock"]', timeout=60000); time.sleep(2)
    check('restored entry decrypts on new device', B.input_value('input[placeholder="Untitled entry"]') == 'Alpha')

    # --- delete + delete forever ---
    B.click('button[aria-label="Delete this page"] >> visible=true'); B.click('[role=dialog] button:has-text("Move to trash")'); time.sleep(1.5)
    B.click('footer button:has-text("Admin")'); B.click('[role=dialog] button:has-text("Trash")'); time.sleep(.5)
    check('trash shows 1 entry', B.locator('text=/1 entry in the trash/').count() == 1)
    B.click('button:has-text("Delete forever")'); B.click('button:has-text("Yes, delete forever")'); time.sleep(.8)
    check('delete forever empties trash', B.locator('text=/0 entries in the trash|Permanently deleted 1/').count() >= 1)
    B.keyboard.press('Escape')

    # --- swipe to turn pages (touch) ---
    ctxC = b.new_context(viewport={'width': 390, 'height': 800}, has_touch=True, is_mobile=True)
    C = ctxC.new_page(); C.on('pageerror', lambda e: errs.append(str(e)))
    first_run(C, PW1); C.wait_for_selector('.ProseMirror')
    C.fill('input[placeholder="Untitled entry"]', 'One'); C.click('.ProseMirror'); C.keyboard.type('page one'); time.sleep(3.2)
    C.click('button[aria-label="New entry"]'); time.sleep(1.5)
    ind = lambda: C.locator('text=/Page \\d+ of \\d+/').first.inner_text()
    before = ind()
    cdp = ctxC.new_cdp_session(C)
    def swipe(x1, x2, y=300):
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x1, 'y': y}]})
        for i in range(1, 9):
            cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': x1 + (x2 - x1) * i / 8, 'y': y}]}); time.sleep(.02)
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []}); time.sleep(1.4)
    swipe(60, 340)   # right swipe = previous
    after_prev = ind()
    swipe(340, 60)   # left swipe = next
    after_next = ind()
    print('indicator:', before, '->', after_prev, '->', after_next)
    check('swipe right turns to previous page', after_prev != before)
    check('swipe left turns to next page', after_next == before)
    # visual viewport var
    check('--app-h follows visual viewport', C.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--app-h').trim()") == '800px')
    C.set_viewport_size({'width': 390, 'height': 450}); time.sleep(.6)
    check('--app-h shrinks with keyboard-sized viewport', C.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--app-h').trim()") == '450px')

    check('no uncaught page errors', not errs, str(errs))
    b.close()
print('\nFAILED:' if fails else '\nALL PASSED', fails or '')
sys.exit(1 if fails else 0)
