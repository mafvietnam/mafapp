import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  getMe,
  loginWithSsoCode as loginSsoApi,
  logout as logoutApi,
  type AuthUser,
} from '../services/auth-service';

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginWithCode: (code: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getMe()
      .then(setUser)
      .finally(() => setIsLoading(false));
  }, []);

  const loginWithCode = useCallback(async (code: string) => {
    const ok = await loginSsoApi(code);
    if (ok) {
      const me = await getMe();
      setUser(me);
    }
    return ok;
  }, []);

  const logout = useCallback(async () => {
    setUser(null);
    await logoutApi(true); // full logout: clear JWT + WP session
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        loginWithCode,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
