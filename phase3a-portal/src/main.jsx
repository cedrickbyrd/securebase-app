import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import BRANDING from './config/branding';
import './index.css';

// Set document title dynamically from branding config
document.title = `${BRANDING.productName} - Customer Portal`;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
