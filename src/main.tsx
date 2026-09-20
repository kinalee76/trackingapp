import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { defineCustomElements } from 'jeep-sqlite/loader'
import './index.css'
import App from './App.tsx'

// Registers the <jeep-sqlite> web component, used only when running in a
// browser (npm run dev) so the SQLite service has a storage backend to
// initialize against. No-op on native Android.
defineCustomElements(window)

// Capacitor's console bridge only reports the failing line/column for an
// uncaught error, not a stack — not enough to locate a crash inside a
// minified bundle (see docs/reports/14-white-screen-crash.md for a case
// this mattered). Logging the full stack here so it shows up in
// `adb logcat` via Capacitor/Console.
window.addEventListener('error', (event) => {
  console.error('[global error]', event.error?.stack ?? event.message);
});
window.addEventListener('unhandledrejection', (event) => {
  console.error('[unhandled rejection]', event.reason?.stack ?? event.reason);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
