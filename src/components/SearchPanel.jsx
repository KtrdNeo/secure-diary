import { useState, useEffect, useRef } from 'react';
import { useSearch } from '../search/SearchIndexProvider.jsx';
import styles from './SearchPanel.module.css';

export default function SearchPanel({ onSelectEntry, onClose }) {
  const { ready, search } = useSearch();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    setResults(search(query));
  }, [query, search]);

  return (
    <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.panel} role="dialog" aria-modal="true" aria-label="Search entries">
        <input
          ref={inputRef}
          type="search"
          className={styles.input}
          placeholder={ready ? 'Search your diary…' : 'Building search index…'}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={!ready}
        />

        {query.trim() && results.length === 0 && (
          <p className={styles.empty}>No entries match &ldquo;{query}&rdquo;.</p>
        )}

        <ul className={styles.results}>
          {results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                className={styles.result}
                onClick={() => {
                  onSelectEntry(r.id);
                  onClose();
                }}
              >
                <span className={styles.resultTitle}>{r.title || 'Untitled entry'}</span>
                {r.createdAt && (
                  <span className={styles.resultDate}>{new Date(r.createdAt).toLocaleDateString()}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
