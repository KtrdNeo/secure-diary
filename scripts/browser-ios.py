# iOS install UX: emulate iPhone Safari / Chrome / in-app browser / iPad / standalone and check the Install button, banner and guide.
import os, time
from playwright.sync_api import sync_playwright
BASE = os.environ.get('BASE', 'http://127.0.0.1:4180/'); PW = 'correct horse battery'; ok = True
def check(n, c, x=''):
    global ok; print(('PASS ' if c else 'FAIL ') + n + (f'  [{x}]' if x else '')); ok = ok and bool(c)
SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
CHROME = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/123.0 Mobile/15E148 Safari/604.1'
INAPP  = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 320.0'
IPAD   = 'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
def unlock(pg):
    pg.wait_for_selector('input[type=password]'); ins = pg.locator('input[type=password]')
    for i in range(ins.count()): ins.nth(i).fill(PW)
    pg.keyboard.press('Enter'); pg.wait_for_selector('.ProseMirror'); time.sleep(.8)
def overflow(pg): return pg.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth')
with sync_playwright() as p:
    b = p.chromium.launch()
    for name, ua, vp, standalone in [('iPhone Safari', SAFARI, (390, 844), False), ('iPhone 320', SAFARI, (320, 568), False),
                                     ('iPhone Chrome', CHROME, (390, 844), False), ('Instagram in-app', INAPP, (390, 844), False),
                                     ('iPad Safari', IPAD, (820, 1180), False), ('iPhone installed', SAFARI, (390, 844), True)]:
        ctx = b.new_context(user_agent=ua, viewport={'width': vp[0], 'height': vp[1]}, has_touch=True, is_mobile=True)
        if standalone: ctx.add_init_script("Object.defineProperty(navigator,'standalone',{get:()=>true})")
        pg = ctx.new_page(); pg.set_default_timeout(10000); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(BASE); unlock(pg)
        banner = pg.get_by_role('region', name='Install the app')
        if standalone:
            check(f'[{name}] no install UI when already installed', banner.count() == 0 and pg.get_by_role('button', name='Install app').count() == 0)
            ctx.close(); continue
        check(f'[{name}] install banner visible', banner.is_visible())
        check(f'[{name}] no horizontal overflow with banner', overflow(pg) <= 0, str(overflow(pg)))
        banner.get_by_role('button', name='Install', exact=True).click(); time.sleep(.6)
        dlg = pg.get_by_role('dialog', name='Install SecureDiary'); txt = dlg.inner_text()
        check(f'[{name}] guide opens', dlg.is_visible())
        if 'Instagram' in name:
            check(f'[{name}] says open in Safari + copy link', 'Open in Safari' in txt and dlg.get_by_role('button', name='Copy link').is_visible())
        else:
            check(f'[{name}] shows Share + Add to Home Screen + Add', 'Share' in txt and 'Add to Home Screen' in txt and 'Add' in txt)
            if 'Chrome' in name: check(f'[{name}] mentions Chrome + iOS 16.4', 'Chrome' in txt and '16.4' in txt)
            if 'iPad' in name: check(f'[{name}] iPad: share at top', 'top of the screen' in txt)
        box = dlg.bounding_box(); check(f'[{name}] guide fits viewport', box['x'] >= 0 and box['x'] + box['width'] <= vp[0] and box['y'] >= 0 and box['y'] + box['height'] <= vp[1] + 1, str(box))
        if name == 'iPhone Safari': pg.screenshot(path='/tmp/ios-guide.png')
        pg.keyboard.press('Escape'); time.sleep(.3)
        # menu route
        if vp[0] < 720:
            pg.get_by_role('button', name='More').click(); pg.get_by_role('menuitem', name='Install app').click(); time.sleep(.5)
            check(f'[{name}] More → Install app opens guide', pg.get_by_role('dialog', name='Install SecureDiary').is_visible()); pg.keyboard.press('Escape'); time.sleep(.3)
        else:
            pill = pg.locator('header nav button[aria-label="Install app"]')
            check(f'[{name}] header Install button', pill.count() == 1 and pill.is_visible())
        if name == 'iPhone Safari': pg.screenshot(path='/tmp/ios-banner.png')
        # dismiss + stays dismissed after reload
        banner.get_by_role('button', name='Dismiss install suggestion').click(); time.sleep(.3)
        check(f'[{name}] banner dismisses', banner.count() == 0)
        pg.reload(); unlock(pg)
        check(f'[{name}] stays dismissed after reload (menu entry remains)', pg.get_by_role('region', name='Install the app').count() == 0)
        check(f'[{name}] no page errors', not errs, '; '.join(errs)[:150]); ctx.close()
    # desktop Chromium without a prompt event: nothing offered
    ctx = b.new_context(viewport={'width': 1280, 'height': 800}); pg = ctx.new_page(); pg.goto(BASE); unlock(pg)
    check('[desktop] no install UI without prompt support', pg.get_by_role('region', name='Install the app').count() == 0)
    # desktop Chromium WITH a (simulated) beforeinstallprompt: banner + header button call prompt()
    pg.evaluate("""() => { const e = new Event('beforeinstallprompt'); e.prompt = () => { window.__prompted = true; }; e.userChoice = Promise.resolve({outcome:'dismissed'}); window.dispatchEvent(e); }""")
    time.sleep(.4)
    check('[desktop] banner appears on beforeinstallprompt', pg.get_by_role('region', name='Install the app').is_visible())
    pg.get_by_role('region', name='Install the app').get_by_role('button', name='Install', exact=True).click(); time.sleep(.4)
    check('[desktop] Install calls the native prompt', pg.evaluate('window.__prompted === true'))
    b.close()
print('ALL OK' if ok else 'SOME FAILED')
