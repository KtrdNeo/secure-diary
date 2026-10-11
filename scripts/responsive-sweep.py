# Sweeps many width x height combos (incl. "keyboard open" heights and large text) and flags
# page overflow, off-screen controls, overlapping app-bar items, and an unusably small writing area.
# Usage: BASE=http://127.0.0.1:4180/ python3 scripts/responsive-sweep.py
import os, time, json
from playwright.sync_api import sync_playwright
BASE = os.environ.get('BASE', 'http://127.0.0.1:4180/')
PW = 'correct horse battery'
WIDTHS = [320, 340, 360, 375, 390, 412, 430, 480, 540, 600, 640, 700, 720, 768, 820, 900, 1000, 1023, 1024, 1100, 1280, 1440, 1600, 1920, 2560]
HEIGHTS = [360, 420, 480, 568, 640, 700, 800, 900, 1080, 1440]
FONTS = [100, 130, 160]
MIN_WRITE = int(os.environ.get('MIN_WRITE', '110'))
JS = """() => {
  const out = []; const vw = innerWidth, vh = innerHeight;
  const de = document.documentElement;
  if (de.scrollWidth > vw + 1) out.push('H-overflow ' + de.scrollWidth);
  if (de.scrollHeight > vh + 1) out.push('V-scroll ' + de.scrollHeight);
  const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden'; };
  document.querySelectorAll('header button, header a, footer a, footer button, footer p').forEach((el) => {
    if (!vis(el)) return; const r = el.getBoundingClientRect();
    if (r.right > vw + 1 || r.left < -1) out.push('OFF ' + (el.getAttribute('aria-label') || el.textContent.trim().slice(0, 14)) + ' ' + Math.round(r.left) + '..' + Math.round(r.right));
  });
  const brand = document.querySelector('header [class*=brand]'); const acts = document.querySelector('header nav');
  if (brand && acts && vis(brand) && vis(acts)) { const a = brand.getBoundingClientRect(), b = acts.getBoundingClientRect(); if (a.right > b.left + 1) out.push('brand/actions overlap'); }
  const ec = document.querySelector('[class*=editorContent]');
  if (ec) { const h = ec.clientHeight; if (h < __MIN__) out.push('WRITE-AREA ' + h + 'px'); }
  const cover = document.querySelector('[class*=cover]'); if (cover) { const r = cover.getBoundingClientRect(); if (r.width < 200) out.push('cover narrow ' + r.width); }
  const nav = document.querySelector('[class*=pageNav]'); if (nav && !vis(nav)) out.push('page nav hidden');
  return out;
}""".replace('__MIN__', str(MIN_WRITE))
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 390, 'height': 844})
    pg = ctx.new_page(); pg.set_default_timeout(8000)
    pg.goto(BASE); pg.wait_for_selector('input[type=password]')
    ins = pg.locator('input[type=password]')
    for i in range(ins.count()): ins.nth(i).fill(PW)
    pg.keyboard.press('Enter'); pg.wait_for_selector('.ProseMirror'); time.sleep(1)
    pg.click('.ProseMirror'); pg.keyboard.type('Sweep test text. ' * 4); time.sleep(.5)
    bad = {}; n = 0
    for fs in FONTS:
        pg.evaluate(f"document.documentElement.style.fontSize = '{fs}%'")
        for w in WIDTHS:
            for h in HEIGHTS:
                pg.set_viewport_size({'width': w, 'height': h}); time.sleep(.04)
                iss = pg.evaluate(JS); n += 1
                if iss: bad[f'{w}x{h}@{fs}%'] = iss
    b.close()
print('combos checked:', n, ' problem combos:', len(bad))
by = {}
for k, v in bad.items():
    for i in v: by.setdefault(i.split(' ')[0] + (' ' + i.split(' ')[1] if i.startswith('OFF') else ''), []).append(k)
for i, ks in sorted(by.items(), key=lambda x: -len(x[1])):
    print(f'{i}: {len(ks)} combos  e.g. {ks[:6]}')
json.dump(bad, open('sweep-result.json', 'w'), indent=1)
