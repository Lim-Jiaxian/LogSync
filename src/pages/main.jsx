import '../pwa.js'; // first: registers the service worker and catches the install prompt
import React from 'react';
import { createRoot } from 'react-dom/client';
import Login from './login.jsx';
import App from '../../js/App.js';
import '../styles.css';

const Page = window.location.pathname === '/home' ? App : Login;

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Page />
  </React.StrictMode>
);
