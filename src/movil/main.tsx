import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { applyTheme, resolveInitialTheme } from '../theme';
import '../index.css';
import './mobile.css';

applyTheme(resolveInitialTheme(), false);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
