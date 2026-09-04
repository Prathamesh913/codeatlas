import React from 'react';
import { createRoot } from 'react-dom/client';
import { LoginButton } from './components/LoginButton';
import { useAuthStore } from './store/authStore';
import './styles/global.css';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<LoginButton />);
}

export function initApp() {
  const store = useAuthStore.getState();
  console.log('App initialized', store.isAuthenticated);
}
