import { createContext, useContext, useEffect, useState } from "react";
import { authService } from "../services/authService";
import type { LoginPayload, RegisterPayload } from "../services/authService";

export interface User {
  user_id: string;
  email: string;
  role: 'super' | 'admin' | 'user';
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  // role: string;
  // createdBy: string;
  // managed_ids: string[];
  login: (data: LoginPayload) => Promise<void>;
  register: (data: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const isAuthenticated = !!user;

  const loadUser = async () => {
    const token = localStorage.getItem("access_token");
    if (!token) {
    setUser(null);
    setLoading(false);
    return;
    }
    try {
      const res = await authService.getCurrentUser();
      setUser(res.data);
    } catch {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUser();
  }, []);

  const login = async (data: LoginPayload) => {
    const res = await authService.login(data);

    localStorage.setItem("access_token", res.data.access_token);
    localStorage.setItem("refresh_token", res.data.refresh_token);

    await loadUser();
  };

  const register = async (data: RegisterPayload) => {
    await authService.register(data);
  };

  const logout = async () => {
    try {
      const refresh = localStorage.getItem("refresh_token");
      if (refresh) {
        await authService.logout(refresh);
      }
    } finally {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        loading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
};
