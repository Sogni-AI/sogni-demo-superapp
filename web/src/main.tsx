import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

/**
 * Boot-time theming to prevent white flashes or white "Moto" UI sheet on Android.
 * We apply a dark background and set the theme-color *before* React mounts.
 */
(function bootstrapTheme() {
  const BG = '#0e0f11';

  // Ensure a dark background ASAP (before React)
  const bootStyle = document.createElement('style');
  bootStyle.textContent = `
    :root { color-scheme: dark; }
    html, body, #root { height: 100%; background: ${BG}; }
    body { margin: 0; -webkit-tap-highlight-color: transparent; }
  `;
  document.head.appendChild(bootStyle);

  // Android / Moto system UI color (prevents white pop-up/sheet)
  let themeMeta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
  if (!themeMeta) {
    themeMeta = document.createElement('meta');
    themeMeta.name = 'theme-color';
    document.head.appendChild(themeMeta);
  }
  themeMeta.content = BG;

  // iOS status bar preference (safe to set at runtime)
  let appleBar = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]') as HTMLMetaElement | null;
  if (!appleBar) {
    appleBar = document.createElement('meta');
    appleBar.name = 'apple-mobile-web-app-status-bar-style';
    document.head.appendChild(appleBar);
  }
  // "black-translucent" keeps the OS chrome dark
  appleBar.content = 'black-translucent';
})();

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
