import { Node, mergeAttributes } from '@tiptap/core';

/**
 * A styled block wrapper (info/warning/tip) - deliberately just markup +
 * CSS, no custom NodeView needed, since it has no interactive behavior
 * beyond normal text editing inside it.
 */
export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      variant: {
        default: 'info',
        parseHTML: (el) => el.getAttribute('data-variant') || 'info',
        renderHTML: (attrs) => ({ 'data-variant': attrs.variant }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-callout]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-callout': '' }), 0];
  },

  addCommands() {
    return {
      setCallout:
        (variant = 'info') =>
        ({ commands }) => {
          if (!commands.wrapIn(this.name, { variant })) {
            // Not currently inside a wrappable block (e.g. empty doc) -
            // insert a fresh one instead of silently failing.
            return commands.insertContent({
              type: this.name,
              attrs: { variant },
              content: [{ type: 'paragraph' }],
            });
          }
          return true;
        },
      unsetCallout:
        () =>
        ({ commands }) =>
          commands.lift(this.name),
    };
  },
});
