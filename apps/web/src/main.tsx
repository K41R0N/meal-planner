import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import './import.css';

const element = document.getElementById('root');
if (!element) throw new Error('Missing app root');
createRoot(element).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  // A full offline book includes 100 thumbnails. Do not let those background
  // downloads compete with the first recipe/seed on a slow initial connection.
  const activateOffline = () => {
    const usable = document.querySelector('.mealbook-ui');
    if (!usable) {
      window.setTimeout(activateOffline, 500);
      return;
    }
    window.setTimeout(() => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        console.warn('Offline caching was not activated. Reconnect to download the app again.');
      });
    }, 2500);
  };
  if (document.readyState === 'complete') activateOffline();
  else window.addEventListener('load', activateOffline, { once: true });
}
