import { useEffect, useMemo, useState } from 'react';
import Modal from './Modal.jsx';
import { db } from '../db/schema.js';
import { useSessionKey } from '../session/SessionKeyProvider.jsx';
import { decryptData, decryptBinary } from '../utils/crypto.js';
import { decodeYDoc, yDocToPlainText } from './editor/yjsUtils.js';
import { isSealed } from '../features/capsule.js';
import { buildMesh, layoutMesh } from '../features/mesh.js';
import styles from './panels.module.css';

const W = 600;
const H = 420;

/** "Connections": how your entries relate, from shared words (computed on this device). */
export default function MeshPanel({ onClose, onOpenEntry }) {
  const { cryptoKey } = useSessionKey();
  const [entries, setEntries] = useState(null);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const rows = await db.entries.orderBy('createdAt').filter((e) => e.isDeleted === 0).toArray();
      const out = [];
      for (const row of rows) {
        try {
          const t = row.titlePayload ? await decryptData(row.titlePayload, cryptoKey) : { title: '' };
          let body = '';
          if (row.contentPayload && !isSealed(t.sealUntil)) {
            body = yDocToPlainText(decodeYDoc(new Uint8Array(await decryptBinary(row.contentPayload, cryptoKey))));
          }
          out.push({ id: row.id, title: t.title || '', body });
        } catch {
          /* unreadable entry: leave it out of the map */
        }
      }
      if (!cancelled) setEntries(out);
    })();
    return () => {
      cancelled = true;
    };
  }, [cryptoKey]);

  const mesh = useMemo(() => (entries ? buildMesh(entries) : null), [entries]);
  const pos = useMemo(() => (mesh ? layoutMesh(mesh.nodes, mesh.edges, W, H) : null), [mesh]);
  const selNode = mesh?.nodes.find((n) => n.id === selected) ?? null;
  const related = useMemo(() => {
    if (!mesh || selected == null) return [];
    return mesh.edges
      .filter((e) => e.a === selected || e.b === selected)
      .map((e) => ({ other: mesh.nodes.find((n) => n.id === (e.a === selected ? e.b : e.a)), shared: e.shared }))
      .sort((x, y) => y.shared.length - x.shared.length);
  }, [mesh, selected]);

  const short = (t) => (t.length > 16 ? `${t.slice(0, 15)}…` : t);

  return (
    <Modal title="Connections" onClose={onClose} wide>
      <p className={styles.note}>
        Entries that share distinctive words are linked. Worked out on this device only - nothing leaves it.
      </p>
      {!mesh && <p className={styles.note}>Reading your entries…</p>}
      {mesh && mesh.nodes.length < 2 && (
        <p className={styles.note}>Write a few more entries and their connections will appear here.</p>
      )}
      {mesh && mesh.nodes.length >= 2 && (
        <>
          <svg viewBox={`0 0 ${W} ${H}`} className={styles.mesh} role="group" aria-label="Entry connections map">
            {mesh.edges.map((e) => (
              <line
                key={`${e.a}-${e.b}`}
                x1={pos.get(e.a).x}
                y1={pos.get(e.a).y}
                x2={pos.get(e.b).x}
                y2={pos.get(e.b).y}
                className={selected != null && (e.a === selected || e.b === selected) ? styles.edgeOn : styles.edge}
                strokeWidth={Math.min(1 + e.weight * 0.6, 4)}
              />
            ))}
            {mesh.nodes.map((n) => {
              const { x, y } = pos.get(n.id);
              const r = 9 + Math.min(n.degree, 6) * 1.5;
              return (
                <g
                  key={n.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`${n.title}, ${n.degree} connection${n.degree === 1 ? '' : 's'}`}
                  aria-pressed={selected === n.id}
                  className={styles.node}
                  onClick={() => setSelected(n.id)}
                  onKeyDown={(ev) => {
                    if (ev.key === 'Enter' || ev.key === ' ') {
                      ev.preventDefault();
                      setSelected(n.id);
                    }
                  }}
                >
                  <circle cx={x} cy={y} r={Math.max(r, 16)} fill="transparent" />
                  <circle cx={x} cy={y} r={r} className={selected === n.id ? styles.dotOn : styles.dot} />
                  <text x={x} y={y + r + 12} textAnchor="middle" className={styles.nodeLabel}>
                    {short(n.title)}
                  </text>
                </g>
              );
            })}
          </svg>
          <div aria-live="polite">
            {selNode ? (
              <>
                <p className={styles.note}>
                  <strong>{selNode.title}</strong> - {related.length ? 'related to:' : 'no strong links yet.'}
                </p>
                <ul className={styles.relatedList}>
                  {related.map(({ other, shared }) => (
                    <li key={other.id}>
                      <button type="button" className={styles.button} onClick={() => setSelected(other.id)}>
                        {other.title}
                      </button>
                      <span className={styles.note}> {shared.slice(0, 4).join(', ')}</span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className={styles.button}
                  onClick={() => {
                    onOpenEntry(selNode.id);
                    onClose();
                  }}
                >
                  Open this entry
                </button>
              </>
            ) : (
              <p className={styles.note}>Tap an entry to see what it connects to.</p>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}
