import React, { useState, useEffect } from 'react';
import type { BancoTasa } from '../types';
import { BANCOS_OFICIALES_COTRIPAR } from '../types';
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
  AlertCircle,
  Handshake
} from 'lucide-react';

interface BankManagerModalProps {
  showToast: (msg: string) => void;
}

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
  const [tieneConvenioInput, setTieneConvenioInput] = useState<boolean>(false);
  const [modalidadInput, setModalidadInput] = useState<string>('Semestral y Anual');
  const [tasasPorPlazoInput, setTasasPorPlazoInput] = useState<{
    '1': string;
    '1.5': string;
    '2': string;
    '3': string;
    '4': string;
    '5': string;
    '6': string;
  }>({
    '1': '',
    '1.5': '',
    '2': '',
    '3': '',
    '4': '',
    '5': '',
    '6': ''
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const fetchBancos = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('bancos_tasas')
        .select('*')
        .order('entidad', { ascending: true });

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
    setTieneConvenioInput(b.tiene_convenio ?? false);
    setModalidadInput(b.modalidad_permitida || 'Semestral y Anual');

    const rates = b.tasas_por_plazo || {};
    const rate15 = rates['1.5'] != null ? String(rates['1.5']) : (rates['2'] != null ? String(rates['2']) : '');
    setTasasPorPlazoInput({
      '1': rates['1'] != null ? String(rates['1']) : '',
      '1.5': rate15,
      '2': rates['2'] != null ? String(rates['2']) : '',
      '3': rates['3'] != null ? String(rates['3']) : '',
      '4': rates['4'] != null ? String(rates['4']) : '',
      '5': rates['5'] != null ? String(rates['5']) : '',
      '6': rates['6'] != null ? String(rates['6']) : ''
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEntidadInput('');
    setTieneConvenioInput(false);
    setModalidadInput('Semestral y Anual');
    setTasasPorPlazoInput({
      '1': '',
      '1.5': '',
      '2': '',
      '3': '',
      '4': '',
      '5': '',
      '6': ''
    });
  };

  const handleSaveBank = async (e: React.FormEvent) => {
    e.preventDefault();
    const entidad = entidadInput.trim();

    if (!entidad) {
      showToast('Ingrese el nombre de la entidad bancaria');
      return;
    }

    // Build JSON object for tasas_por_plazo
    const tasasObj: Record<string, number | null> = {};
    let hasAtLeastOneRate = false;

    (['1', '1.5', '2', '3', '4', '5', '6'] as const).forEach((plazo) => {
      const strVal = tasasPorPlazoInput[plazo].trim();
      if (strVal !== '') {
        const parsed = parseFloat(strVal);
        if (!isNaN(parsed) && parsed > 0 && parsed <= 100) {
          tasasObj[plazo] = parsed;
          hasAtLeastOneRate = true;
        } else {
          tasasObj[plazo] = null;
        }
      } else {
        tasasObj[plazo] = null;
      }
    });

    // Auto inherit 2-year rate for 1.5 if empty
    if (tasasObj['1.5'] == null && tasasObj['2'] != null) {
      tasasObj['1.5'] = tasasObj['2'];
    }

    if (!hasAtLeastOneRate) {
      showToast('Debe ingresar al menos una tasa para uno de los plazos.');
      return;
    }

    // Default tasa_anual is 5 years, or first non-null rate
    const defaultTasa =
      tasasObj['5'] ??
      Object.values(tasasObj).find((v) => v != null) ??
      7.50;

    setIsSubmitting(true);
    try {
      if (editingId) {
        // Update existing bank
        const { error } = await supabase
          .from('bancos_tasas')
          .update({
            entidad,
            tasa_anual: defaultTasa,
            tasas_por_plazo: tasasObj,
            tiene_convenio: tieneConvenioInput,
            modalidad_permitida: modalidadInput,
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
        const { error } = await supabase.from('bancos_tasas').insert({
          entidad,
          tasa_anual: defaultTasa,
          tasas_por_plazo: tasasObj,
          tiene_convenio: tieneConvenioInput,
          modalidad_permitida: modalidadInput,
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
      const { error } = await supabase.from('bancos_tasas').delete().eq('id', id);

      if (!error) {
        showToast(`Entidad "${entidad}" eliminada`);
        setBancos((prev) => prev.filter((b) => b.id !== id));
      } else {
        showToast('Error al eliminar entidad bancaria');
      }
    } catch {
      showToast('Error de conexión');
    }
  };

  const handleResetDefaults = async () => {
    if (!window.confirm('¿Restablecer las tasas bancarias a los 10 bancos oficiales de la planilla trimestral de Cotripar?')) {
      return;
    }

    setIsLoading(true);
    try {
      // Clear existing records and insert the 10 official banks
      await supabase.from('bancos_tasas').delete().neq('id', '00000000-0000-0000-0000-000000000000');

      for (const item of BANCOS_OFICIALES_COTRIPAR) {
        await supabase.from('bancos_tasas').insert({
          entidad: item.entidad,
          tasa_anual: item.tasa_anual,
          tiene_convenio: item.tiene_convenio,
          modalidad_permitida: item.modalidad_permitida,
          tasas_por_plazo: item.tasas_por_plazo,
          activo: true
        });
      }
      showToast('¡10 Bancos oficiales de Cotripar restablecidos con éxito!');
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
        setBancos((prev) =>
          prev.map((b) => (b.id === banco.id ? { ...b, activo: !b.activo } : b))
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
            <span>Gestor de Entidades Bancarias y Tasas por Plazo</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Planilla trimestral oficial de Cotripar con tasas dinámicas de 1 a 6 años sincronizadas en tiempo real.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={handleResetDefaults}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restaurar Valores de Fábrica</span>
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
        {/* Left: Form to Add/Edit Bank (5 cols) */}
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
              {/* Nombre de la Entidad */}
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
                    placeholder="Ej: Banco Atlas"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-cotripar-700 focus:outline-none"
                  />
                </div>
              </div>

              {/* Convenio & Modalidad */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">
                    Convenio Cotripar
                  </label>
                  <button
                    type="button"
                    onClick={() => setTieneConvenioInput(!tieneConvenioInput)}
                    className={`w-full py-2 px-3 text-xs font-bold rounded-xl border transition-all flex items-center justify-center gap-1.5 ${
                      tieneConvenioInput
                        ? 'bg-cotripar-50 text-cotripar-700 border-cotripar-200'
                        : 'bg-slate-50 text-slate-500 border-slate-200'
                    }`}
                  >
                    <Handshake className="w-3.5 h-3.5" />
                    <span>{tieneConvenioInput ? 'Con Convenio' : 'Sin Convenio'}</span>
                  </button>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">
                    Modalidad Permitida
                  </label>
                  <select
                    value={modalidadInput}
                    onChange={(e) => setModalidadInput(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs font-bold border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-cotripar-700 focus:outline-none"
                  >
                    <option value="Semestral y Anual">Semestral y Anual</option>
                    <option value="Semestral">Solo Semestral</option>
                    <option value="Anual">Solo Anual</option>
                  </select>
                </div>
              </div>

              {/* Tasas por Plazo (18 meses / 1 a 6 Años) */}
              <div className="space-y-2 pt-1 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <Percent className="w-3.5 h-3.5 text-slate-400" />
                    <span>Tasas de Interés por Plazo (%)</span>
                  </label>
                  <span className="text-[10px] text-slate-400">Vacío = sin tasa</span>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {(['1', '1.5', '2', '3', '4', '5', '6'] as const).map((plazo) => (
                    <div key={plazo} className="space-y-0.5">
                      <span className={`text-[10px] font-bold block ${plazo === '1.5' ? 'text-cotripar-700' : 'text-slate-600'}`}>
                        {plazo === '1.5' ? '18 Meses' : `${plazo} ${plazo === '1' ? 'Año' : 'Años'}`}
                      </span>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.05"
                          min="0.1"
                          max="100"
                          value={tasasPorPlazoInput[plazo]}
                          onChange={(e) =>
                            setTasasPorPlazoInput((prev) => ({
                              ...prev,
                              [plazo]: e.target.value
                            }))
                          }
                          placeholder="—"
                          className="w-full pl-2 pr-5 py-1.5 text-xs font-bold border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-cotripar-700 focus:outline-none"
                        />
                        <span className="absolute right-1.5 top-1.5 text-[10px] text-slate-400 font-bold">%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`w-full py-2.5 px-4 text-xs font-bold text-white rounded-xl shadow-sm flex items-center justify-center gap-2 transition-all ${
                    editingId ? 'bg-amber-600 hover:bg-amber-700' : 'bg-cotripar-700 hover:bg-cotripar-800'
                  }`}
                >
                  {editingId ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Actualizar Banco y Tasas</span>
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
                Al seleccionar un banco en la calculadora, la tasa se ajustará automáticamente según el plazo elegido (18 meses / 1 a 6 años).
              </p>
            </div>
          </div>
        </div>

        {/* Right: Table of Banks with Matrix of Terms (7 cols) */}
        <div className="lg:col-span-7">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-sm font-bold text-slate-900">
                Matriz de Tasas Oficiales ({bancos.length} bancos)
              </h3>
              <span className="text-xs text-slate-400">Tasas anuales según plazo</span>
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
                    <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 text-center">
                      <th className="py-2.5 px-3 text-left">Entidad / Convenio</th>
                      <th className="py-2.5 px-1 w-10">1a</th>
                      <th className="py-2.5 px-1 w-10 text-cotripar-700">18m</th>
                      <th className="py-2.5 px-1 w-10">2a</th>
                      <th className="py-2.5 px-1 w-10">3a</th>
                      <th className="py-2.5 px-1 w-10">4a</th>
                      <th className="py-2.5 px-1 w-10">5a</th>
                      <th className="py-2.5 px-1 w-10">6a</th>
                      <th className="py-2.5 px-2">Estado</th>
                      <th className="py-2.5 px-2">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {bancos.map((b) => {
                      const rates = b.tasas_por_plazo || {};
                      return (
                        <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2.5 px-3">
                            <span className="font-bold text-slate-900 block truncate max-w-[150px]">
                              {b.entidad}
                            </span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {b.tiene_convenio && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 bg-cotripar-50 text-cotripar-700 border border-cotripar-200 rounded">
                                  Convenio
                                </span>
                              )}
                              <span className="text-[9px] text-slate-400">
                                {b.modalidad_permitida || 'Ambas'}
                              </span>
                            </div>
                          </td>

                          {(['1', '1.5', '2', '3', '4', '5', '6'] as const).map((plazo) => {
                            const val = plazo === '1.5' ? (rates['1.5'] ?? rates['2']) : rates[plazo];
                            return (
                              <td key={plazo} className="py-2.5 px-1 text-center">
                                {val != null ? (
                                  <span className={`font-bold ${plazo === '1.5' ? 'text-cotripar-700' : 'text-slate-900'}`}>
                                    {Number(val).toFixed(2)}%
                                  </span>
                                ) : (
                                  <span className="text-slate-300 font-normal">—</span>
                                )}
                              </td>
                            );
                          })}

                          <td className="py-2.5 px-2 text-center">
                            <button
                              onClick={() => handleToggleActivo(b)}
                              className={`px-2 py-0.5 text-[9px] font-bold rounded-full transition-colors ${
                                b.activo
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              {b.activo ? 'Activo' : 'Inactivo'}
                            </button>
                          </td>

                          <td className="py-2.5 px-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleStartEdit(b)}
                                className="p-1.5 text-slate-600 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                title="Editar tasas del banco"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => handleDeleteBank(b.id, b.entidad)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Eliminar banco"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
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
