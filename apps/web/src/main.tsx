import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

const element=document.getElementById('root');
if (!element) throw new Error('Missing app root');
createRoot(element).render(<React.StrictMode><App /></React.StrictMode>);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Live content still works; Settings can explain installation requirements.
      console.warn('Offline caching was not activated. Reconnect to download the app again.');
    });
  });
}
