import { createContext, useContext, useState } from 'react';
import { logout as apiLogout } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('kpi_user')); } catch { return null; }
  });

  const login = (userData, token) => {
    setUser(userData);
    localStorage.setItem('kpi_user', JSON.stringify(userData));
    localStorage.setItem('kpi_token', token);
  };

  const logout = () => {
    apiLogout().catch(() => {});
    setUser(null);
    localStorage.removeItem('kpi_user');
    localStorage.removeItem('kpi_token');
  };

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
