import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

const root = createRoot(document.getElementById('root'));

root.render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Ocultar splash screen tras el primer render de React
requestAnimationFrame(() => {
  const splash = document.getElementById('splash');
  if (splash) {
    splash.classList.add('splash--hidden');
    splash.addEventListener('transitionend', () => splash.remove(), { once: true });
  }
});
