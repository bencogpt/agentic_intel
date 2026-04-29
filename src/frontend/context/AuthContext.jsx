import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { login as authLogin, logout as authLogout, getMe } from '../services/auth.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMe()
      .then(u => setUser(u))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (username, password) => {
    const u = await authLogin(username, password);
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(() => {
    authLogout();
    setUser(null);
    window.location.href = '/login';
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
