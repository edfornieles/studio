import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ProgressProvider } from './state/progress';
import { activeWorld } from './worlds';
import './styles/global.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ProgressProvider levelIds={activeWorld.levels.map((l) => l.id)}>
      <App />
    </ProgressProvider>
  </StrictMode>,
);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
