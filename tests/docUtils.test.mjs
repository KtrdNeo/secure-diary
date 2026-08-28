import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countTaskProgress, isDocEmpty } from '../src/components/editor/docUtils.js';

const emptyDoc = { type: 'doc', content: [{ type: 'paragraph' }] };

const docWithTasks = {
  type: 'doc',
  content: [
    { type: 'heading', content: [{ type: 'text', text: 'Today' }] },
    {
      type: 'taskList',
      content: [
        { type: 'taskItem', attrs: { checked: true }, content: [{ type: 'paragraph' }] },
        { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph' }] },
        {
          type: 'taskItem',
          attrs: { checked: true },
          content: [
            {
              // nested task list - should still be counted by the recursive walk
              type: 'taskList',
              content: [{ type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph' }] }],
            },
          ],
        },
      ],
    },
  ],
};

test('countTaskProgress finds no tasks in a doc without any', () => {
  assert.deepEqual(countTaskProgress(emptyDoc), { checked: 0, total: 0 });
});

test('countTaskProgress counts checked vs total, including nested lists', () => {
  assert.deepEqual(countTaskProgress(docWithTasks), { checked: 2, total: 4 });
});

test('countTaskProgress handles null/undefined gracefully', () => {
  assert.deepEqual(countTaskProgress(null), { checked: 0, total: 0 });
  assert.deepEqual(countTaskProgress(undefined), { checked: 0, total: 0 });
});

test('isDocEmpty is true for a single empty paragraph', () => {
  assert.equal(isDocEmpty(emptyDoc), true);
});

test('isDocEmpty is false once there is real content', () => {
  const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hi' }] }] };
  assert.equal(isDocEmpty(doc), false);
});

test('isDocEmpty is false for non-paragraph blocks even without text', () => {
  assert.equal(isDocEmpty(docWithTasks), false);
});

test('isDocEmpty is true for a completely missing document', () => {
  assert.equal(isDocEmpty(null), true);
  assert.equal(isDocEmpty({}), true);
});
