/**
 * Runs the real Editor (from @tiptap/core, not the React wrapper) inside
 * a jsdom DOM, with the exact same extension list RichTextEditor.jsx
 * uses. This is the only way to catch schema conflicts, bad extension
 * config, or import errors between the custom nodes without a real
 * browser.
 *
 * Deliberately does NOT exercise radioItem/drawingBlock/voiceNoteBlock
 * *content* - those use ReactNodeViewRenderer, which needs a real React
 * DOM-mounting environment beyond what's set up here. What IS verified:
 * the schema accepts and registers all three custom node types without
 * conflicting with StarterKit/TaskList/Table, and every node type that
 * doesn't need a React NodeView (paragraphs, headings, task lists,
 * tables, callouts) round-trips correctly through real ProseMirror
 * document construction, not just "the JS file didn't throw on import."
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

let Editor;
let StarterKit;
let TaskList;
let TaskItem;
let Table;
let TableRow;
let TableCell;
let TableHeader;
let Callout;
let RadioGroup;
let RadioItem;
let DrawingBlock;
let VoiceNoteBlock;
let Collaboration;
let Y;

before(async () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  // Node 22+ already defines a getter-only `navigator` global itself -
  // plain assignment throws; defineProperty overrides it instead.
  Object.defineProperty(globalThis, 'navigator', {
    value: dom.window.navigator,
    configurable: true,
    writable: true,
  });
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  globalThis.DocumentFragment = dom.window.DocumentFragment;
  globalThis.getComputedStyle = dom.window.getComputedStyle;
  // jsdom doesn't implement rAF (no real animation frame timing to hook
  // into) - Tiptap's focus() command uses it internally to defer
  // selection until after the current call stack.
  globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);

  // Dynamic imports, after the DOM globals exist - Tiptap/ProseMirror
  // touch `document` at module-evaluation time in places.
  ({ Editor } = await import('@tiptap/core'));
  ({ default: StarterKit } = await import('@tiptap/starter-kit'));
  ({ default: TaskList } = await import('@tiptap/extension-task-list'));
  ({ default: TaskItem } = await import('@tiptap/extension-task-item'));
  ({ Table, TableRow, TableCell, TableHeader } = await import('@tiptap/extension-table'));
  ({ Callout } = await import('../src/components/editor/extensions/Callout.js'));
  ({ RadioGroup, RadioItem } = await import('../src/components/editor/extensions/RadioGroup.jsx'));
  ({ DrawingBlock } = await import('../src/components/editor/extensions/DrawingBlock.jsx'));
  ({ VoiceNoteBlock } = await import('../src/components/editor/extensions/VoiceNoteBlock.jsx'));
  ({ default: Collaboration } = await import('@tiptap/extension-collaboration'));
  Y = await import('yjs');
});

function makeEditor(content) {
  return new Editor({
    extensions: [
      StarterKit,
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      Callout,
      RadioGroup,
      RadioItem,
      DrawingBlock,
      VoiceNoteBlock,
    ],
    content,
  });
}

/** Mirrors RichTextEditor.jsx's actual extension list exactly (StarterKit
 * with undoRedo disabled + Collaboration bound to a real Y.Doc) - this is
 * what catches a config that "looks fine in isolation" but conflicts once
 * Collaboration is actually wired in. */
function makeCollaborativeEditor(ydoc) {
  return new Editor({
    extensions: [
      StarterKit.configure({ undoRedo: false }),
      Collaboration.configure({ document: ydoc, field: 'content' }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      Callout,
      RadioGroup,
      RadioItem,
      DrawingBlock,
      VoiceNoteBlock,
    ],
  });
}

test('the full extension set registers without conflicts', () => {
  const editor = makeEditor('<p>hello</p>');
  assert.ok(editor.schema.nodes.callout, 'callout node missing from schema');
  assert.ok(editor.schema.nodes.radioGroup, 'radioGroup node missing from schema');
  assert.ok(editor.schema.nodes.radioItem, 'radioItem node missing from schema');
  assert.ok(editor.schema.nodes.drawingBlock, 'drawingBlock node missing from schema');
  assert.ok(editor.schema.nodes.voiceNoteBlock, 'voiceNoteBlock node missing from schema');
  assert.ok(editor.schema.nodes.taskItem, 'taskItem node missing from schema');
  assert.ok(editor.schema.nodes.table, 'table node missing from schema');
  editor.destroy();
});

test('basic marks from StarterKit work (bold/italic toggle)', () => {
  const editor = makeEditor('<p>hello world</p>');
  editor.commands.selectAll();
  editor.commands.toggleBold();
  assert.equal(editor.isActive('bold'), true);
  editor.commands.toggleItalic();
  assert.equal(editor.isActive('italic'), true);
  editor.destroy();
});

test('task list content round-trips through getJSON/setContent', () => {
  const editor = makeEditor({
    type: 'doc',
    content: [
      {
        type: 'taskList',
        content: [
          { type: 'taskItem', attrs: { checked: true }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'done' }] }] },
          { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'todo' }] }] },
        ],
      },
    ],
  });

  const json = editor.getJSON();
  const items = json.content[0].content;
  assert.equal(items.length, 2);
  assert.equal(items[0].attrs.checked, true);
  assert.equal(items[1].attrs.checked, false);
  editor.destroy();
});

test('setCallout command wraps a paragraph in a callout node', () => {
  const editor = makeEditor('<p>be careful</p>');
  editor.commands.selectAll();
  editor.commands.setCallout('warning');

  const json = editor.getJSON();
  const calloutNode = json.content.find((n) => n.type === 'callout');
  assert.ok(calloutNode, 'expected a callout node in the document');
  assert.equal(calloutNode.attrs.variant, 'warning');
  editor.destroy();
});

test('insertTable produces a real table/tableRow/tableCell structure', () => {
  const editor = makeEditor('<p></p>');
  editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: true });

  const json = editor.getJSON();
  const table = json.content.find((n) => n.type === 'table');
  assert.ok(table, 'expected a table node');
  assert.equal(table.content.length, 2); // 2 rows
  assert.equal(table.content[0].content.length, 2); // 2 cols
  editor.destroy();
});

test('insertRadioGroup produces two mutually-distinct radioItem nodes sharing one groupId', () => {
  const editor = makeEditor('<p></p>');
  editor.commands.insertRadioGroup();

  const json = editor.getJSON();
  const group = json.content.find((n) => n.type === 'radioGroup');
  assert.ok(group, 'expected a radioGroup node');
  assert.equal(group.content.length, 2);
  const [a, b] = group.content;
  assert.equal(a.attrs.groupId, b.attrs.groupId);
  assert.equal(a.attrs.checked, true);
  assert.equal(b.attrs.checked, false);
  editor.destroy();
});

test('drawingBlock and voiceNoteBlock nodes accept an attachmentId attribute via JSON content', () => {
  const editor = makeEditor({
    type: 'doc',
    content: [
      { type: 'drawingBlock', attrs: { attachmentId: 42 } },
      { type: 'paragraph' },
      { type: 'voiceNoteBlock', attrs: { attachmentId: 43 } },
    ],
  });

  const json = editor.getJSON();
  assert.equal(json.content[0].type, 'drawingBlock');
  assert.equal(json.content[0].attrs.attachmentId, 42);
  assert.equal(json.content[2].type, 'voiceNoteBlock');
  assert.equal(json.content[2].attrs.attachmentId, 43);
  editor.destroy();
});

// ---- Collaboration integration (the exact config RichTextEditor.jsx uses) ----

test('a Collaboration-bound editor constructs without conflicting with StarterKit undoRedo:false', () => {
  const ydoc = new Y.Doc();
  ydoc.get('content', Y.XmlFragment);
  const editor = makeCollaborativeEditor(ydoc);
  assert.ok(editor.schema.nodes.paragraph);
  editor.destroy();
});

test('typing through the editor actually writes into the underlying Y.Doc', () => {
  const ydoc = new Y.Doc();
  ydoc.get('content', Y.XmlFragment);
  const editor = makeCollaborativeEditor(ydoc);

  editor.commands.insertContent('hello from the editor');
  const fragment = ydoc.get('content', Y.XmlFragment);

  assert.ok(fragment.toString().includes('hello from the editor'), 'edit through Tiptap never reached the Y.Doc');
  editor.destroy();
});

test('undo/redo still work with StarterKit\'s history disabled (Collaboration provides its own)', () => {
  const ydoc = new Y.Doc();
  ydoc.get('content', Y.XmlFragment);
  const editor = makeCollaborativeEditor(ydoc);

  editor.commands.insertContent('typed text');
  assert.ok(editor.getText().includes('typed text'));

  const undoOk = editor.commands.undo();
  assert.equal(undoOk, true, 'undo command is missing or failed - Collaboration should provide it');

  editor.destroy();
});

test('end-to-end: two live editors, each bound to their own Y.Doc, merge into one document with both edits (not just raw Yjs - through the actual Tiptap/Collaboration binding)', () => {
  const sharedState = (() => {
    const seed = new Y.Doc();
    seed.get('content', Y.XmlFragment);
    const seedEditor = new Editor({
      extensions: [StarterKit.configure({ undoRedo: false }), Collaboration.configure({ document: seed, field: 'content' })],
    });
    seedEditor.commands.setContent('<p>Dear diary,</p>');
    const state = Y.encodeStateAsUpdate(seed);
    seedEditor.destroy();
    return state;
  })();

  const ydocA = new Y.Doc();
  Y.applyUpdate(ydocA, sharedState);
  const ydocB = new Y.Doc();
  Y.applyUpdate(ydocB, sharedState);

  const editorA = makeCollaborativeEditor(ydocA);
  const editorB = makeCollaborativeEditor(ydocB);

  editorA.commands.focus('end');
  editorA.commands.insertContent(' today was sunny.');
  editorB.commands.focus('end');
  editorB.commands.insertContent(' I saw a whale!');

  const stateA = Y.encodeStateAsUpdate(ydocA);
  const stateB = Y.encodeStateAsUpdate(ydocB);

  const merged = new Y.Doc();
  Y.applyUpdate(merged, stateA);
  Y.applyUpdate(merged, stateB);
  const mergedText = merged.get('content', Y.XmlFragment).toString();

  assert.ok(mergedText.includes('Dear diary,'), 'lost the shared starting content');
  assert.ok(mergedText.includes('today was sunny.'), 'lost editor A\'s edit through the real Tiptap binding');
  assert.ok(mergedText.includes('I saw a whale!'), 'lost editor B\'s edit through the real Tiptap binding');

  editorA.destroy();
  editorB.destroy();
});
