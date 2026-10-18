/** Launch-time URL handling: manifest shortcuts (?action=) and the Web Share Target (?title&text&url). */
const ACTIONS = new Set(['new', 'search', 'contents']);

export function parseLaunchParams(search = '') {
  const q = new URLSearchParams(search);
  const action = q.get('action');
  const clean = (v) => (v || '').trim().slice(0, 20000);
  const title = clean(q.get('title'));
  const text = clean(q.get('text'));
  const url = clean(q.get('url'));
  const share = title || text || url ? { title, text, url } : null;
  return { action: ACTIONS.has(action) ? action : null, share };
}

/** Shared payload -> { title, content: ProseMirror nodes } for a new entry. Plain text only. */
export function shareToContent(share) {
  const paragraphs = [];
  const add = (s) => {
    String(s || '')
      .split(/\r?\n/)
      .forEach((line) => paragraphs.push(line.trim() ? { type: 'paragraph', content: [{ type: 'text', text: line }] } : { type: 'paragraph' }));
  };
  add(share.text);
  if (share.url && !String(share.text || '').includes(share.url)) add(share.url);
  return { title: share.title || '', content: paragraphs.length ? paragraphs : [{ type: 'paragraph' }] };
}
