# Captures the manifest screenshots from the running app (vite preview on :4180).
import time
from playwright.sync_api import sync_playwright
TEXT = ["Dear diary,", "Today was slow and good. Coffee on the veranda, rain on the roof, and finally time to think.",
        "Three things I am grateful for: my family, a quiet morning, and this little book that only I can read."]
with sync_playwright() as p:
    b = p.chromium.launch()
    for (w, h, name) in [(1280, 800, 'desktop'), (540, 960, 'phone')]:
        pg = b.new_context(viewport={'width': w, 'height': h}).new_page(); pg.set_default_timeout(10000)
        pg.goto('http://127.0.0.1:4180/'); pg.wait_for_selector('input[type=password]')
        ins = pg.locator('input[type=password]')
        for i in range(ins.count()): ins.nth(i).fill('correct horse battery')
        pg.keyboard.press('Enter'); pg.wait_for_selector('.ProseMirror'); time.sleep(.8)
        pg.fill('input[placeholder="Untitled entry"]', 'A quiet Sunday')
        pg.click('.ProseMirror')
        for line in TEXT: pg.keyboard.type(line); pg.keyboard.press('Enter')
        time.sleep(2.5)
        pg.evaluate("document.querySelectorAll('[role=status]').forEach(e=>e.remove())")
        pg.screenshot(path=f'public/screenshots/{name}.png')
    b.close()
