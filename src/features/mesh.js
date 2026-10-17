/**
 * Entry "Connections": links entries that share distinctive words, computed
 * entirely on this device from already-decrypted text (TF-IDF, no AI service).
 */
const STOPWORDS = new Set(
  ('the and for are but not you your was were with that this have has had from they them then than what when where which while will would there their about into over after before just like very also been being can could should our out its his her she him who why how all any some more most such only own same too off per via use used using day today').split(' ')
);

export function tokenize(text) {
  return (String(text || '').toLowerCase().match(/[\p{L}\p{M}\p{N}]+/gu) || []).filter(
    (t) => t.length >= 3 && !STOPWORDS.has(t) && !/^\d+$/.test(t)
  );
}

/**
 * @param {Array<{id:number|string, title:string, body:string}>} entries
 * @returns {{nodes: Array<{id, title, terms: string[], degree: number}>, edges: Array<{a, b, shared: string[], weight: number}>}}
 */
export function buildMesh(entries, { maxNodes = 60, topTerms = 8, minShared = 2 } = {}) {
  const docs = entries.slice(-maxNodes).map((e) => {
    const tf = new Map();
    for (const t of tokenize(`${e.title} ${e.title} ${e.body}`)) tf.set(t, (tf.get(t) || 0) + 1);
    return { id: e.id, title: e.title || 'Untitled entry', tf };
  });
  const df = new Map();
  for (const d of docs) for (const t of d.tf.keys()) df.set(t, (df.get(t) || 0) + 1);
  const n = docs.length || 1;

  const nodes = docs.map((d) => {
    const scored = [...d.tf.entries()]
      // a word in EVERY entry says nothing; a word only here links nothing - both score low
      .map(([t, f]) => [t, f * Math.log(1 + n / df.get(t)) * (df.get(t) > 1 ? 1 : 0.4)])
      .sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1));
    return { id: d.id, title: d.title, terms: scored.slice(0, topTerms).map(([t]) => t), degree: 0 };
  });

  const edges = [];
  for (let i = 0; i < nodes.length; i += 1) {
    const setI = new Set(nodes[i].terms);
    for (let j = i + 1; j < nodes.length; j += 1) {
      const shared = nodes[j].terms.filter((t) => setI.has(t));
      if (shared.length >= minShared) {
        edges.push({ a: nodes[i].id, b: nodes[j].id, shared, weight: shared.length });
        nodes[i].degree += 1;
        nodes[j].degree += 1;
      }
    }
  }
  return { nodes, edges };
}

/** Small deterministic spring layout inside [pad, size-pad]. Returns Map id -> {x, y}. */
export function layoutMesh(nodes, edges, width = 600, height = 420, pad = 36) {
  const pos = new Map();
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) / 2 - pad;
  nodes.forEach((nd, i) => {
    const angle = (2 * Math.PI * i) / Math.max(nodes.length, 1);
    pos.set(nd.id, { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle), vx: 0, vy: 0 });
  });
  const k = Math.sqrt((width * height) / Math.max(nodes.length, 1)) * 0.6;
  for (let iter = 0; iter < 120; iter += 1) {
    const ids = nodes.map((nd) => nd.id);
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        const a = pos.get(ids[i]);
        const b = pos.get(ids[j]);
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        const dist = Math.max(Math.hypot(dx, dy), 0.01);
        const force = (k * k) / dist;
        dx /= dist;
        dy /= dist;
        a.vx += dx * force; a.vy += dy * force;
        b.vx -= dx * force; b.vy -= dy * force;
      }
    }
    for (const e of edges) {
      const a = pos.get(e.a);
      const b = pos.get(e.b);
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.max(Math.hypot(dx, dy), 0.01);
      const force = (dist * dist) / k;
      a.vx += (dx / dist) * force; a.vy += (dy / dist) * force;
      b.vx -= (dx / dist) * force; b.vy -= (dy / dist) * force;
    }
    const temp = 12 * (1 - iter / 120) + 0.5;
    for (const p of pos.values()) {
      p.x += Math.max(-temp, Math.min(temp, p.vx * 0.05));
      p.y += Math.max(-temp, Math.min(temp, p.vy * 0.05));
      p.x += (cx - p.x) * 0.01;
      p.y += (cy - p.y) * 0.01;
      p.x = Math.min(width - pad, Math.max(pad, p.x));
      p.y = Math.min(height - pad, Math.max(pad, p.y));
      p.vx = 0; p.vy = 0;
    }
  }
  return new Map([...pos.entries()].map(([id, p]) => [id, { x: Math.round(p.x), y: Math.round(p.y) }]));
}
