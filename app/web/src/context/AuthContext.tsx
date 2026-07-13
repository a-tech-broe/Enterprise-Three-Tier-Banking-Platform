import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api } from '../api/client';

interface User {
  id: string;
  email: string;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  register: (email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    const token = localStorage.getItem('skybroe_token');
    if (!token) { setLoading(false); return; }

    api.auth.me()
      .then(({ user }) => setUser(user))
      .catch(() => localStorage.removeItem('skybroe_token'))
      .finally(() => setLoading(false));
  }, []);

  async function register(email: string, password: string) {
    const { token, user } = await api.auth.register(email, password);
    localStorage.setItem('skybroe_token', token);
    setUser(user);
  }

  async function login(email: string, password: string) {
    const { token, user } = await api.auth.login(email, password);
    localStorage.setItem('skybroe_token', token);
    setUser(user);
  }

  function logout() {
    localStorage.removeItem('skybroe_token');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, register, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
