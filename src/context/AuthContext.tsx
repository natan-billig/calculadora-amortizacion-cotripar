import React, { createContext, useContext, useState, useEffect } from 'react';
import type { AppUser } from '../types';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  currentUser: AppUser | null;
  isAdmin: boolean;
  isLoading: boolean;
  login: (username: string, passwordHash: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  updateCurrentUser: (user: AppUser) => void;
  availableUsers: AppUser[];
  refreshUsers: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [availableUsers, setAvailableUsers] = useState<AppUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('app_usuarios')
        .select('id, nombre, username, rol, activo, created_at')
        .eq('activo', true)
        .order('nombre');

      if (!error && data && data.length > 0) {
        setAvailableUsers(data as AppUser[]);
        return data as AppUser[];
      }
    } catch (err) {
      console.warn('Error fetching users from Supabase:', err);
    }

    const fallback: AppUser[] = [
      { id: '6aabb1d7-684b-427c-a2e2-e6e7e73ced2d', nombre: 'Miguel Abellá', username: 'miguel', rol: 'admin', activo: true },
      { id: '3b11cb0a-6d10-4675-bc55-97929ecc4731', nombre: 'Vendedor Cotripar', username: 'vendedor1', rol: 'vendedor', activo: true }
    ];
    setAvailableUsers(fallback);
    return fallback;
  };

  useEffect(() => {
    // ALWAYS start logged out - require active login every session
    try {
      localStorage.removeItem('cotripar_auth_user');
      sessionStorage.removeItem('cotripar_auth_user');
    } catch {
      // ignore
    }
    setCurrentUser(null);
    fetchUsers().finally(() => {
      setIsLoading(false);
    });
  }, []);

  const login = async (username: string, passwordHash: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase
        .from('app_usuarios')
        .select('*')
        .eq('username', username.trim().toLowerCase())
        .eq('activo', true)
        .single();

      if (error || !data) {
        return { success: false, error: 'Usuario no encontrado o inactivo.' };
      }

      if (data.password_hash !== passwordHash.trim()) {
        return { success: false, error: 'Contraseña incorrecta.' };
      }

      const user: AppUser = {
        id: data.id,
        nombre: data.nombre,
        username: data.username,
        rol: data.rol,
        activo: data.activo,
        created_at: data.created_at
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

  const updateCurrentUser = (user: AppUser) => {
    setCurrentUser(user);
  };

  const refreshUsers = async () => {
    await fetchUsers();
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAdmin: currentUser?.rol === 'admin',
        isLoading,
        login,
        logout,
        updateCurrentUser,
        availableUsers,
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
