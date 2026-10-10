import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

let Editor, StarterKit, TaskList, TaskItem, Callout, TEMPLATES, buildTemplate;

before(async () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true, writable: true });
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  globalThis.DocumentFragment = dom.window.DocumentFragment;
  globalThis.getComputedStyle = dom.window.getComputedStyle;
  globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
  ({ Editor } = await import('@tiptap/core'));
  ({ default: StarterKit } = await import('@tiptap/starter-kit'));
  ({ default: TaskList } = await import('@tiptap/extension-task-list'));
  ({ default: TaskItem } = await import('@tiptap/extension-task-item'));
  ({ Callout } = await import('../src/components/editor/extensions/Callout.js'));
  ({ TEMPLATES, buildTemplate } = await import('../src/features/templates.js'));
});

test('every template loads into the real editor schema without losing nodes', () => {
  for (const t of TEMPLATES) {
    const { doc } = buildTemplate(t.id, new Date(2026, 4, 10));
    const editor = new Editor({
      extensions: [StarterKit, TaskList, TaskItem.configure({ nested: true }), Callout],
      content: doc,
    });
    const out = editor.getJSON().content;
    const want = doc.content.map((n) => n.type);
    // Tiptap 3 StarterKit appends an empty trailing paragraph after a final non-paragraph node.
    const extra = out.length - want.length;
    assert.ok(extra === 0 || extra === 1, `${t.id}: unexpected node count ${out.length} vs ${want.length}`);
    if (extra === 1) {
      const last = out[out.length - 1];
      assert.equal(last.type, 'paragraph');
      assert.ok(!last.content || last.content.length === 0);
    }
    assert.deepEqual(out.slice(0, want.length).map((n) => n.type), want, `${t.id}: node types changed`);
    editor.destroy();
  }
});
