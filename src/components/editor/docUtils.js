/**
 * src/components/editor/docUtils.js
 *
 * Pure functions over a Tiptap/ProseMirror JSON document (from
 * editor.getJSON()) - no editor instance needed, so these are testable
 * directly with a hand-built fixture document.
 */

/** Walks the whole doc counting taskItem (checkbox) completion. */
export function countTaskProgress(docJSON) {
  let checked = 0;
  let total = 0;

  function walk(node) {
    if (!node) return;
    if (node.type === 'taskItem') {
      total += 1;
      if (node.attrs?.checked) checked += 1;
    }
    if (Array.isArray(node.content)) {
      node.content.forEach(walk);
    }
  }

  walk(docJSON);
  return { checked, total };
}

/** True if the document has no real content worth autosaving. */
export function isDocEmpty(docJSON) {
  if (!docJSON || !Array.isArray(docJSON.content)) return true;
  return docJSON.content.every((node) => {
    if (node.type !== 'paragraph') return false;
    return !node.content || node.content.length === 0;
  });
}
