import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { APP_NAME, APP_VERSION, APP_CREDIT } from './config/legal.js';

// Self-hosted fonts (no Google Fonts CDN) - keeps the app fully
// functional offline as a PWA and avoids leaking user IPs to a third
// party, consistent with the zero-knowledge/privacy-first design.
import '@fontsource-variable/fraunces/full.css';
import '@fontsource/source-serif-4/400.css';
import '@fontsource/source-serif-4/600.css';
import '@fontsource-variable/work-sans';

import './index.css';
import './theme/themes.css';

// Visible, harmless attribution banner (see CHECKPOINT_SUMMARY.md for why
// this replaces a hidden "freeze on tamper" mechanism).
// eslint-disable-next-line no-console
console.log(
  `%c${APP_NAME} v${APP_VERSION}%c\n${APP_CREDIT}`,
  'font-weight:bold;font-size:14px;',
  'font-size:12px;color:#8a6d3b;'
);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
