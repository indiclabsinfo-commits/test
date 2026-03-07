import React from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

// 1. Immediate visual feedback
const rootEl = document.getElementById('root');
if (!rootEl) {
  document.body.innerHTML = "FATAL: No root element";
  throw new Error("No root element");
}

rootEl.innerHTML = '<div style="background: #333; color: #fff; padding: 20px;">Initializing Application...</div>';

// 2. Wrap React Mount in Async/Try-Catch to catch import errors
const mount = async () => {
  try {
    // Dynamic import to catch syntax errors in App or its dependencies
    const module = await import('./App');
    const App = module.default;

    console.log("App loaded, mounting...");
    createRoot(rootEl).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );

  } catch (err: any) {
    console.error("Failed to mount:", err);
    rootEl.innerHTML = `
      <div style="background: #900; color: #fff; padding: 20px; font-family: monospace;">
        <h1>CRITICAL LOAD ERROR</h1>
        <p>The application failed to start.</p>
        <pre>${err?.message || String(err)}</pre>
        ${err?.stack ? `<pre style="font-size: 10px; opacity: 0.8">${err.stack}</pre>` : ''}
      </div>
    `;
  }
};

mount();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.error('Service worker registration failed:', error);
    });
  });
}
