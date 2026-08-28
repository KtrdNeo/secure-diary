import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from '@tiptap/react';

/**
 * Single-select option list - distinct from TaskList's checkboxes
 * (multi-select). Selecting one item deselects the others in its group.
 *
 * Deliberately NOT implemented via ProseMirror parent/depth position
 * arithmetic (resolving "the position before this node, then walk up to
 * find siblings") - that's easy to get subtly wrong and I have no
 * browser here to click-test it. Instead, every item created together
 * shares a `groupId` attribute, and selecting one walks the *whole*
 * document with the well-documented, unambiguous `descendants()` API,
 * flipping `checked` on every item sharing that id. Slightly more work
 * per click, completely unambiguous about which nodes it's touching.
 */
function selectRadioItem(editor, groupId, targetPos) {
  const { state, dispatch } = editor.view;
  const tr = state.tr;
  state.doc.descendants((n, pos) => {
    if (n.type.name === 'radioItem' && n.attrs.groupId === groupId) {
      tr.setNodeMarkup(pos, undefined, { ...n.attrs, checked: pos === targetPos });
    }
  });
  dispatch(tr);
}

function RadioItemView({ node, editor, getPos }) {
  const { checked, groupId } = node.attrs;

  function handleClick() {
    const pos = typeof getPos === 'function' ? getPos() : null;
    if (pos === null) return;
    selectRadioItem(editor, groupId, pos);
  }

  return (
    <NodeViewWrapper as="li" data-radio-item="" data-checked={checked ? 'true' : 'false'}>
      <button
        type="button"
        role="radio"
        aria-checked={checked}
        contentEditable={false}
        data-radio-control=""
        onClick={handleClick}
      />
      <NodeViewContent as="div" data-radio-content="" />
    </NodeViewWrapper>
  );
}

export const RadioItem = Node.create({
  name: 'radioItem',
  content: 'paragraph block*',
  defining: true,

  addAttributes() {
    return {
      checked: {
        default: false,
        parseHTML: (el) => el.getAttribute('data-checked') === 'true',
        renderHTML: (attrs) => ({ 'data-checked': attrs.checked ? 'true' : 'false' }),
      },
      groupId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-group-id'),
        renderHTML: (attrs) => ({ 'data-group-id': attrs.groupId }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'li[data-radio-item]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['li', mergeAttributes(HTMLAttributes, { 'data-radio-item': '' }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(RadioItemView);
  },
});

export const RadioGroup = Node.create({
  name: 'radioGroup',
  group: 'block',
  content: 'radioItem+',

  parseHTML() {
    return [{ tag: 'ul[data-radio-group]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['ul', mergeAttributes(HTMLAttributes, { 'data-radio-group': '' }), 0];
  },

  addCommands() {
    return {
      insertRadioGroup:
        () =>
        ({ commands }) => {
          const groupId = `rg-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
          return commands.insertContent({
            type: this.name,
            content: [
              { type: 'radioItem', attrs: { checked: true, groupId }, content: [{ type: 'paragraph' }] },
              { type: 'radioItem', attrs: { checked: false, groupId }, content: [{ type: 'paragraph' }] },
            ],
          });
        },
    };
  },
});
