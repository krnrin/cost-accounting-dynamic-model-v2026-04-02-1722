import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { db } from './data/db';
import { seedE281Project } from './data/seeds/e281';
import App from './App';
import './index.css';

// 全局强制开启深色科技模式 (Cyberpunk Glassmorphism Vibe)
document.body.setAttribute('theme-mode', 'dark');

// Force unregister any rogue service workers from production builds on localhost
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function(registrations) {
    for(let registration of registrations) {
      registration.unregister();
    }
  });
}

// Auto-seed on first launch
db.on('ready', async () => {
  const e281 = await db.projects.get('e281-quote');
  if (!e281) {
    await seedE281Project();
  }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
