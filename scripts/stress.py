# Stress test: extreme viewports/text sizes + hostile content. Reports real defects only.
# Usage: BASE=http://127.0.0.1:4180/ python3 scripts/stress.py   (needs `npx vite build` + preview on :4180)
import os, sys, time
from playwright.sync_api import sync_playwright
BASE = os.environ.get('BASE', 'http://127.0.0.1:4180/'); PW = 'correct horse battery'
LONGWORD = 'Supercalifragilisticexpialidocious' * 8
VIEWPORTS = [(240, 400), (280, 653), (320, 480), (360, 360), (412, 300), (568, 320), (600, 960), (768, 400), (1024, 500),
             (1366, 768), (1920, 1080), (2560, 1440), (3840, 2160)]
FONTS = [100, 150, 200]
PANELS = [('Contents', 'Contents'), ('Security', 'Security'), ('Settings', 'Settings'), ('Trash', 'Trash'), ('Help', 'Help'),
          ('Stats', 'Stats'), ('Connections', 'Connections'), ('Ambient', 'Ambient sounds'), ('Admin', 'Admin'), ('Sync', 'Sync'), ('Legal', 'Legal')]
PAGE_JS = """() => {
  const out = [], vw = innerWidth, vh = innerHeight, de = document.documentElement;
  if (de.scrollWidth > vw + 1) out.push('H-overflow ' + de.scrollWidth + '>' + vw);
  const vis = (el) => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden'; };
  document.querySelectorAll('header button, header a, footer a, footer button').forEach((el) => {
    if (!vis(el)) return; const r = el.getBoundingClientRect();
    if (r.right > vw + 1 || r.left < -1) out.push('OFF ' + (el.getAttribute('aria-label') || el.textContent.trim().slice(0, 14)) + ' ' + Math.round(r.left) + '..' + Math.round(r.right));
  });
  const tb = document.querySelector('button[aria-label="Delete this page"]');
  if (tb && vis(tb)) { const r = tb.getBoundingClientRect(); if (r.right > vw + 1 || r.left < 0) out.push('page bin offscreen'); }
  const pm = document.querySelector('.ProseMirror');
  if (pm && pm.scrollWidth > pm.clientWidth + 2) out.push('editor content overflows horizontally ' + pm.scrollWidth + '>' + pm.clientWidth);
  const ec = document.querySelector('[class*=editorContent]'); const minWrite = parseFloat(getComputedStyle(document.documentElement).fontSize) > 24 ? 60 : parseFloat(getComputedStyle(document.documentElement).fontSize) > 20 ? 95 : 110;
  if (ec && ec.clientHeight < minWrite) { const q = (x) => { const e = document.querySelector(x); return e ? Math.round(e.getBoundingClientRect().height) : '-'; }; out.push('WRITE-AREA ' + ec.clientHeight + 'px [header ' + q('header') + ' toolbar ' + q('[class*=toolbar]') + ' title ' + q('[class*=titleRow]') + ' status ' + q('[class*=status]') + ' nav ' + q('[class*=pageNav]') + ' footer ' + q('footer') + ' statusWrap ' + getComputedStyle(document.querySelector('[class*=status]')).flexWrap + ' acts ' + [...document.querySelector('[class*=status]').children].map(c => Math.round(c.getBoundingClientRect().width) + 'x' + Math.round(c.getBoundingClientRect().height)).join(',') + ']'); }
  const ti = document.querySelector('input[placeholder="Untitled entry"]');
  if (ti) { const r = ti.getBoundingClientRect(); if (r.width < 90) out.push('title input too narrow ' + Math.round(r.width)); }
  return out;
}"""
DLG_JS = """() => {
  const out = [], vw = innerWidth, vh = innerHeight;
  const d = document.querySelector('[role=dialog]'); if (!d) return ['NO DIALOG'];
  const r = d.getBoundingClientRect();
  if (r.left < -1 || r.right > vw + 1 || r.top < -1 || r.bottom > vh + 1) out.push('dialog outside viewport ' + [r.left, r.top, r.right, r.bottom].map(Math.round));
  const close = d.querySelector('button[aria-label=Close]'); 
  if (close) { const c = close.getBoundingClientRect(); if (c.top < 0 || c.right > vw || c.left < 0 || c.bottom > vh) out.push('close button not visible'); }
  d.querySelectorAll('button, a, input, select, textarea').forEach((el) => {
    const s = getComputedStyle(el); const b = el.getBoundingClientRect(); if (!b.width || s.display === 'none' || s.visibility === 'hidden') return;
    el.scrollIntoView({ block: 'center', inline: 'nearest' });
    const q = el.getBoundingClientRect();
    if (q.top < -1 || q.bottom > vh + 1 || q.left < -1 || q.right > vw + 1) { out.push('unreachable ' + (el.getAttribute('aria-label') || el.textContent.trim().slice(0, 18) || el.tagName)); return; }
    const hit = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2);
    if (hit && !el.contains(hit) && !hit.contains(el)) out.push('covered ' + (el.getAttribute('aria-label') || el.textContent.trim().slice(0, 18)));
  });
  if (d.scrollWidth > d.clientWidth + 2) out.push('dialog H-scroll ' + d.scrollWidth + '>' + d.clientWidth);
  return out;
}"""
def unlock(pg):
    pg.wait_for_selector('input[type=password]'); ins = pg.locator('input[type=password]')
    for i in range(ins.count()): ins.nth(i).fill(PW)
    pg.keyboard.press('Enter'); pg.wait_for_selector('.ProseMirror', timeout=40000); time.sleep(.8)
def seed(pg):
    pg.fill('input[placeholder="Untitled entry"]', 'A very long title ' * 12 + LONGWORD)
    pg.click('.ProseMirror')
    pg.keyboard.type(LONGWORD + ' https://example.com/' + 'a' * 150 + ' ' + 'word ' * 120); time.sleep(.4)
    pg.keyboard.press('Enter')
    try:
        pg.click('button[aria-label="Table"]'); time.sleep(.3)
    except Exception: pass
    pg.click('input[placeholder="Untitled entry"]')  # leave the table so its contextual tools row closes
    time.sleep(2.4)
def open_panel(pg, label, vw):
    pill = pg.locator(f'header nav button[aria-label="{label}"]:visible')
    if pill.count(): pill.first.click()
    else:
        pg.locator('button[aria-label="More"]').click(); time.sleep(.2)
        item = pg.locator('[role=menu] >> text=/^' + ('Ambient' if label == 'Ambient sounds' else label) + '/').first
        item.scroll_into_view_if_needed(); item.click()
    time.sleep(.45)
bad = {}
def add(key, msgs):
    if msgs: bad.setdefault(key, set()).update(msgs)
with sync_playwright() as p:
    b = p.chromium.launch()
    for scheme, reduced in [('light', 'no-preference'), ('dark', 'reduce')]:
        ctx = b.new_context(viewport={'width': 390, 'height': 844}, color_scheme=scheme, reduced_motion=reduced)
        pg = ctx.new_page(); pg.set_default_timeout(6000); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(BASE); unlock(pg); seed(pg)
        fonts = FONTS if scheme == 'light' else [100]
        for fs in fonts:
            pg.evaluate(f"document.documentElement.style.fontSize='{fs}%'")
            for (w, h) in VIEWPORTS:
                if scheme == 'dark' and (w, h) not in [(280, 653), (412, 300), (1920, 1080)]: continue
                pg.set_viewport_size({'width': w, 'height': h}); time.sleep(.25)
                tag = f'{w}x{h}@{fs}%/{scheme}'
                add(tag + ' page', pg.evaluate(PAGE_JS))
                if os.environ.get('SHOTS'): pg.screenshot(path=f'/tmp/stress-{w}x{h}-{fs}-{scheme}.png')
                # dialogs only on a representative subset to keep runtime sane
                if (w, h) in [(240, 400), (280, 653), (360, 360), (412, 300), (568, 320), (1024, 500), (1920, 1080)] and (fs in (100, 200)):
                    for label, dlg in PANELS:
                        try:
                            open_panel(pg, label, w)
                            add(f'{tag} dialog:{label}', pg.evaluate(DLG_JS))
                        except Exception as e:
                            add(f'{tag} dialog:{label}', [f'could not open: {str(e)[:70]}'])
                        pg.keyboard.press('Escape'); time.sleep(.2)
                        if pg.locator('[role=dialog]').count():
                            c = pg.locator('[role=dialog] button[aria-label=Close]')
                            if c.count(): c.first.click(force=True); time.sleep(.2)
                    # delete confirm + install guide
                    try:
                        pg.locator('button[aria-label="Delete this page"]:visible').first.click(); time.sleep(.4)
                        add(f'{tag} dialog:delete-confirm', pg.evaluate(DLG_JS)); pg.keyboard.press('Escape'); time.sleep(.2)
                    except Exception as e: add(f'{tag} dialog:delete-confirm', [f'could not open: {str(e)[:70]}'])
        add(f'{scheme} page errors', errs)
        ctx.close()
    b.close()
print('scenarios with problems:', len(bad))
for k in sorted(bad):
    print('==', k)
    for m in sorted(bad[k])[:6]: print('    ', m)
sys.exit(1 if bad else 0)
