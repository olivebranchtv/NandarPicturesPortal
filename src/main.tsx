import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'react-hot-toast';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        success: { style: { background: '#f0fdf4', border: '1px solid #86efac', color: '#166534' } },
        error: { style: { background: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b' } },
      }}
    />
  </StrictMode>
);
