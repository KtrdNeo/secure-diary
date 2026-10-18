# Delete flow: trash button on page, confirm, Undo toast, Trash panel restore / erase, menu path on phones.
import os, time
from playwright.sync_api import sync_playwright
BASE = os.environ.get('BASE', 'http://127.0.0.1:4180/'); PW = 'correct horse battery'; ok = True
def check(n, c, x=''):
    global ok; print(('PASS ' if c else 'FAIL ') + n + (f'  [{x}]' if x else '')); ok = ok and bool(c)
def unlock(pg):
    pg.wait_for_selector('input[type=password]'); ins = pg.locator('input[type=password]')
    for i in range(ins.count()): ins.nth(i).fill(PW)
    pg.keyboard.press('Enter'); pg.wait_for_selector('.ProseMirror'); time.sleep(.8)
def write(pg, title, body):
    pg.fill('input[placeholder="Untitled entry"]', title); pg.click('.ProseMirror'); pg.keyboard.type(body); time.sleep(2.2)
with sync_playwright() as p:
    b = p.chromium.launch()
    for name, vp in [('desktop', (1280, 800)), ('phone', (390, 844)), ('tiny', (320, 568))]:
        ctx = b.new_context(viewport={'width': vp[0], 'height': vp[1]}); pg = ctx.new_page(); pg.set_default_timeout(12000)
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(BASE); unlock(pg)
        trash = pg.locator('button[aria-label="Delete this page"]:visible')
        check(f'[{name}] bin button on blank draft is disabled', trash.first.is_disabled())
        write(pg, 'Keep me', 'first page'); 
        pg.get_by_role('button', name='New entry').click(); time.sleep(1.2)
        write(pg, 'Delete me', 'second page')
        # page-level bin (beside title)
        pg.locator('button[aria-label="Delete this page"]:visible').first.click()
        dlg = pg.get_by_role('dialog', name='Move this page to trash?'); check(f'[{name}] confirm dialog', dlg.is_visible())
        dlg.get_by_role('button', name='Cancel').click(); time.sleep(.3)
        check(f'[{name}] cancel keeps page', pg.locator('input[placeholder="Untitled entry"]').first.input_value() in ('Delete me', 'Keep me') and pg.get_by_role('status').filter(has_text='moved to trash').count() == 0)
        # go to 'Delete me' page and delete it
        pg.get_by_role('button', name='Contents').first.click() if vp[0] >= 720 else None
        if vp[0] < 720:
            pg.get_by_role('button', name='More').click(); pg.get_by_role('menuitem', name='Contents').click()
        time.sleep(.6); pg.get_by_role('dialog', name='Contents').get_by_text('Delete me').click(); time.sleep(1.2)
        if vp[0] >= 720:
            pg.get_by_role('button', name='Delete this page').first.click()  # header or page bin
        else:
            pg.get_by_role('button', name='More').click(); pg.get_by_role('menuitem', name='Delete this page').click()
        pg.get_by_role('dialog', name='Move this page to trash?').get_by_role('button', name='Move to trash').click(); time.sleep(1)
        toast = pg.get_by_role('status').filter(has_text='moved to trash'); check(f'[{name}] undo toast', toast.is_visible())
        box = toast.bounding_box(); check(f'[{name}] toast inside viewport', box and box['x'] >= 0 and box['x'] + box['width'] <= vp[0] and box['y'] + box['height'] <= vp[1], str(box))
        if name != 'desktop': pg.screenshot(path=f'/tmp/toast-{name}.png')
        toast.get_by_role('button', name='Undo').click(); time.sleep(1.5)
        check(f'[{name}] undo restores + jumps to page', pg.locator('input[placeholder="Untitled entry"]').first.input_value() == 'Delete me')
        # delete again, open trash from toast, restore from panel
        pg.locator('button[aria-label="Delete this page"]:visible').first.click()
        pg.get_by_role('dialog', name='Move this page to trash?').get_by_role('button', name='Move to trash').click(); time.sleep(1)
        pg.get_by_role('status').filter(has_text='moved to trash').get_by_role('button', name='View trash').click(); time.sleep(.8)
        tp = pg.get_by_role('dialog', name='Trash'); check(f'[{name}] trash lists decrypted title', 'Delete me' in tp.inner_text())
        tp.get_by_role('button', name='Restore Delete me').click(); time.sleep(.8)
        check(f'[{name}] trash empty after restore', 'empty' in tp.inner_text().lower())
        pg.keyboard.press('Escape'); time.sleep(.8)
        # delete once more and erase forever from the panel
        pg.locator('button[aria-label="Delete this page"]:visible').first.click()
        pg.get_by_role('dialog', name='Move this page to trash?').get_by_role('button', name='Move to trash').click(); time.sleep(.8)
        pg.get_by_role('status').filter(has_text='moved to trash').get_by_role('button', name='View trash').click(); time.sleep(.6)
        tp = pg.get_by_role('dialog', name='Trash'); tp.get_by_role('button', name='Delete Delete me forever').click(); tp.get_by_role('button', name='Erase forever').click(); time.sleep(.8)
        check(f'[{name}] erase forever empties trash', 'empty' in tp.inner_text().lower())
        pg.keyboard.press('Escape'); time.sleep(.5)
        sw = pg.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth')
        check(f'[{name}] no horizontal overflow', sw <= 0, str(sw))
        check(f'[{name}] no page errors', not errs, '; '.join(errs)[:150])
        pass
        ctx.close()
    b.close()
print('ALL OK' if ok else 'SOME FAILED')
