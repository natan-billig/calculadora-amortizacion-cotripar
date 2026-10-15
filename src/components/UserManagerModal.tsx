import React, { useState, useEffect } from 'react';
import type { AppUser, UserRole } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Users, UserPlus, Shield, User, Key, Check, RefreshCw, Pencil, X, AlertCircle } from 'lucide-react';

interface UserManagerModalProps {
  showToast: (msg: string) => void;
}

export const UserManagerModal: React.FC<UserManagerModalProps> = ({ showToast }) => {
  const { currentUser, refreshUsers, refreshCurrentUser } = useAuth();

  // Security guard: Only Admin can access
  if (!currentUser || currentUser.rol !== 'admin') {
    return null;
  }

  const [users, setUsers] = useState<AppUser[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Form state (handles both create and edit)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nombre, setNombre] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [rol, setRol] = useState<UserRole>('vendedor');
  const [activo, setActivo] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const editingUser = users.find(u => u.id === editingId) || null;
  const isEditingAdmin = editingUser?.rol === 'admin';

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

  const handleStartEdit = (user: AppUser) => {
    setEditingId(user.id);
    setNombre(user.nombre);
    setUsername(user.username);
    setPassword(''); // NEVER populate password! Starts empty!
    setRol(user.rol);
    setActivo(user.activo);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setNombre('');
    setUsername('');
    setPassword('');
    setRol('vendedor');
    setActivo(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsSubmitting(true);
    try {
      if (editingId) {
        if (!nombre.trim() || !username.trim()) {
          showToast('Por favor complete el nombre y nombre de usuario');
          setIsSubmitting(false);
          return;
        }

        const isTargetAdmin = editingUser?.rol === 'admin';

        const updateData: Record<string, any> = {
          nombre: nombre.trim(),
          username: username.trim().toLowerCase(),
          rol: isTargetAdmin ? 'admin' : rol, // Blindagem: admin nunca pode ser rebaixado para vendedor
          activo: isTargetAdmin ? true : activo // Blindagem: admin nunca pode ser desativado
        };

        // REGRA CRÍTICA: Admin SÓ pode alterar senha de Vendedor!
        // Se a conta for Admin, ignora/bloqueia qualquer password_hash vindo deste painel
        if (!isTargetAdmin && password.trim() !== '') {
          updateData.password_hash = password.trim();
        }

        const { error } = await supabase
          .from('app_usuarios')
          .update(updateData)
          .eq('id', editingId);

        if (!error) {
          showToast('Usuario actualizado correctamente');
          if (currentUser.id === editingId) {
            await refreshCurrentUser();
          }

          handleCancelEdit();
          loadUsers();
          refreshUsers();
        } else {
          showToast('Error al actualizar: nombre de usuario en uso');
        }
      } else {
        if (!nombre.trim() || !username.trim() || !password.trim()) {
          showToast('Por favor complete todos los campos obligatorios');
          setIsSubmitting(false);
          return;
        }

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
          handleCancelEdit();
          loadUsers();
          refreshUsers();
        } else {
          showToast('Error: el nombre de usuario ya está registrado');
        }
      }
    } catch {
      showToast('Error de conexión con Supabase');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (user: AppUser) => {
    if (user.rol === 'admin') {
      showToast('Por seguridad, una cuenta Administradora no puede ser desactivada.');
      return;
    }

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
            Administración de credenciales, edición de nombres, logins y contraseñas.
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
        {/* Left: Add / Edit User Form */}
        <div className="lg:col-span-5">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                {editingId ? (
                  <>
                    <Pencil className="w-4 h-4 text-cotripar-700" />
                    <span>Editar Usuario</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4 text-cotripar-700" />
                    <span>Nuevo Asesor o Usuario</span>
                  </>
                )}
              </h3>
              {editingId && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="text-xs text-slate-400 hover:text-slate-600 font-semibold flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Cancelar</span>
                </button>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
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
                    placeholder="Ej: Miguel Abellá"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-cotripar-700 focus:outline-none"
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
                  placeholder="Ej: miguel"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-cotripar-700 focus:outline-none"
                />
              </div>

              {/* Password Block: Strictly protected if editing an Admin! */}
              {isEditingAdmin ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
                  <p className="font-bold flex items-center gap-1.5 text-amber-800">
                    <Shield className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>Protección de Cuenta Administradora</span>
                  </p>
                  <p className="text-[11px] leading-relaxed text-amber-800">
                    Por seguridad, las contraseñas de cuentas Administradoras no pueden ser modificadas desde este panel. Cada administrador debe usar la opción 'Cambiar mi Contraseña' en su propio perfil.
                  </p>
                </div>
              ) : (
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {editingId ? 'Nueva Contraseña (Opcional)' : 'Contraseña *'}
                  </label>
                  <div className="relative">
                    <Key className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                    <input
                      type="password"
                      required={!editingId}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={editingId ? 'Dejar en blanco para mantener la contraseña actual' : '••••••••'}
                      className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-cotripar-700 focus:outline-none"
                    />
                  </div>
                  {editingId && (
                    <p className="text-[10px] text-slate-400 mt-1">
                      Dejar en blanco para mantener la contraseña actual del usuario.
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Rol en la Plataforma *
                </label>
                <select
                  value={rol}
                  disabled={isEditingAdmin}
                  onChange={(e) => setRol(e.target.value as UserRole)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-cotripar-700 focus:outline-none font-semibold text-slate-800 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <option value="vendedor">Vendedor / Asesor Comercial</option>
                  <option value="coordinador">Coordinador de Ventas (Historial y Marcas)</option>
                  <option value="admin">Administrador (Acceso Total)</option>
                </select>
                {isEditingAdmin && (
                  <p className="text-[10px] text-amber-700 mt-1">
                    El rol de una cuenta Administradora no puede ser modificado desde este panel.
                  </p>
                )}
              </div>

              {editingId && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="userActivo"
                    disabled={isEditingAdmin}
                    checked={activo}
                    onChange={(e) => setActivo(e.target.checked)}
                    className="rounded text-cotripar-700 focus:ring-cotripar-700 disabled:opacity-50"
                  />
                  <label
                    htmlFor="userActivo"
                    className={`text-xs font-bold text-slate-700 ${isEditingAdmin ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    Usuario Activo (Permite Iniciar Sesión)
                  </label>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 px-4 text-xs font-bold text-white bg-cotripar-700 hover:bg-cotripar-800 rounded-xl shadow-sm flex items-center justify-center gap-2 transition-all"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingId ? 'Guardar Cambios' : 'Crear Usuario en Supabase'}</span>
                </button>
              </div>
            </form>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <p className="text-[11px] leading-tight">
                Los cambios en nombres, usuarios y contraseñas se sincronizan al instante en el banco de datos de Cotripar.
              </p>
            </div>
          </div>
        </div>

        {/* Right: Users Table with Edit Buttons */}
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
                    <th className="py-2.5 px-3 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {users.map((u) => (
                    <tr
                      key={u.id}
                      className={`hover:bg-slate-50 transition-colors ${
                        editingId === u.id ? 'bg-cotripar-50/50' : ''
                      }`}
                    >
                      <td className="py-3 px-4 font-bold text-slate-900 flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-cotripar-100 text-cotripar-800 text-[10px] font-bold flex items-center justify-center uppercase shrink-0">
                          {u.nombre.substring(0, 2)}
                        </div>
                        <span className="truncate">{u.nombre}</span>
                      </td>

                      <td className="py-3 px-3 text-slate-600">
                        @{u.username}
                      </td>

                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            u.rol === 'admin'
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : u.rol === 'coordinador'
                                ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          <Shield className="w-3 h-3" />
                          <span>
                            {u.rol === 'admin'
                              ? 'Administrador'
                              : u.rol === 'coordinador'
                                ? 'Coordinador'
                                : 'Vendedor'}
                          </span>
                        </span>
                      </td>

                      <td className="py-3 px-3 text-center">
                        {u.rol === 'admin' ? (
                          <span
                            className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-green-100 text-green-800 inline-block cursor-default"
                            title="Cuenta Administradora protegida"
                          >
                            Activo
                          </span>
                        ) : (
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
                        )}
                      </td>

                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => handleStartEdit(u)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-cotripar-50 text-slate-700 hover:text-cotripar-700 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1"
                          title="Editar usuario"
                        >
                          <Pencil className="w-3 h-3" />
                          <span>Editar</span>
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
