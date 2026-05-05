// ============================================================
// TaskFlow — Vite-ready version (src/App.jsx)
// For production: npm create vite@latest -- --template react
// Replace src/App.jsx with this file
// npm install && npm run dev
// ============================================================

import { useState, useEffect, useCallback, createContext, useContext } from 'react';

// ── API helpers ──────────────────────────────────────────────
const API = import.meta.env.VITE_API_URL || 'team-task-manager-production-8056.up.railway.app';
const getToken = () => localStorage.getItem('tf_token');
const authHeaders = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` });

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: authHeaders(),
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}

// ── Auth Context ─────────────────────────────────────────────
const AuthCtx = createContext(null);
export function useAuth() { return useContext(AuthCtx); }

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('tf_user')); } catch { return null; }
  });

  const login = async (email, password) => {
    const data = await apiFetch('/auth/login', { method: 'POST', body: { email, password } });
    localStorage.setItem('tf_token', data.token);
    localStorage.setItem('tf_user', JSON.stringify(data.user));
    setUser(data.user);
  };

  const signup = async (name, email, password) => {
    const data = await apiFetch('/auth/signup', { method: 'POST', body: { name, email, password } });
    localStorage.setItem('tf_token', data.token);
    localStorage.setItem('tf_user', JSON.stringify(data.user));
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem('tf_token');
    localStorage.removeItem('tf_user');
    setUser(null);
  };

  return <AuthCtx.Provider value={{ user, login, signup, logout }}>{children}</AuthCtx.Provider>;
}

// All component code is identical to App.jsx (CDN version) from this point.
// The only differences are:
//   1. React hooks are imported above (not from window.React)
//   2. ReactDOM.createRoot is in src/main.jsx:
//
//      import React from 'react'
//      import ReactDOM from 'react-dom/client'
//      import App, { AuthProvider } from './App'
//      import './index.css'
//
//      ReactDOM.createRoot(document.getElementById('root')).render(
//        <React.StrictMode>
//          <AuthProvider><App /></AuthProvider>
//        </React.StrictMode>
//      )
//
// Copy all component definitions from App.jsx (CDN version) here.
// The SKILL is to paste all components between AuthProvider and the Root component.

export default function App() {
  // ... paste App() body from App.jsx here
  return <div>See App.jsx (CDN version) for full implementation</div>;
}
