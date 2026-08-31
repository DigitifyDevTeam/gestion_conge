import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, AuthState } from '@/types/auth';
import {
  activateAccountRequest,
  fetchMe,
  loginRequest,
  logoutRequest,
  registerRequest,
  updateMe,
  verifyEmailRequest,
} from '@/api/auth';
import { ApiError, getAccessToken } from '@/api/client';

interface SignUpPayload {
  name: string;
  email: string;
  password: string;
  department?: string;
  position?: string;
}

interface AuthContextType extends AuthState {
  login: (
    email: string,
    password: string,
  ) => Promise<{ ok: boolean; error?: string; needsVerification?: boolean; email?: string }>;
  signup: (
    payload: SignUpPayload,
  ) => Promise<{ ok: boolean; error?: string; needsVerification?: boolean; email?: string }>;
  verifyEmail: (
    email: string,
    code: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  activateAccount: (
    token: string,
    password: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  updateProfile: (payload: {
    name?: string;
    department?: string;
    position?: string;
    avatar?: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  isAdmin: () => boolean;
  isEmployee: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const restore = async () => {
      const token = getAccessToken();
      const storedUser = localStorage.getItem('user');
      if (!token) {
        setIsLoading(false);
        return;
      }
      if (storedUser) {
        try {
          setUser(JSON.parse(storedUser));
        } catch {
          localStorage.removeItem('user');
        }
      }
      try {
        const me = await fetchMe();
        setUser(me);
      } catch {
        setUser(null);
        logoutRequest();
      } finally {
        setIsLoading(false);
      }
    };
    restore();
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const loggedIn = await loginRequest(email, password);
      setUser(loggedIn);
      setIsLoading(false);
      return { ok: true };
    } catch (err) {
      setIsLoading(false);
      if (err instanceof ApiError) {
        const extended = err as ApiError & { code?: string; email?: string };
        if (extended.code === 'email_not_verified') {
          return {
            ok: false,
            needsVerification: true,
            email: extended.email || email,
            error: err.message,
          };
        }
        return { ok: false, error: err.message || 'Email ou mot de passe incorrect' };
      }
      return { ok: false, error: 'Email ou mot de passe incorrect' };
    }
  };

  const signup = async (payload: SignUpPayload) => {
    setIsLoading(true);
    try {
      const result = await registerRequest(payload);
      setIsLoading(false);
      return {
        ok: true,
        needsVerification: !!result.requires_verification,
        email: result.email,
      };
    } catch (err) {
      setIsLoading(false);
      const message =
        err instanceof ApiError ? err.message : "Impossible de créer le compte.";
      return { ok: false, error: message };
    }
  };

  const verifyEmail = async (email: string, code: string) => {
    setIsLoading(true);
    try {
      const loggedIn = await verifyEmailRequest(email, code);
      setUser(loggedIn);
      setIsLoading(false);
      return { ok: true };
    } catch (err) {
      setIsLoading(false);
      const message =
        err instanceof ApiError ? err.message : 'Code invalide.';
      return { ok: false, error: message };
    }
  };

  const activateAccount = async (token: string, password: string) => {
    setIsLoading(true);
    try {
      const loggedIn = await activateAccountRequest(token, password);
      setUser(loggedIn);
      setIsLoading(false);
      return { ok: true };
    } catch (err) {
      setIsLoading(false);
      const message =
        err instanceof ApiError ? err.message : 'Activation impossible.';
      return { ok: false, error: message };
    }
  };

  const logout = () => {
    setUser(null);
    logoutRequest();
  };

  const updateProfile = async (payload: {
    name?: string;
    department?: string;
    position?: string;
    avatar?: string;
  }) => {
    try {
      const updated = await updateMe(payload);
      setUser(updated);
      return { ok: true };
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Mise à jour impossible.';
      return { ok: false, error: message };
    }
  };

  const isAdmin = () => user?.role === 'admin';
  const isEmployee = () => user?.role === 'employee';

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    signup,
    verifyEmail,
    activateAccount,
    logout,
    updateProfile,
    isAdmin,
    isEmployee,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
