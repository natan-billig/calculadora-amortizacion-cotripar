import React, { useState, useEffect } from 'react';
import type { MarcaProducto } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import {
  Tag,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  RefreshCw,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';

interface BrandManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  showToast: (msg: string) => void;
  onBrandsChanged?: () => void;
}

export const BrandManagerModal: React.FC<BrandManagerModalProps> = ({
  isOpen,
  onClose,
  showToast,
  onBrandsChanged
}) => {
  const { currentUser } = useAuth();

  const [marcas, setMarcas] = useState<MarcaProducto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // New brand state
  const [newMarcaNombre, setNewMarcaNombre] = useState<string>('');

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingNombre, setEditingNombre] = useState<string>('');

  const fetchMarcas = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('marcas_productos')
        .select('*')
        .order('nombre', { ascending: true });

      if (!error && data) {
        setMarcas(data);
      }
    } catch {
      // offline fallback
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchMarcas();
    }
  }, [isOpen]);

  if (!isOpen) return null;
  if (!currentUser || (currentUser.rol !== 'admin' && currentUser.rol !== 'coordinador')) return null;

  const handleAddMarca = async (e: React.FormEvent) => {
    e.preventDefault();
    const nombre = newMarcaNombre.trim();
    if (!nombre) {
      showToast('Ingrese el nombre de la marca');
      return;
    }

    if (marcas.some((m) => m.nombre.toLowerCase() === nombre.toLowerCase())) {
      showToast('Ya existe una marca con ese nombre');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('marcas_productos')
        .insert([{ nombre, activo: true }])
        .select()
        .single();

      if (error) {
        showToast('Error al registrar la marca');
      } else if (data) {
        setMarcas((prev) => [...prev, data].sort((a, b) => a.nombre.localeCompare(b.nombre)));
        setNewMarcaNombre('');
        showToast(`Marca "${nombre}" agregada con éxito`);
        if (onBrandsChanged) onBrandsChanged();
      }
    } catch {
      showToast('Error de conexión al agregar la marca');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartEdit = (marca: MarcaProducto) => {
    setEditingId(marca.id);
    setEditingNombre(marca.nombre);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingNombre('');
  };

  const handleSaveEdit = async (id: string) => {
    const nombre = editingNombre.trim();
    if (!nombre) {
      showToast('El nombre de la marca no puede estar vacío');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('marcas_productos')
        .update({ nombre })
        .eq('id', id);

      if (error) {
        showToast('Error al actualizar la marca');
      } else {
        setMarcas((prev) =>
          prev
            .map((m) => (m.id === id ? { ...m, nombre } : m))
            .sort((a, b) => a.nombre.localeCompare(b.nombre))
        );
        setEditingId(null);
        setEditingNombre('');
        showToast(`Marca actualizada a "${nombre}"`);
        if (onBrandsChanged) onBrandsChanged();
      }
    } catch {
      showToast('Error de conexión al actualizar la marca');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActivo = async (marca: MarcaProducto) => {
    const nuevoEstado = !marca.activo;
    try {
      const { error } = await supabase
        .from('marcas_productos')
        .update({ activo: nuevoEstado })
        .eq('id', marca.id);

      if (!error) {
        setMarcas((prev) =>
          prev.map((m) => (m.id === marca.id ? { ...m, activo: nuevoEstado } : m))
        );
        showToast(`Marca "${marca.nombre}" ${nuevoEstado ? 'activada' : 'desactivada'}`);
        if (onBrandsChanged) onBrandsChanged();
      } else {
        showToast('Error al cambiar estado de la marca');
      }
    } catch {
      showToast('Error de conexión');
    }
  };

  const handleDeleteMarca = async (marca: MarcaProducto) => {
    if (!window.confirm(`¿Está seguro de eliminar la marca "${marca.nombre}"?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('marcas_productos')
        .delete()
        .eq('id', marca.id);

      if (!error) {
        setMarcas((prev) => prev.filter((m) => m.id !== marca.id));
        showToast(`Marca "${marca.nombre}" eliminada`);
        if (onBrandsChanged) onBrandsChanged();
      } else {
        showToast('No se puede eliminar la marca si tiene registros vinculados');
      }
    } catch {
      showToast('Error de conexión al eliminar');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-xl w-full max-h-[90vh] flex flex-col my-auto overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-cotripar-900 text-white px-5 py-4 flex items-center justify-between border-b border-slate-700">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cotripar-600/30 border border-cotripar-500/40 flex items-center justify-center text-white">
              <Tag className="w-5 h-5 text-cotripar-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Gestión de Marcas de Productos
                <span className="text-[10px] font-semibold bg-cotripar-500/30 text-cotripar-200 px-2 py-0.5 rounded-full border border-cotripar-400/30">
                  {currentUser.rol === 'admin' ? 'Admin' : 'Coordinación'}
                </span>
              </h3>
              <p className="text-[11px] text-slate-300">
                Marcas oficiales disponibles para cotizar maquinarias y análisis en BI
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors"
            title="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Add Brand Form */}
          <form onSubmit={handleAddMarca} className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-cotripar-700" />
              <span>Registrar Nueva Marca</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newMarcaNombre}
                onChange={(e) => setNewMarcaNombre(e.target.value)}
                placeholder="Ej: Massey Ferguson / Kuhn / Montana"
                disabled={isSubmitting}
                className="flex-1 px-3.5 py-2 text-xs font-semibold text-slate-900 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-cotripar-700 outline-none"
              />
              <button
                type="submit"
                disabled={isSubmitting || !newMarcaNombre.trim()}
                className="px-4 py-2 bg-cotripar-700 hover:bg-cotripar-800 active:bg-cotripar-900 text-white font-bold text-xs rounded-xl shadow-xs transition-all disabled:opacity-50 flex items-center gap-1.5 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Agregar</span>
              </button>
            </div>
          </form>

          {/* Brands List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-600 px-1">
              <span>Marcas Registradas ({marcas.length})</span>
              <button
                type="button"
                onClick={fetchMarcas}
                className="text-cotripar-700 hover:underline flex items-center gap-1 text-[11px]"
              >
                <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Actualizar</span>
              </button>
            </div>

            {isLoading ? (
              <div className="py-8 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-cotripar-700" />
                <span>Cargando marcas desde Supabase...</span>
              </div>
            ) : marcas.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                No hay marcas registradas. Agregue una nueva marca arriba.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white max-h-72 overflow-y-auto">
                {marcas.map((marca) => {
                  const isEditing = editingId === marca.id;

                  return (
                    <div
                      key={marca.id}
                      className={`p-3 flex items-center justify-between gap-2 transition-colors ${
                        !marca.activo ? 'bg-slate-50/60 opacity-70' : 'hover:bg-slate-50/40'
                      }`}
                    >
                      {/* Name or Edit Input */}
                      <div className="flex-1 flex items-center gap-2">
                        {isEditing ? (
                          <div className="flex items-center gap-1.5 w-full">
                            <input
                              type="text"
                              value={editingNombre}
                              onChange={(e) => setEditingNombre(e.target.value)}
                              className="w-full px-2.5 py-1 text-xs font-bold bg-white border border-cotripar-400 rounded-lg focus:ring-2 focus:ring-cotripar-700 outline-none"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveEdit(marca.id)}
                              disabled={isSubmitting}
                              className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-md"
                              title="Guardar nombre"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={handleCancelEdit}
                              className="p-1 text-slate-400 hover:bg-slate-100 rounded-md"
                              title="Cancelar"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <span className="w-2 h-2 rounded-full shrink-0 bg-cotripar-600" />
                            <span className={`text-xs font-bold ${marca.activo ? 'text-slate-900' : 'text-slate-400 line-through'}`}>
                              {marca.nombre}
                            </span>
                            <span
                              className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full uppercase ${
                                marca.activo
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              {marca.activo ? 'Activa' : 'Inactiva'}
                            </span>
                          </>
                        )}
                      </div>

                      {/* Actions */}
                      {!isEditing && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleToggleActivo(marca)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
                            title={marca.activo ? 'Desactivar marca' : 'Activar marca'}
                          >
                            {marca.activo ? (
                              <ToggleRight className="w-5 h-5 text-emerald-600" />
                            ) : (
                              <ToggleLeft className="w-5 h-5 text-slate-400" />
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleStartEdit(marca)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Editar nombre"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteMarca(marca)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Eliminar marca"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition-all"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
