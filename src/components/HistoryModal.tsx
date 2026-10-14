import React, { useState, useEffect } from 'react';
import type { SimulacionPDF, ResultadoAleman } from '../types';
import { supabase } from '../lib/supabase';
import { formatUSD, formatPercent } from '../utils/calculatorEngine';
import { generarPDFSimulacion } from '../utils/pdfGenerator';
import { useAuth } from '../context/AuthContext';
import {
  Search,
  FileDown,
  Trash2,
  ExternalLink,
  RefreshCw,
  FolderOpen,
  Calendar,
  Building2
} from 'lucide-react';

interface HistoryModalProps {
  onLoadSimulation: (sim: SimulacionPDF) => void;
  showToast: (msg: string) => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  onLoadSimulation,
  showToast
}) => {
  const { isAdmin } = useAuth();
  const [simulaciones, setSimulaciones] = useState<SimulacionPDF[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchSimulaciones = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('simulaciones_pdf')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setSimulaciones(data as SimulacionPDF[]);
      } else {
        setSimulaciones([]);
      }
    } catch {
      setSimulaciones([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSimulaciones();
  }, []);

  const handleDelete = async (id: string, clienteNombre: string) => {
    if (!window.confirm(`¿Está seguro de eliminar la simulación de "${clienteNombre}"?`)) {
      return;
    }

    setDeletingId(id);
    try {
      const { error } = await supabase
        .from('simulaciones_pdf')
        .delete()
        .eq('id', id);

      if (!error) {
        setSimulaciones(prev => prev.filter(s => s.id !== id));
        showToast(`Simulación de "${clienteNombre}" eliminada`);
      } else {
        showToast('Error al eliminar la simulación');
      }
    } catch {
      showToast('Error de conexión al eliminar');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownloadHistoricalPDF = (sim: SimulacionPDF) => {
    // Reconstruct ResultadoAleman from stored simulation
    const resultadoMock: ResultadoAleman = {
      capital: sim.capital_usd,
      tasaAnual: sim.tasa_anual,
      plazoAnios: sim.plazo_anios,
      frecuencia: sim.periodicidad === 'semestral' ? 'semestral' : 'anual',
      modalidadSemestral: sim.modalidad_semestral as any,
      gastoAdmin: sim.gasto_admin_usd,
      cronograma: sim.cronograma_json || [],
      totalIntereses: sim.total_intereses_usd,
      totalIva: sim.total_iva_usd,
      totalCuotas: sim.total_pagado_usd - sim.gasto_admin_usd,
      costoFinancieroTotal: sim.costo_financiero_total_usd,
      totalPagado: sim.total_pagado_usd,
      cuotaAnio1: sim.mayor_cuota_anio1_usd,
      cuotaMayorAnio1: sim.mayor_cuota_anio1_usd,
      totalCuotasAnio1: sim.mayor_cuota_anio1_usd,
      bancoEntidad: sim.banco_entidad
    };

    const doc = generarPDFSimulacion(sim, resultadoMock);
    doc.save(`Cotripar_Simulacion_${sim.cliente_nombre.replace(/\s+/g, '_')}.pdf`);
    showToast('¡PDF histórico descargado con éxito!');
  };

  const filtered = simulaciones.filter(s => {
    const term = searchTerm.toLowerCase();
    return (
      (s.cliente_nombre || '').toLowerCase().includes(term) ||
      (s.cliente_ruc || '').toLowerCase().includes(term) ||
      (s.vendedor_nombre || '').toLowerCase().includes(term) ||
      (s.banco_entidad || '').toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-cotripar-700" />
            <span>Historial de Simulaciones Registradas</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold">
              {simulaciones.length} {simulaciones.length === 1 ? 'registro' : 'registros'}
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Registro centralizado en Supabase de proyecciones crediticias, clientes y cronogramas de pago.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar cliente, banco, RUC..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-cotripar-600 focus:outline-none w-56 sm:w-64"
            />
          </div>

          <button
            onClick={fetchSimulaciones}
            className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 transition-colors"
            title="Refrescar datos"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-cotripar-700' : ''}`} />
          </button>
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-cotripar-700" />
            <p className="text-xs font-semibold">Cargando simulaciones desde Supabase...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <FolderOpen className="w-10 h-10 mx-auto text-slate-300" />
            <p className="text-sm font-semibold text-slate-700">No se encontraron simulaciones registradas</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Realice un cálculo en la Calculadora y presione "Guardar en Supabase" para crear un registro persistente.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/80 text-slate-600 font-bold border-b border-slate-200">
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4">Cliente / RUC</th>
                  <th className="py-3 px-3">Asesor</th>
                  <th className="py-3 px-3">Banco / Tasa</th>
                  <th className="py-3 px-3 text-right">Capital</th>
                  <th className="py-3 px-3">Plazo</th>
                  <th className="py-3 px-3 text-right">Mayor Cuota Año 1</th>
                  <th className="py-3 px-4 text-right">Total a Pagar</th>
                  <th className="py-3 px-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filtered.map((sim) => {
                  const fecha = sim.created_at
                    ? new Date(sim.created_at).toLocaleDateString('es-ES', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                      })
                    : '-';

                  return (
                    <tr key={sim.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 text-slate-500 text-[11px] whitespace-nowrap">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          {fecha}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900 block truncate max-w-[180px]">
                          {sim.cliente_nombre}
                        </span>
                        {sim.cliente_ruc && (
                          <span className="text-[10px] text-slate-400 block">RUC: {sim.cliente_ruc}</span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                        {sim.vendedor_nombre}
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="font-semibold text-slate-800 flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-slate-400" />
                          {sim.banco_entidad}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {formatPercent(sim.tasa_anual)}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-right font-bold text-slate-900 whitespace-nowrap">
                        {formatUSD(sim.capital_usd)}
                      </td>

                      <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                        <span className="font-semibold">{sim.plazo_anios} años</span>
                        <span className="text-[10px] text-slate-400 block capitalize">
                          {sim.periodicidad}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-right font-bold text-amber-700 whitespace-nowrap">
                        {formatUSD(sim.mayor_cuota_anio1_usd)}
                      </td>

                      <td className="py-3 px-4 text-right font-extrabold text-cotripar-700 whitespace-nowrap">
                        {formatUSD(sim.total_pagado_usd)}
                      </td>

                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleDownloadHistoricalPDF(sim)}
                            className="p-1.5 text-slate-600 hover:text-cotripar-700 hover:bg-cotripar-50 rounded-lg transition-colors"
                            title="Descargar Reporte PDF"
                          >
                            <FileDown className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => onLoadSimulation(sim)}
                            className="p-1.5 text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Cargar en la Calculadora"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>

                          {(isAdmin || true) && (
                            <button
                              onClick={() => sim.id && handleDelete(sim.id, sim.cliente_nombre)}
                              disabled={deletingId === sim.id}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Eliminar registro"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
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
  );
};
