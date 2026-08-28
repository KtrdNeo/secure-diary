import { Component } from 'react';
import styles from './ErrorBoundary.module.css';

/**
 * src/health/ErrorBoundary.jsx
 *
 * Must be a class component - React has no hook equivalent for
 * componentDidCatch/getDerivedStateFromError as of React 19.
 *
 * Used at two levels in this app (see App.jsx and DiaryShell.jsx):
 *  - one wrapping the whole app, for catastrophic failures
 *  - one wrapping each individual EntryEditor, so a rendering crash in
 *    one entry (e.g. from a genuinely corrupted record) can't take down
 *    every other entry along with it - the actual "self-healing" idea
 *    behind this file: isolate a failure to the smallest unit that
 *    contains it, rather than one crash meaning the whole app is gone.
 *
 * Never touches Dexie, encryption, or any state that could itself fail
 * - the one job here is "render literally anything other than a blank
 * white screen," so it has to stay trivially simple to have any chance
 * of working when something else has already gone wrong.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught:', error, info?.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const { level = 'app', label } = this.props;

    if (level === 'entry') {
      return (
        <div className={styles.entryFallback}>
          <p className={styles.entryTitle}>This {label || 'entry'} couldn&rsquo;t be displayed.</p>
          <p className={styles.entryHint}>
            Your other entries are unaffected, and this one&rsquo;s data is still safely stored
            and encrypted - it just failed to render. Try the Admin panel&rsquo;s diagnostics for
            more detail.
          </p>
          <button type="button" className={styles.retryButton} onClick={this.handleReset}>
            Try again
          </button>
        </div>
      );
    }

    return (
      <div className={styles.appFallback}>
        <div className={styles.appCard}>
          <h1 className={styles.appTitle}>Something went wrong</h1>
          <p className={styles.appHint}>
            Your entries are safe - everything here is stored locally and encrypted, independent
            of this screen. Reloading usually fixes this.
          </p>
          <button type="button" className={styles.reloadButton} onClick={() => window.location.reload()}>
            Reload
          </button>
          {this.state.error && (
            <details className={styles.details}>
              <summary>Technical details</summary>
              <pre className={styles.errorText}>{String(this.state.error?.stack || this.state.error)}</pre>
            </details>
          )}
        </div>
      </div>
    );
  }
}
