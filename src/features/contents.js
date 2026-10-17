/** Table of contents helpers: group + filter entries for the Contents panel. */
export function monthKey(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(key, locale) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(locale, { month: 'long', year: 'numeric' });
}

/** items: [{id, title, createdAt, sealed}] -> newest month first, newest entry first within a month. */
export function groupByMonth(items) {
  const groups = new Map();
  [...items]
    .sort((a, b) => b.createdAt - a.createdAt)
    .forEach((it) => {
      const k = monthKey(it.createdAt);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(it);
    });
  return [...groups.entries()].map(([key, entries]) => ({ key, entries }));
}

export function filterItems(items, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return items;
  return items.filter((it) => (it.title || 'untitled entry').toLowerCase().includes(q));
}
