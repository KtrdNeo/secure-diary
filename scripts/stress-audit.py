# Content + accessibility stress: extreme titles/words/tables/many entries, big text, zoom, landscape phones, panels.
# Flags unclipped horizontal overflow, text spilling out of its box, tiny tap targets, hidden controls.
import os, time, json, sys
from playwright.sync_api import sync_playwright
BASE = os.environ.get('BASE', 'http://127.0.0.1:4180/'); PW = 'correct horse battery'
OUT = os.environ.get('OUT', '/tmp/stress'); os.makedirs(OUT, exist_ok=True)
VIEWS = [(320, 568), (360, 640), (390, 844), (844, 390), (667, 375), (768, 1024), (1024, 768), (1280, 800), (1920, 1080)]
SCALES = [100, 200]
LONG = 'W' * 140
JS = """() => {
  const out = []; const vw = innerWidth, vh = innerHeight;
  const de = document.documentElement;
  if (de.scrollWidth > vw + 1) out.push('PAGE-H-overflow ' + de.scrollWidth + ' > ' + vw);
  const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0'; };
  const clipped = (el) => { for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) { const s = getComputedStyle(a); if (s.overflowX === 'auto' || s.overflowX === 'scroll') { const r = a.getBoundingClientRect(); const e = el.getBoundingClientRect(); if (e.right > r.right + 1 || e.left < r.left - 1) return true; } } return false; };
  const name = (el) => (el.getAttribute('aria-label') || el.textContent || el.className || el.tagName).toString().trim().replace(/\\s+/g, ' ').slice(0, 28);
  const scope = document.querySelector('[role=dialog]') || document.body;
  const only = scope;
  scope.querySelectorAll('button, a, input, select, textarea, h1, h2, h3, p, span, li, label').forEach((el) => {
    if (!vis(el)) return;
    if (el.closest('.ProseMirror')) return;
    const r = el.getBoundingClientRect();
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) { const cs = getComputedStyle(a); if (cs.overflowX === 'hidden' || cs.overflowX === 'clip') { const ar = a.getBoundingClientRect(); if (r.right > ar.right + 1 && !clipped(el)) { out.push('HIDDEN-CLIPPED ' + el.tagName.toLowerCase() + ' "' + name(el) + '" by ' + (a.className || a.tagName).toString().slice(0, 30)); break; } } }
    if ((r.right > vw + 1 || r.left < -1) && !clipped(el)) out.push('OFFSCREEN ' + el.tagName.toLowerCase() + ' "' + name(el) + '" ' + Math.round(r.left) + '..' + Math.round(r.right));
    const s = getComputedStyle(el);
    if (['SPAN','P','LI','LABEL','H1','H2','H3','BUTTON','A'].includes(el.tagName) && s.display !== 'inline' && el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 2 && s.overflowX === 'visible') out.push('TEXT-SPILL ' + el.tagName.toLowerCase() + ' "' + name(el) + '" ' + el.scrollWidth + '>' + el.clientWidth);
    if (/^(BUTTON|A|INPUT|SELECT)$/.test(el.tagName) && !el.closest('p, li > span') && !el.disabled) {
      const small = r.height < 32 || r.width < 32;
      const inText = el.tagName === 'A' && el.closest('p');
      if (small && !inText && el.type !== 'hidden' && el.type !== 'checkbox' && el.type !== 'radio') out.push('TAP-TARGET ' + Math.round(r.width) + 'x' + Math.round(r.height) + ' "' + name(el) + '"');
    }
  });
  return out;
}"""
def unlock(pg):
    pg.wait_for_selector('input[type=password]'); ins = pg.locator('input[type=password]')
    for i in range(ins.count()): ins.nth(i).fill(PW)
    pg.keyboard.press('Enter'); pg.wait_for_selector('.ProseMirror'); time.sleep(.8)
def new_entry(pg, title, body, kb=None):
    pg.get_by_role('button', name='New entry').click(); time.sleep(.9)
    pg.fill('input[placeholder="Untitled entry"]', title); pg.click('.ProseMirror')
    pg.keyboard.type(body, delay=0); 
    if kb: kb(pg)
    time.sleep(1.8)
def table_cb(pg):
    pg.click('button[aria-label="Table"]'); time.sleep(.4)
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={'width': 390, 'height': 844}); pg = ctx.new_page(); pg.set_default_timeout(8000)
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(BASE); unlock(pg)
    # seed extreme content
    new_entry(pg, LONG, 'https://example.com/' + 'a' * 260 + ' ' + 'Supercalifragilisticexpialidocious' * 8, table_cb)
    new_entry(pg, 'සිංහල දිගු මාතෘකාවක් සමඟ පරීක්ෂා කිරීම ' * 3, 'මෙය සිංහල පරීක්ෂණ පෙළකි. ' * 30)
    new_entry(pg, 'Plain', 'short')
    for i in range(12): new_entry(pg, f'Entry number {i} with a moderately long title to wrap around on small screens', 'x ' * 40)
    pg.get_by_role('button', name='Delete this page').first.click() if False else None
    bad = {}; n = 0
    for sc in SCALES:
        pg.evaluate(f"document.documentElement.style.fontSize = '{sc}%'")
        for (w, h) in VIEWS:
            pg.set_viewport_size({'width': w, 'height': h}); time.sleep(.35)
            # 1) main screen on the extreme entry (jump via contents)
            def snap(tag, openfn=None, closefn=None):
                global n
                try:
                    if openfn: openfn()
                    time.sleep(.5); iss = pg.evaluate(JS); n += 1
                    if iss: bad[f'{w}x{h}@{sc}% {tag}'] = sorted(set(iss))[:12]
                    if sc == 200 and (w, h) in [(320, 568), (844, 390)]: pg.screenshot(path=f'{OUT}/{w}x{h}-{sc}-{tag.replace(" ", "_")}.png')
                except Exception as e: bad[f'{w}x{h}@{sc}% {tag}'] = ['FAILED ' + str(e)[:90]]
                finally:
                    pg.keyboard.press('Escape'); time.sleep(.25)
            def via(label):
                def f():
                    pill = pg.locator(f'header nav button[aria-label="{label}"]')
                    if pill.count() and pill.first.is_visible(): pill.first.click()
                    else:
                        pg.click('button[aria-label="More"]'); time.sleep(.25); pg.locator('[role=menu] >> text=/^' + label + '/').first.click()
                return f
            snap('main-first-entry', lambda: pg.evaluate("1"))
            for lab in ['Contents', 'Search', 'Trash', 'Stats', 'Settings', 'Security', 'Connections', 'Help', 'Admin', 'Legal']:
                snap(lab, via(lab))
    b.close()
print('views checked:', n, ' problem views:', len(bad), ' page errors:', len(errs))
agg = {}
for k, v in bad.items():
    for i in v: agg.setdefault(i.split('"')[0].strip() + ' "' + (i.split('"')[1] if '"' in i else '') + '"', []).append(k)
for i, ks in sorted(agg.items(), key=lambda x: -len(x[1]))[:40]: print(f'{len(ks):3d}x {i}   e.g. {ks[:3]}')
json.dump(bad, open('/tmp/stress/result.json', 'w'), indent=1)
