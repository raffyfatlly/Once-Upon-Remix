
import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';

// Automatically handle clean URL fallback for HashRouter (e.g., /cakenic -> /#/cakenic)
if (typeof window !== 'undefined' && window.location.pathname.startsWith('/cakenic')) {
  const cleanPath = window.location.pathname.replace(/\/+$/, '');
  const searchAndHash = window.location.search + (window.location.hash || '');
  window.location.replace(`/#${cleanPath}${searchAndHash}`);
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
);
