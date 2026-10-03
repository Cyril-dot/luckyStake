import { initVersionCheck } from './lib/version-check';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
initVersionCheck();

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
