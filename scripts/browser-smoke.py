# Optional dev check (needs python playwright + `npm run build && npx vite preview --port 4173`).
# Drives the built app: first-run, template, lock/unlock, wrong passphrase, delete, trash restore.
import time
from playwright.sync_api import sync_playwright
PW='correct horse battery'
with sync_playwright() as p:
    b=p.chromium.launch()
    pg=b.new_page(viewport={'width':1280,'height':850})
    errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://127.0.0.1:4180/')
    pg.wait_for_selector('input[type=password]',timeout=15000)
    ins=pg.locator('input[type=password]')
    for i in range(ins.count()): ins.nth(i).fill(PW)
    pg.keyboard.press('Enter')
    pg.wait_for_selector('text=A blank page',timeout=40000)
    pg.click('button:has-text("To-do list")'); time.sleep(.5)
    pg.click('.ProseMirror'); pg.keyboard.type('x'); time.sleep(3.5)
    # wrong passphrase after lock
    pg.click('button[aria-label="Lock"]'); pg.wait_for_selector('input[type=password]')
    print('inputs on lock screen:',pg.locator('input[type=password]').count())
    pg.fill('input[type=password]','wrong wrong wrong'); pg.keyboard.press('Enter'); time.sleep(3)
    print('wrong pw msg:',pg.locator('text=Incorrect').count())
    pg.fill('input[type=password]',PW); pg.keyboard.press('Enter')
    pg.wait_for_selector('button[aria-label="Lock"]',timeout=40000); time.sleep(2)
    print('title:',pg.input_value('input[placeholder="Untitled entry"]'))
    # delete
    pg.click('button[aria-label="Delete this page"] >> visible=true'); pg.click('[role=dialog] button:has-text("Move to trash")'); time.sleep(2)
    print('indicator after delete:',pg.locator('text=/Page \\d+ of \\d+/').first.inner_text(), '| welcome:',pg.locator('text=A blank page').count())
    pg.click('footer button:has-text("Admin")'); pg.click('[role=dialog] button:has-text("Trash")'); time.sleep(.6)
    print(pg.locator('[role=dialog]').inner_text().replace('\n',' | ')[:260])
    pg.click('button:has-text("Restore all")'); time.sleep(1)
    pg.keyboard.press('Escape'); time.sleep(1.5)
    print('title after restore:',pg.input_value('input[placeholder="Untitled entry"]'))
    pg.set_viewport_size({'width':390,'height':800}); time.sleep(1); pg.screenshot(path='mobile.png')
    b.close()
print(errs or 'no page errors')
