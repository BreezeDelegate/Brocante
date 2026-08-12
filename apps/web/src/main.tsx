import React from 'react';
import ReactDOM from 'react-dom/client';

import { App } from './App';
import { isNativeApp } from './platform';
import './styles.css';

if ('serviceWorker' in navigator && import.meta.env.PROD && !isNativeApp()) {
  navigator.serviceWorker.register('/sw.js').catch(() => undefined);
}

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
