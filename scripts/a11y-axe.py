# Runs axe-core (WCAG 2.1 A/AA) on key screens. Usage: AXE=/path/to/axe.min.js BASE=http://127.0.0.1:4180/ python3 scripts/a11y-axe.py
import os, time, json
from playwright.sync_api import sync_playwright
BASE = os.environ.get('BASE', 'http://127.0.0.1:4180/')
AXE = open(os.environ.get('AXE', '/tmp/axe/node_modules/axe-core/axe.min.js')).read()
PW = 'correct horse battery'
def run(pg, label):
    pg.evaluate(AXE)
    r = pg.evaluate("axe.run(document, {runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}})")
    v = r['violations']
    print(f'== {label}: {len(v)} violation(s)')
    for x in v:
        print('  -', x['id'], x['impact'], '|', x['help'], '|', len(x['nodes']), 'node(s)')
        for n in x['nodes'][:2]: print('      ', n['target'], (n.get('failureSummary') or '')[:140].replace('\n', ' '))
    return len(v)
total = 0
with sync_playwright() as p:
    b = p.chromium.launch()
    for theme in ('light', 'dark'):
        ctx = b.new_context(viewport={'width': 390, 'height': 844}, color_scheme=theme)
        pg = ctx.new_page(); pg.set_default_timeout(8000)
        pg.goto(BASE); pg.wait_for_selector('input[type=password]')
        total += run(pg, f'gate ({theme})')
        ins = pg.locator('input[type=password]')
        for i in range(ins.count()): ins.nth(i).fill(PW)
        pg.keyboard.press('Enter'); pg.wait_for_selector('.ProseMirror'); time.sleep(1)
        total += run(pg, f'editor ({theme})')
        pg.fill('input[placeholder="Untitled entry"]', 'Axe page'); pg.click('.ProseMirror'); pg.keyboard.type('some words'); time.sleep(2.5)
        pg.get_by_role('button', name='Delete this page').first.click(); time.sleep(.5)
        total += run(pg, f'Delete confirm ({theme})')
        pg.get_by_role('dialog').get_by_role('button', name='Move to trash').click(); time.sleep(.8)
        total += run(pg, f'Undo toast ({theme})')
        pg.get_by_role('button', name='View trash').click(); time.sleep(.8)
        total += run(pg, f'Trash with entry ({theme})'); pg.keyboard.press('Escape'); time.sleep(.3)
        for name in ('Search', 'More'):
            try:
                pg.get_by_role('button', name=name).first.click(); time.sleep(.5)
                total += run(pg, f'{name} open ({theme})'); pg.keyboard.press('Escape'); time.sleep(.3)
            except Exception as e: print('skip', name, str(e)[:60])
        # dialogs reached through the More menu
        for label, tag in (('Settings', 'Settings'), ('Ambient', 'Ambient sounds'), ('Connections', 'Connections')):
            try:
                pg.get_by_role('button', name='More').click(); time.sleep(.3)
                pg.locator('[role=menu] >> text=/^' + label + '/').first.click(); time.sleep(.8)
                total += run(pg, f'{tag} dialog ({theme})'); pg.keyboard.press('Escape'); time.sleep(.3)
            except Exception as e: print('skip', tag, str(e)[:80])
        ctx.close()
    b.close()
print('TOTAL', total)
