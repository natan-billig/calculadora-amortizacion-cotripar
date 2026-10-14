import React, { useState, useEffect } from 'react';
import type { BancoTasa } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import {
  Building2,
  Percent,
  Plus,
  Pencil,
  Trash2,
  RotateCcw,
  Check,
  RefreshCw,
  AlertCircle
} from 'lucide-react';

interface BankManagerModalProps {
  showToast: (msg: string) => void;
}

const DEFAULT_BANCOS = [
  { entidad: 'Interfisa Banco', tasa_anual: 7.40 },
  { entidad: 'Banco Sudameris', tasa_anual: 7.50 },
  { entidad: 'Banco Atlas', tasa_anual: 7.50 },
  { entidad: 'Banco Continental', tasa_anual: 7.65 },
  { entidad: 'Banco Basa', tasa_anual: 7.60 },
  { entidad: 'Banco Itaú', tasa_anual: 7.75 }
];

export const BankManagerModal: React.FC<BankManagerModalProps> = ({ showToast }) => {
  const { currentUser, isAdmin } = useAuth();

  // Strict admin guard: sellers cannot access bank manager
  if (!currentUser || currentUser.rol !== 'admin') {
    return null;
  }

  const [bancos, setBancos] = useState<BancoTasa[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Form state
  const [entidadInput, setEntidadInput] = useState<string>('');
  const [tasaInput, setTasaInput] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const fetchBancos = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('bancos_tasas')
        .select('*')
        .order('tasa_anual', { ascending: true });

      if (!error && data) {
        setBancos(data);
      }
    } catch {
      // offline
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBancos();
  }, []);

  const handleStartEdit = (b: BancoTasa) => {
    setEditingId(b.id);
    setEntidadInput(b.entidad);
    setTasaInput(b.tasa_anual.toString());
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEntidadInput('');
    setTasaInput('');
  };

  const handleSaveBank = async (e: React.FormEvent) => {
    e.preventDefault();
    const entidad = entidadInput.trim();
    const tasa = parseFloat(tasaInput);

    if (!entidad) {
      showToast('Ingrese el nombre de la entidad bancaria');
      return;
    }

    if (isNaN(tasa) || tasa <= 0 || tasa > 100) {
      showToast('Ingrese una tasa anual válida (ej: 7.50)');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingId) {
        // Update existing bank
        const { error } = await supabase
          .from('bancos_tasas')
          .update({
            entidad,
            tasa_anual: tasa,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingId);

        if (!error) {
          showToast(`Entidad "${entidad}" actualizada`);
          handleCancelEdit();
          fetchBancos();
        } else {
          showToast('Error al actualizar entidad');
        }
      } else {
        // Insert new bank
        const { error } = await supabase
          .from('bancos_tasas')
          .insert({
            entidad,
            tasa_anual: tasa,
            activo: true
          });

        if (!error) {
          showToast(`Entidad "${entidad}" agregada al catálogo`);
          handleCancelEdit();
          fetchBancos();
        } else {
          showToast('Error: ya existe una entidad con este nombre');
        }
      }
    } catch {
      showToast('Error de conexión con Supabase');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteBank = async (id: string, entidad: string) => {
    if (bancos.length <= 1) {
      showToast('Debe existir al menos una entidad bancaria configurada');
      return;
    }

    if (!window.confirm(`¿Desea eliminar "${entidad}" de la lista de bancos?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('bancos_tasas')
        .delete()
        .eq('id', id);

      if (!error) {
        showToast(`Entidad "${entidad}" eliminada`);
        setBancos(prev => prev.filter(b => b.id !== id));
      } else {
        showToast('Error al eliminar entidad bancaria');
      }
    } catch {
      showToast('Error de conexión');
    }
  };

  const handleResetDefaults = async () => {
    if (!window.confirm('¿Restablecer las tasas bancarias a los valores predeterminados de Cotripar?')) {
      return;
    }

    setIsLoading(true);
    try {
      for (const item of DEFAULT_BANCOS) {
        await supabase
          .from('bancos_tasas')
          .upsert(
            { entidad: item.entidad, tasa_anual: item.tasa_anual, activo: true },
            { onConflict: 'entidad' }
          );
      }
      showToast('Tasas predeterminadas restablecidas con éxito');
      fetchBancos();
    } catch {
      showToast('Error al restablecer tasas');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleActivo = async (banco: BancoTasa) => {
    try {
      const { error } = await supabase
        .from('bancos_tasas')
        .update({ activo: !banco.activo })
        .eq('id', banco.id);

      if (!error) {
        setBancos(prev =>
          prev.map(b => (b.id === banco.id ? { ...b, activo: !b.activo } : b))
        );
        showToast(`${banco.entidad} ${!banco.activo ? 'activado' : 'desactivado'}`);
      }
    } catch {
      showToast('Error al actualizar estado');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-cotripar-700" />
            <span>Gestor de Entidades Bancarias y Tasas de Interés</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Administración centralizada en Supabase para sincronización automática en la Calculadora.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={handleResetDefaults}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restablecer Tasas</span>
            </button>
          )}

          <button
            onClick={fetchBancos}
            className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 transition-colors"
            title="Refrescar tasas"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-cotripar-700' : ''}`} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Form to Add/Edit Bank */}
        <div className="lg:col-span-5">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                {editingId ? <Pencil className="w-4 h-4 text-amber-600" /> : <Plus className="w-4 h-4 text-cotripar-700" />}
                {editingId ? 'Editar Entidad Financiera' : 'Agregar Nueva Entidad'}
              </h3>
              {editingId && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="text-xs text-slate-400 hover:text-slate-600 font-semibold"
                >
                  Cancelar
                </button>
              )}
            </div>

            <form onSubmit={handleSaveBank} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Nombre de la Entidad Bancaria *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Building2 className="w-4 h-4 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    required
                    value={entidadInput}
                    onChange={(e) => setEntidadInput(e.target.value)}
                    placeholder="Ej: Banco GNB Paraguay"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-cotripar-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Tasa de Interés Anual (%) *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Percent className="w-4 h-4 text-slate-400" />
                  </div>
                  <input
                    type="number"
                    step="0.05"
                    min="0.1"
                    max="100"
                    required
                    value={tasaInput}
                    onChange={(e) => setTasaInput(e.target.value)}
                    placeholder="7.50"
                    className="w-full pl-9 pr-8 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-cotripar-600 focus:outline-none font-bold"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-bold">%</span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`w-full py-2.5 px-4 text-xs font-bold text-white rounded-xl shadow-sm flex items-center justify-center gap-2 transition-all ${
                    editingId
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : 'bg-cotripar-700 hover:bg-cotripar-800'
                  }`}
                >
                  {editingId ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Actualizar Entidad Bancaria</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>Guardar en Supabase</span>
                    </>
                  )}
                </button>
              </div>
            </form>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <p className="text-[11px] leading-tight">
                Las tasas registradas aquí se cargan automáticamente en el desplegable de bancos de la calculadora principal.
              </p>
            </div>
          </div>
        </div>

        {/* Right: Table of Banks */}
        <div className="lg:col-span-7">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                Catálogo Activo ({bancos.length} entidades)
              </h3>
              <span className="text-xs text-slate-400">Ordenado por tasa</span>
            </div>

            {isLoading ? (
              <div className="p-8 text-center text-slate-400">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto text-cotripar-700 mb-1" />
                <p className="text-xs">Cargando tasas bancarias...</p>
              </div>
            ) : bancos.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <p className="text-xs">No hay entidades registradas</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                      <th className="py-2.5 px-4">Entidad Financiera</th>
                      <th className="py-2.5 px-3 text-right">Tasa Anual</th>
                      <th className="py-2.5 px-3 text-center">Estado</th>
                      <th className="py-2.5 px-4 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {bancos.map((b) => (
                      <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-900 flex items-center gap-2">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          <span>{b.entidad}</span>
                        </td>

                        <td className="py-3 px-3 text-right font-extrabold text-cotripar-700 text-sm">
                          {Number(b.tasa_anual).toFixed(2)}%
                        </td>

                        <td className="py-3 px-3 text-center">
                          <button
                            onClick={() => handleToggleActivo(b)}
                            className={`px-2 py-0.5 text-[10px] font-bold rounded-full transition-colors ${
                              b.activo
                                ? 'bg-green-100 text-green-800'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {b.activo ? 'Activo' : 'Inactivo'}
                          </button>
                        </td>

                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleStartEdit(b)}
                              className="p-1.5 text-slate-600 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                              title="Editar tasa"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => handleDeleteBank(b.id, b.entidad)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Eliminar entidad"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
