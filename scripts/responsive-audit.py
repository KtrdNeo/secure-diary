# Responsive audit: drives the built app across device sizes, saves screenshots to ./audit/
# and reports horizontal overflow, elements clipped past the viewport, and small tap targets.
# Usage: npm run build && npx vite preview --port 4180 &  then  ONLY=phone-390,laptop python3 scripts/responsive-audit.py
import sys, os, time, json
from playwright.sync_api import sync_playwright

BASE = os.environ.get('BASE', 'http://127.0.0.1:4180/')
ONLY = os.environ.get('ONLY', '').split(',') if os.environ.get('ONLY') else None
PW = 'correct horse battery'
OUT = 'audit'
os.makedirs(OUT, exist_ok=True)
DEVICES = [
    ('phone-se', 320, 568, True), ('phone-360', 360, 640, True), ('phone-390', 390, 844, True),
    ('phone-430', 430, 932, True), ('phone-landscape', 844, 390, True), ('tablet', 768, 1024, True),
    ('tablet-landscape', 1024, 768, True), ('laptop', 1280, 800, False), ('desktop', 1920, 1080, False),
]
CHECK = """() => {
  const vw = window.innerWidth, vh = window.innerHeight, issues = [];
  if (document.documentElement.scrollWidth > vw + 1) issues.push('PAGE horizontal overflow: ' + document.documentElement.scrollWidth + ' > ' + vw);
  if (document.documentElement.scrollHeight > vh + 1 && !document.querySelector('[data-allow-scroll]')) issues.push('PAGE vertical scroll: ' + document.documentElement.scrollHeight + ' > ' + vh);
  const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const name = (el) => (el.tagName.toLowerCase() + (el.getAttribute('aria-label') ? '[' + el.getAttribute('aria-label') + ']' : '') + ':' + (el.textContent || '').trim().slice(0, 20));
  const dlg = document.querySelector('[role=dialog]');
  const scope = dlg || document;
  scope.querySelectorAll('button, a, input, select, textarea, [role=button]').forEach((el) => {
    if (!vis(el) || el.type === 'hidden') return;
    if (el.closest('[data-scrollrow]')) { /* scroll rows may overflow by design */ }
    const r = el.getBoundingClientRect();
    const inScroll = !!el.closest('[data-scrollrow]');
    if (!inScroll && (r.right > vw + 1 || r.left < -1)) issues.push('OFFSCREEN ' + name(el) + ' ' + Math.round(r.left) + '..' + Math.round(r.right));
    if (el.type === 'checkbox' || el.type === 'radio' || el.className.toString().includes('input')) return;
    if (Math.min(r.width, r.height) < (vh <= 420 ? 30 : vw < 700 ? 36 : 28) && !el.closest('.ProseMirror')) issues.push('SMALL tap ' + name(el) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
  });
  scope.querySelectorAll('input:not([type=checkbox]):not([type=radio]), textarea, select').forEach((el) => { if (vis(el) && parseFloat(getComputedStyle(el).fontSize) < 16 && vw < 700) issues.push('FONT<16 (iOS zoom) ' + name(el)); });
  return issues;
}"""

def unlock(pg):
    pg.goto(BASE); pg.wait_for_selector('input[type=password]', timeout=20000)
    ins = pg.locator('input[type=password]')
    for i in range(ins.count()): ins.nth(i).fill(PW)
    pg.keyboard.press('Enter')

def report(tag, pg, bucket):
    iss = pg.evaluate(CHECK)
    bucket.extend(f'[{tag}] {i}' for i in iss)

def open_modal(pg, selector_text, tag, dev, bucket, nav_more=False):
    if nav_more:
        pg.click('button[aria-label="More"]'); time.sleep(.25)
    pg.click(selector_text); time.sleep(.5)
    pg.screenshot(path=f'{OUT}/{dev}-{tag}.png')
    report(f'{dev}/{tag}', pg, bucket_ref[0])
    pg.keyboard.press('Escape'); time.sleep(.3)
    if pg.locator('[role=dialog]').count():
        close = pg.locator('[role=dialog] button[aria-label=Close], [role=dialog] button:has-text("Cancel")').first
        if close.count(): close.click(); time.sleep(.3)

bucket_ref = [[]]
with sync_playwright() as p:
    b = p.chromium.launch()
    allissues = {}
    for dev, w, h, mobile in DEVICES:
        if ONLY and dev not in ONLY: continue
        ctx = b.new_context(viewport={'width': w, 'height': h}, has_touch=mobile, is_mobile=mobile, device_scale_factor=2 if mobile else 1)
        pg = ctx.new_page(); pg.set_default_timeout(3500); bucket = []; bucket_ref[0] = bucket
        pg.goto(BASE); pg.wait_for_selector('input[type=password]', timeout=20000); time.sleep(.5)
        pg.screenshot(path=f'{OUT}/{dev}-1-gate.png'); report(f'{dev}/gate', pg, bucket)
        unlock(pg); pg.wait_for_selector('.ProseMirror', timeout=40000); time.sleep(1)
        pg.screenshot(path=f'{OUT}/{dev}-2-blank.png'); report(f'{dev}/blank', pg, bucket)
        tb = pg.locator('button:has-text("Daily journal")').first
        if tb.is_visible(): tb.click(); time.sleep(.8)
        pg.locator('.ProseMirror').first.click(); pg.keyboard.type('Testing the layout on this device. ' * 6); time.sleep(.5)
        pg.screenshot(path=f'{OUT}/{dev}-3-writing.png'); report(f'{dev}/writing', pg, bucket)
        try:
            pg.click('button[aria-label="Table"]'); time.sleep(.3)
            pg.screenshot(path=f'{OUT}/{dev}-4-table.png'); report(f'{dev}/table', pg, bucket)
        except Exception as e: bucket.append(f'[{dev}] table click failed: {str(e)[:80]}')
        more = pg.locator('button[aria-label="More"]').count() > 0 and pg.locator('button[aria-label="More"]').is_visible()
        def go(label, tag, via_more=more, scope='nav,header'):
            try:
                if via_more:
                    pg.click('button[aria-label="More"]'); time.sleep(.25)
                    pg.locator('[role=menu] >> text=/^' + label + '/').first.click()
                else:
                    pg.locator(f'{scope} button:has-text("{label}"), footer button:has-text("{label}")').first.click()
                time.sleep(.6)
                pg.screenshot(path=f'{OUT}/{dev}-5-{tag}.png'); report(f'{dev}/{tag}', pg, bucket)
                pg.keyboard.press('Escape'); time.sleep(.3)
                if pg.locator('[role=dialog]').count():
                    pg.locator('[role=dialog] button[aria-label=Close]').first.click(); time.sleep(.3)
            except Exception as e:
                bucket.append(f'[{dev}/{tag}] FAILED {str(e)[:100]}')
                pg.keyboard.press('Escape'); time.sleep(.3)
        for label, tag in [('Stats','stats'),('Help','help'),('Settings','settings'),('Admin','admin'),('Sync','sync'),('Legal','legal'),('Search','search')]:
            go(label, tag, via_more=(more and label not in ('Search',)))
        try:
            pg.click('button[aria-label="Sinhala input"]'); time.sleep(.5)
            pg.screenshot(path=f'{OUT}/{dev}-6-sinhala.png'); report(f'{dev}/sinhala', pg, bucket); pg.locator('[role=dialog] button[aria-label=Close], [role=dialog] button:has-text("Cancel")').first.click(); time.sleep(.4)
            pg.click('button[aria-label="Insert drawing"]'); time.sleep(.7)
            pg.screenshot(path=f'{OUT}/{dev}-7-drawing.png'); report(f'{dev}/drawing', pg, bucket); pg.keyboard.press('Escape'); time.sleep(.3)
        except Exception as e: bucket.append(f'[{dev}] sinhala/drawing FAILED {str(e)[:100]}')
        allissues[dev] = sorted(set(bucket)); ctx.close()
    b.close()
total = 0
for dev, iss in allissues.items():
    print(f'== {dev}: {len(iss)} issue(s)'); total += len(iss)
    for i in iss: print('   ', i)
print('TOTAL', total)
