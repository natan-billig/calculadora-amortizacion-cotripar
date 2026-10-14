import React, { useState, useEffect } from 'react';
import type { AppUser, UserRole } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Users, UserPlus, Shield, User, Key, Check, RefreshCw } from 'lucide-react';

interface UserManagerModalProps {
  showToast: (msg: string) => void;
}

export const UserManagerModal: React.FC<UserManagerModalProps> = ({ showToast }) => {
  const { refreshUsers } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // New user form state
  const [nombre, setNombre] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [rol, setRol] = useState<UserRole>('vendedor');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('app_usuarios')
        .select('*')
        .order('created_at', { ascending: true });

      if (!error && data) {
        setUsers(data as AppUser[]);
      }
    } catch {
      // offline
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !username.trim() || !password.trim()) {
      showToast('Por favor complete todos los campos obligatorios');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('app_usuarios')
        .insert({
          nombre: nombre.trim(),
          username: username.trim().toLowerCase(),
          password_hash: password.trim(),
          rol,
          activo: true
        });

      if (!error) {
        showToast(`Usuario "${username}" creado exitosamente`);
        setNombre('');
        setUsername('');
        setPassword('');
        setRol('vendedor');
        loadUsers();
        refreshUsers();
      } else {
        showToast('Error: el nombre de usuario ya está registrado');
      }
    } catch {
      showToast('Error de conexión con Supabase');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (user: AppUser) => {
    try {
      const { error } = await supabase
        .from('app_usuarios')
        .update({ activo: !user.activo })
        .eq('id', user.id);

      if (!error) {
        setUsers(prev =>
          prev.map(u => (u.id === user.id ? { ...u, activo: !user.activo } : u))
        );
        showToast(`Usuario ${user.username} ${!user.activo ? 'activado' : 'desactivado'}`);
        refreshUsers();
      }
    } catch {
      showToast('Error al actualizar estado del usuario');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-cotripar-700" />
            <span>Gestión de Usuarios y Accesos Cotripar</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Administración de credenciales y roles para asesores y administradores de crédito.
          </p>
        </div>

        <button
          onClick={loadUsers}
          className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 transition-colors self-start sm:self-auto"
          title="Refrescar usuarios"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-cotripar-700' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Add User Form */}
        <div className="lg:col-span-5">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2 pb-3 border-b border-slate-100">
              <UserPlus className="w-4 h-4 text-cotripar-700" />
              Nuevo Asesor o Usuario
            </h3>

            <form onSubmit={handleCreateUser} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Nombre Completo *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Ej: Carlos Benítez"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-cotripar-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Nombre de Usuario (Login) *
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase())}
                  placeholder="Ej: cbenitez"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-cotripar-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Contraseña *
                </label>
                <div className="relative">
                  <Key className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-cotripar-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Rol en la Plataforma *
                </label>
                <select
                  value={rol}
                  onChange={(e) => setRol(e.target.value as UserRole)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-cotripar-600 focus:outline-none font-semibold text-slate-800"
                >
                  <option value="vendedor">Vendedor / Asesor Comercial</option>
                  <option value="admin">Administrador (Acceso Total)</option>
                </select>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 px-4 text-xs font-bold text-white bg-cotripar-700 hover:bg-cotripar-800 rounded-xl shadow-sm flex items-center justify-center gap-2 transition-all"
                >
                  <Check className="w-4 h-4" />
                  <span>Crear Usuario en Supabase</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right: Users Table */}
        <div className="lg:col-span-7">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                Usuarios Registrados ({users.length})
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <th className="py-2.5 px-4">Nombre</th>
                    <th className="py-2.5 px-3">Usuario</th>
                    <th className="py-2.5 px-3">Rol</th>
                    <th className="py-2.5 px-3 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900 flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center justify-center uppercase">
                          {u.nombre.substring(0, 2)}
                        </div>
                        <span>{u.nombre}</span>
                      </td>

                      <td className="py-3 px-3 text-slate-600">
                        @{u.username}
                      </td>

                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            u.rol === 'admin'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          <Shield className="w-3 h-3" />
                          <span className="capitalize">{u.rol}</span>
                        </span>
                      </td>

                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => handleToggleActive(u)}
                          className={`px-2 py-0.5 text-[10px] font-bold rounded-full transition-colors ${
                            u.activo
                              ? 'bg-green-100 text-green-800'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {u.activo ? 'Activo' : 'Inactivo'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
