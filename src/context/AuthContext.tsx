import React, { createContext, useContext, useState, useEffect } from 'react';
import type { AppUser } from '../types';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  currentUser: AppUser | null;
  isAdmin: boolean;
  isCoordinatorOrAdmin: boolean;
  isLoading: boolean;
  login: (username: string, passwordHash: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  refreshCurrentUser: () => Promise<void>;
  refreshUsers: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // ALWAYS start logged out - require active login every session
    try {
      localStorage.removeItem('cotripar_auth_user');
      sessionStorage.removeItem('cotripar_auth_user');
    } catch {
      // ignore
    }
    setCurrentUser(null);
    setIsLoading(false);
  }, []);

  const login = async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase.rpc('app_login', {
        p_username: username.trim(),
        p_password: password.trim()
      });

      if (error || !data || !Array.isArray(data) || data.length === 0) {
        return { success: false, error: 'Usuario o contraseña incorrectos' };
      }

      const row = data[0];
      const user: AppUser = {
        id: row.id,
        nombre: row.nombre,
        username: row.username,
        rol: row.rol,
        activo: row.activo,
        created_at: row.created_at
      };

      setCurrentUser(user);
      return { success: true };
    } catch {
      return { success: false, error: 'Error de conexión con el servidor.' };
    }
  };

  const logout = () => {
    try {
      localStorage.removeItem('cotripar_auth_user');
      sessionStorage.removeItem('cotripar_auth_user');
    } catch {
      // ignore
    }
    setCurrentUser(null);
  };

  const refreshCurrentUser = async () => {
    if (!currentUser) return;
    try {
      const { data } = await supabase
        .from('app_usuarios')
        .select('id, nombre, username, rol, activo, created_at')
        .eq('id', currentUser.id)
        .single();

      if (data) {
        setCurrentUser(data as AppUser);
      }
    } catch {
      // ignore
    }
  };

  const refreshUsers = async () => {
    // No-op: pre-authentication user listing removed for security (V.2.7)
  };

  const isAdmin = currentUser?.rol === 'admin';
  const isCoordinatorOrAdmin = currentUser?.rol === 'admin' || currentUser?.rol === 'coordinador';

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAdmin,
        isCoordinatorOrAdmin,
        isLoading,
        login,
        logout,
        refreshCurrentUser,
        refreshUsers
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
