import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import { startPwaAutoUpdate } from './pwaUpdate';
import { api } from './lib/api';

// Wake the API server before anything waits on it (see api.warmUp).
api.warmUp();

// Dev/ngrok: drop any leftover production service worker so the phone loads Vite.
if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  void navigator.serviceWorker.getRegistrations().then((regs) => {
    for (const reg of regs) void reg.unregister();
  });
  if ('caches' in window) {
    void caches.keys().then((keys) => {
      for (const key of keys) void caches.delete(key);
    });
  }
}

if (import.meta.env.PROD) startPwaAutoUpdate();

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Hide the inline splash (index.html) once React has painted its first frame.
requestAnimationFrame(() =>
  requestAnimationFrame(() => (window as Window & { __bmiAppReady?: () => void }).__bmiAppReady?.())
);
