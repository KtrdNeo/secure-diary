/**
 * Entry templates - Tiptap `doc` JSON built from schema nodes already used
 * by the editor (heading, paragraph, lists, taskList, callout).
 */
const text = (t) => (t ? [{ type: 'text', text: t }] : undefined);
const node = (type, content, attrs) => {
  const n = { type };
  if (attrs) n.attrs = attrs;
  if (content && content.length) n.content = content;
  return n;
};
const h = (level, t) => node('heading', text(t), { level });
const p = (t = '') => node('paragraph', text(t));
const taskItem = (t = '') => node('taskItem', [p(t)], { checked: false });
const taskList = (n = 3) => node('taskList', Array.from({ length: n }, () => taskItem()));
const listItem = () => node('listItem', [p()]);
const bullets = (n = 3) => node('bulletList', Array.from({ length: n }, listItem));
const numbered = (n = 3) =>
  node('orderedList', Array.from({ length: n }, listItem), { start: 1 });
const branch = (t = '') => node('listItem', [p(t), node('bulletList', [listItem(), listItem()])]);
const callout = (variant, t) => node('callout', [p(t)], { variant });

export function dateLabel(date = new Date()) {
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export const TEMPLATES = [
  {
    id: 'daily',
    label: 'Daily journal',
    icon: '☀',
    description: 'Highlights, how the day felt, tomorrow.',
    build: (date) => ({
      title: dateLabel(date),
      content: [
        h(2, 'How was today?'),
        p(),
        h(2, 'Highlights'),
        bullets(3),
        h(2, 'Tomorrow'),
        taskList(3),
      ],
    }),
  },
  {
    id: 'gratitude',
    label: 'Gratitude',
    icon: '♡',
    description: 'Three good things, one small win.',
    build: (date) => ({
      title: `Gratitude - ${dateLabel(date)}`,
      content: [
        h(2, 'Three things I am grateful for'),
        numbered(3),
        h(2, 'A small win today'),
        p(),
        callout('tip', 'Be specific - small details make gratitude stick.'),
      ],
    }),
  },
  {
    id: 'todo',
    label: 'To-do list',
    icon: '☑',
    description: 'Priorities and a checklist.',
    build: (date) => ({
      title: `To-do - ${dateLabel(date)}`,
      content: [h(2, 'Top priorities'), taskList(3), h(2, 'Other tasks'), taskList(4)],
    }),
  },
  {
    id: 'meeting',
    label: 'Meeting notes',
    icon: '☰',
    description: 'Attendees, notes, action items.',
    build: (date) => ({
      title: `Meeting - ${dateLabel(date)}`,
      content: [
        h(2, 'Attendees'),
        p(),
        h(2, 'Notes'),
        bullets(3),
        h(2, 'Decisions'),
        p(),
        h(2, 'Action items'),
        taskList(3),
      ],
    }),
  },
  {
    id: 'mood',
    label: 'Mood check-in',
    icon: '☺',
    description: 'Name the feeling, find the trigger.',
    build: (date) => ({
      title: `Mood - ${dateLabel(date)}`,
      content: [
        h(2, 'Right now I feel…'),
        p(),
        h(2, 'What led to this?'),
        p(),
        h(2, 'One kind thing I can do for myself'),
        p(),
        callout('info', 'Rate your mood 1-10 and note it here.'),
      ],
    }),
  },
  {
    id: 'mindmap',
    label: 'Mind map',
    icon: '✺',
    description: 'A central idea with branches to expand.',
    build: (date) => ({
      title: `Mind map - ${dateLabel(date)}`,
      content: [
        h(2, 'Central idea'),
        p(),
        h(2, 'Branches'),
        node('bulletList', [branch('Branch one'), branch('Branch two'), branch('Branch three')]),
        callout('tip', 'Press Tab inside a bullet to nest a thought one level deeper.'),
      ],
    }),
  },
  {
    id: 'weekly',
    label: 'Weekly review',
    icon: '↻',
    description: 'Wins, lessons, next week.',
    build: (date) => ({
      title: `Weekly review - ${dateLabel(date)}`,
      content: [
        h(2, 'Wins this week'),
        bullets(3),
        h(2, 'What I learned'),
        bullets(2),
        h(2, 'What to improve'),
        bullets(2),
        h(2, 'Next week'),
        taskList(3),
      ],
    }),
  },
];

/** @returns {{title:string, content:object[]}|null} content = array of doc children */
export function buildTemplate(id, date = new Date()) {
  const t = TEMPLATES.find((x) => x.id === id);
  if (!t) return null;
  const { title, content } = t.build(date);
  return { title, doc: { type: 'doc', content }, content };
}
