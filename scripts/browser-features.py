# End-to-end check of the spec features: time capsule, battery saver, ambient hub, exports, Sinhala modes.
# Usage: (vite preview on :4180) python3 scripts/browser-features.py
import os, time, datetime
from playwright.sync_api import sync_playwright
BASE = os.environ.get('BASE', 'http://127.0.0.1:4180/')
PW = 'correct horse battery'
ok = True
def via_menu(pg, label):
    pg.get_by_role('button', name='More').click(); time.sleep(.3)
    pg.locator('[role=menu] >> text=/^' + label + '/').first.click()
def check(name, cond, extra=''):
    global ok
    print(('PASS ' if cond else 'FAIL ') + name + (f'  [{extra}]' if extra else ''))
    ok = ok and bool(cond)
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 1280, 'height': 800}, accept_downloads=True)
    pg = ctx.new_page(); pg.set_default_timeout(8000)
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(BASE); pg.wait_for_selector('input[type=password]')
    ins = pg.locator('input[type=password]')
    for i in range(ins.count()): ins.nth(i).fill(PW)
    pg.keyboard.press('Enter'); pg.wait_for_selector('.ProseMirror'); time.sleep(.8)
    pg.fill('input[placeholder="Untitled entry"]', 'Capsule one')
    pg.click('.ProseMirror'); pg.keyboard.type('zebrafinch secret words'); time.sleep(2.5)

    # --- Markdown export of one entry
    with pg.expect_download() as d:
        pg.get_by_role('button', name='Export', exact=True).first.click()
    check('entry export is .md', d.value.suggested_filename.endswith('.md'), d.value.suggested_filename)

    # --- Time capsule
    pg.get_by_role('button', name='Seal', exact=True).click()
    check('seal picker opens', pg.locator('#seal-date').is_visible())
    future = (datetime.date.today() + datetime.timedelta(days=30)).isoformat()
    pg.fill('#seal-date', future)
    pg.get_by_role('button', name='Seal this page').click(); time.sleep(1.5)
    check('sealed card shown', pg.get_by_text('Sealed until').first.is_visible())
    check('editor hidden while sealed', pg.locator('.ProseMirror').count() == 0)
    pg.get_by_role('button', name='Search', exact=True).first.click(); time.sleep(.6)
    pg.fill('input[type=search]', 'zebrafinch'); time.sleep(.8)
    body_hits = pg.locator('[aria-label="Search entries"] li').count()
    pg.fill('input[type=search]', 'Capsule'); time.sleep(.8)
    title_hits = pg.locator('[aria-label="Search entries"] li').count()
    check('sealed body not searchable, title is', body_hits == 0 and title_hits >= 1, f'body={body_hits} title={title_hits}')
    pg.keyboard.press('Escape'); time.sleep(.3)
    pg.get_by_role('button', name='Open early').click(); time.sleep(1.2)
    check('open early restores editor', pg.locator('.ProseMirror').count() == 1)

    # --- Settings: battery saver
    via_menu(pg, 'Settings'); time.sleep(.4)
    pg.select_option('#saver', 'on'); time.sleep(.6)
    check('battery saver sets data-saver=on', pg.evaluate("document.documentElement.dataset.saver") == 'on')
    pg.keyboard.press('Escape'); time.sleep(.3)
    pg.get_by_role('button', name='New entry').first.click(); time.sleep(.8)
    check('page indicator shows', 'Page' in pg.locator('[class*=pageButton]').inner_text())
    pg.get_by_role('button', name='Previous entry').click(); time.sleep(.4)
    check('saver: instant page turn (no flip layer stuck)', pg.locator('[class*=flipLayer]').count() == 0)
    via_menu(pg, 'Settings'); time.sleep(.4)
    pg.select_option('#saver', 'off'); time.sleep(.5)
    check('battery saver off', pg.evaluate("document.documentElement.dataset.saver") == 'off')
    pg.keyboard.press('Escape'); time.sleep(.3)

    # --- Ambient hub
    via_menu(pg, 'Ambient'); time.sleep(.4)
    check('ambient panel opens', pg.get_by_role('dialog', name='Ambient sounds').is_visible())
    pg.get_by_role('button', name='Focus').click(); time.sleep(.5)
    check('preset toggles pressed', pg.get_by_role('button', name='Focus').get_attribute('aria-pressed') == 'true')
    pg.get_by_role('button', name='Stop sound').click(); time.sleep(.3)
    check('stop works', pg.get_by_role('button', name='Focus').get_attribute('aria-pressed') == 'false')
    pg.keyboard.press('Escape'); time.sleep(.3)

    # --- Rings are true circles at several sizes
    for (w, h) in [(1280, 800), (844, 390), (390, 844), (1360, 640)]:
        pg.set_viewport_size({'width': w, 'height': h}); time.sleep(.4)
        dims = pg.evaluate("[...document.querySelectorAll('[class*=ring_]')].map(e=>{const r=e.getBoundingClientRect();return [Math.round(r.width),Math.round(r.height)]})")
        check(f'rings round at {w}x{h}', len(dims) >= 2 and all(a == b for a, b in dims), f'{len(dims)} rings')
    pg.set_viewport_size({'width': 1280, 'height': 800}); time.sleep(.4)

    # --- Contents panel
    pg.get_by_role('button', name='Contents').first.click(); time.sleep(.7)
    cdlg = pg.get_by_role('dialog', name='Contents')
    check('contents lists the entry', 'Capsule one' in cdlg.inner_text())
    cdlg.get_by_role('button', name='Capsule one').click(); time.sleep(.8)
    check('contents jumps to entry', pg.locator('input[placeholder="Untitled entry"]').input_value() == 'Capsule one')

    # --- Security panel + privacy shield
    pg.get_by_role('button', name='Security').first.click(); time.sleep(.6)
    sdlg = pg.get_by_role('dialog', name='Security')
    check('security panel shows encryption status', 'AES-GCM-256' in sdlg.inner_text())
    sdlg.get_by_label('Hide the diary when I switch apps or tabs').check(); time.sleep(.5)
    pg.keyboard.press('Escape'); time.sleep(.3)
    pg.evaluate("document.hasFocus = () => false; window.dispatchEvent(new Event('blur'))"); time.sleep(.4)
    check('privacy shield covers diary when away', pg.get_by_text('SecureDiary is hidden').is_visible())
    pg.evaluate("document.hasFocus = () => true; window.dispatchEvent(new Event('focus'))"); time.sleep(.4)
    check('privacy shield lifts on return', pg.get_by_text('SecureDiary is hidden').count() == 0)

    # --- Sinhala modes
    pg.get_by_role('button', name='Sinhala').first.click(); time.sleep(.5)
    dlg = pg.get_by_role('dialog', name='Sinhala input')
    dlg.get_by_role('button', name='Speak').click(); time.sleep(.3)
    check('speak mode shows privacy note', 'speech service' in dlg.inner_text())
    dlg.get_by_role('button', name='Scan photo').click(); time.sleep(.3)
    check('scan mode shows chooser', dlg.get_by_text('Choose photo').is_visible())
    pg.keyboard.press('Escape'); time.sleep(.3)

    # --- Admin exports
    pg.get_by_role('button', name='More').count()  # desktop has no More
    pg.set_viewport_size({'width': 390, 'height': 844}); time.sleep(.4)
    pg.get_by_role('button', name='More').click(); time.sleep(.3)
    pg.locator('[role=menu] >> text=/^Admin/').first.click(); time.sleep(.5)
    adm = pg.get_by_label('Admin dashboard')
    adm.get_by_role('button', name='Backup').click(); time.sleep(.2)
    with pg.expect_download() as d:
        adm.get_by_role('button', name='Download encrypted backup (.diary)').click()
    check('backup is .diary', d.value.suggested_filename.endswith('.diary'), d.value.suggested_filename)
    adm.get_by_role('button', name='Export').click(); time.sleep(.2)
    with pg.expect_download() as d:
        adm.get_by_role('button', name='Markdown (.md) - all entries').click()
    path = d.value.path(); txt = open(path, encoding='utf-8').read()
    check('markdown export has entry', 'Capsule one' in txt and 'zebrafinch' in txt, txt[:60].replace('\n', ' '))
    check('no page errors', not errs, '; '.join(errs)[:200])
    b.close()
print('ALL OK' if ok else 'SOME FAILED')
