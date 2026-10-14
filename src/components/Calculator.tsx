import React, { useState, useEffect, useMemo } from 'react';
import type { BancoTasa, FrecuenciaPago, ModalidadSemestral, ResultadoAleman, SimulacionPDF } from '../types';
import { calcularSistemaAleman, formatUSD, formatPercent } from '../utils/calculatorEngine';
import { generarPDFSimulacion } from '../utils/pdfGenerator';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import {
  DollarSign,
  Calendar,
  Percent,
  Building2,
  FileDown,
  Save,
  Printer,
  RotateCcw,
  Sparkles,
  Info,
  Sliders,
  CheckCircle2
} from 'lucide-react';

interface CalculatorProps {
  onSaveSimulation: (resultado: ResultadoAleman, clientInfo: { clienteNombre: string; clienteRuc: string; notas: string }) => void;
  onOpenBankManager: () => void;
  showToast: (msg: string) => void;
  initialSimulation?: SimulacionPDF | null;
}

export const Calculator: React.FC<CalculatorProps> = ({
  onSaveSimulation,
  onOpenBankManager,
  showToast,
  initialSimulation
}) => {
  const { currentUser } = useAuth();

  // Inputs
  const [capital, setCapital] = useState<number>(110000);
  const [tasaAnual, setTasaAnual] = useState<number>(7.40);
  const [plazoAnios, setPlazoAnios] = useState<number>(5);
  const [frecuencia, setFrecuencia] = useState<FrecuenciaPago>('anual');
  const [modalidadSemestral, setModalidadSemestral] = useState<ModalidadSemestral>('zafra_interes_primero');

  // Client info for quick save/PDF
  const [clienteNombre, setClienteNombre] = useState<string>('Agropecuaria El Palmar S.A.');
  const [clienteRuc, setClienteRuc] = useState<string>('80034921-5');
  const [notas, setNotas] = useState<string>('');

  // Banks loaded from Supabase
  const [bancos, setBancos] = useState<BancoTasa[]>([]);
  const [selectedBancoId, setSelectedBancoId] = useState<string>('');
  const [isLoadingBancos, setIsLoadingBancos] = useState<boolean>(true);

  // Modal for Save
  const [showSaveModal, setShowSaveModal] = useState<boolean>(false);

  // Fetch banks from Supabase
  const fetchBancos = async () => {
    setIsLoadingBancos(true);
    try {
      const { data, error } = await supabase
        .from('bancos_tasas')
        .select('*')
        .eq('activo', true)
        .order('tasa_anual', { ascending: true });

      if (!error && data && data.length > 0) {
        setBancos(data);
        if (!selectedBancoId) {
          setSelectedBancoId(data[0].id);
          setTasaAnual(Number(data[0].tasa_anual));
        }
      } else {
        // Fallback default banks
        const defaults: BancoTasa[] = [
          { id: '1', entidad: 'Interfisa Banco', tasa_anual: 7.40, activo: true },
          { id: '2', entidad: 'Banco Sudameris', tasa_anual: 7.50, activo: true },
          { id: '3', entidad: 'Banco Atlas', tasa_anual: 7.50, activo: true },
          { id: '4', entidad: 'Banco Continental', tasa_anual: 7.65, activo: true },
          { id: '5', entidad: 'Banco Basa', tasa_anual: 7.60, activo: true },
          { id: '6', entidad: 'Banco Itaú', tasa_anual: 7.75, activo: true }
        ];
        setBancos(defaults);
        if (!selectedBancoId) {
          setSelectedBancoId(defaults[0].id);
          setTasaAnual(defaults[0].tasa_anual);
        }
      }
    } catch {
      // offline fallback
    } finally {
      setIsLoadingBancos(false);
    }
  };

  useEffect(() => {
    fetchBancos();
  }, []);

  // Handle re-loading simulation from history
  useEffect(() => {
    if (initialSimulation) {
      setCapital(initialSimulation.capital_usd);
      setTasaAnual(initialSimulation.tasa_anual);
      setPlazoAnios(initialSimulation.plazo_anios);
      setFrecuencia(initialSimulation.periodicidad === 'semestral' ? 'semestral' : 'anual');
      if (initialSimulation.modalidad_semestral) {
        setModalidadSemestral(initialSimulation.modalidad_semestral as ModalidadSemestral);
      }
      setClienteNombre(initialSimulation.cliente_nombre || '');
      setClienteRuc(initialSimulation.cliente_ruc || '');
      const bFound = bancos.find(b => b.entidad.toLowerCase() === initialSimulation.banco_entidad.toLowerCase());
      if (bFound) setSelectedBancoId(bFound.id);
      showToast(`Simulación de "${initialSimulation.cliente_nombre}" cargada.`);
    }
  }, [initialSimulation]);

  // When bank selector changes
  const handleBankChange = (bancoId: string) => {
    setSelectedBancoId(bancoId);
    const banco = bancos.find(b => b.id === bancoId);
    if (banco) {
      setTasaAnual(Number(banco.tasa_anual));
    }
  };

  const selectedBancoNombre = useMemo(() => {
    const b = bancos.find(item => item.id === selectedBancoId);
    return b ? b.entidad : 'Banco Comercial';
  }, [bancos, selectedBancoId]);

  // Core Calculation
  const resultado: ResultadoAleman = useMemo(() => {
    return calcularSistemaAleman(
      capital,
      tasaAnual,
      plazoAnios,
      frecuencia,
      modalidadSemestral,
      selectedBancoNombre
    );
  }, [capital, tasaAnual, plazoAnios, frecuencia, modalidadSemestral, selectedBancoNombre]);

  // Quick preset capital buttons
  const capitalPresets = [25000, 50000, 75000, 110000, 150000, 200000];

  const handleDownloadPDF = () => {
    const simulacionData: SimulacionPDF = {
      usuario_id: currentUser?.id,
      vendedor_nombre: currentUser?.nombre || 'Asesor Cotripar',
      cliente_nombre: clienteNombre.trim() || 'Cliente General',
      cliente_ruc: clienteRuc.trim() || 'S/D',
      capital_usd: resultado.capital,
      gasto_admin_usd: resultado.gastoAdmin,
      banco_entidad: selectedBancoNombre,
      tasa_anual: resultado.tasaAnual,
      plazo_anios: resultado.plazoAnios,
      periodicidad: resultado.frecuencia,
      modalidad_semestral: resultado.modalidadSemestral || null,
      total_intereses_usd: resultado.totalIntereses,
      total_iva_usd: resultado.totalIva,
      costo_financiero_total_usd: resultado.costoFinancieroTotal,
      total_pagado_usd: resultado.totalPagado,
      mayor_cuota_anio1_usd: resultado.cuotaMayorAnio1,
      cronograma_json: resultado.cronograma,
      notas: notas.trim()
    };

    const doc = generarPDFSimulacion(simulacionData, resultado);
    const filename = `Cotripar_Simulacion_${clienteNombre.replace(/\s+/g, '_') || 'Cliente'}.pdf`;
    doc.save(filename);
    showToast('¡Reporte PDF descargado con éxito!');
  };

  const handlePrint = () => {
    window.print();
  };

  const handleReset = () => {
    setCapital(110000);
    setPlazoAnios(5);
    setFrecuencia('anual');
    setModalidadSemestral('zafra_interes_primero');
    if (bancos.length > 0) {
      setSelectedBancoId(bancos[0].id);
      setTasaAnual(Number(bancos[0].tasa_anual));
    }
    showToast('Valores restablecidos a predeterminados.');
  };

  const handleOpenSaveModal = () => {
    setShowSaveModal(true);
  };

  const handleConfirmSave = () => {
    if (!clienteNombre.trim()) {
      showToast('Por favor ingrese el nombre del cliente');
      return;
    }
    onSaveSimulation(resultado, {
      clienteNombre: clienteNombre.trim(),
      clienteRuc: clienteRuc.trim(),
      notas: notas.trim()
    });
    setShowSaveModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm no-print">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <span>Simulador Financiero Cotripar</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 bg-cotripar-100 text-cotripar-800 rounded-full border border-cotripar-200">
              Sistema Alemán
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Proyección oficial de amortización con cuotas decrecientes, IVA 10% s/ intereses y 1% gasto administrativo.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleReset}
            className="px-3 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center gap-1.5"
            title="Restablecer valores"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Restablecer</span>
          </button>

          <button
            onClick={handlePrint}
            className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors flex items-center gap-1.5 shadow-sm"
            title="Imprimir pantalla"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimir</span>
          </button>

          <button
            onClick={handleOpenSaveModal}
            className="px-3.5 py-2 text-xs font-semibold text-cotripar-800 bg-cotripar-50 border border-cotripar-300 hover:bg-cotripar-100 rounded-xl transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <Save className="w-3.5 h-3.5 text-cotripar-700" />
            <span>Guardar en Supabase</span>
          </button>

          <button
            onClick={handleDownloadPDF}
            className="px-4 py-2 text-xs font-bold text-white bg-cotripar-700 hover:bg-cotripar-800 rounded-xl transition-all flex items-center gap-2 shadow-sm hover:shadow"
          >
            <FileDown className="w-4 h-4" />
            <span>Descargar PDF</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Parameters on Left, Summary KPIs & Schedule on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Input Parameters (4 cols on lg) */}
        <div className="lg:col-span-4 space-y-5 no-print">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Sliders className="w-4 h-4 text-cotripar-700" />
                Parámetros del Crédito
              </h2>
              <span className="text-xs text-cotripar-700 font-semibold bg-cotripar-50 px-2 py-0.5 rounded">
                USD ($)
              </span>
            </div>

            {/* Capital Solicitado */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>Capital Solicitado (USD)</span>
                <span className="text-cotripar-700 font-extrabold text-sm">{formatUSD(capital)}</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <DollarSign className="w-4 h-4 text-slate-400" />
                </div>
                <input
                  type="number"
                  min="1000"
                  step="1000"
                  value={capital || ''}
                  onChange={(e) => setCapital(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full pl-9 pr-3 py-2.5 text-sm font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-cotripar-600 focus:border-transparent transition-all"
                  placeholder="110,000"
                />
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {capitalPresets.map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setCapital(val)}
                    className={`px-2 py-1 text-[11px] font-semibold rounded-lg transition-colors ${
                      capital === val
                        ? 'bg-cotripar-700 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    ${val / 1000}k
                  </button>
                ))}
              </div>
            </div>

            {/* Banco / Entidad Financiera */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>Entidad Bancaria (Paraguay)</span>
                </label>
                <button
                  type="button"
                  onClick={onOpenBankManager}
                  className="text-[11px] font-semibold text-cotripar-700 hover:text-cotripar-800 hover:underline"
                >
                  ⚙️ Gestionar Tasas
                </button>
              </div>
              <select
                value={selectedBancoId}
                onChange={(e) => handleBankChange(e.target.value)}
                disabled={isLoadingBancos}
                className="w-full px-3 py-2.5 text-sm font-semibold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-cotripar-600 focus:border-transparent transition-all"
              >
                {bancos.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.entidad} — {Number(b.tasa_anual).toFixed(2)}% anual
                  </option>
                ))}
              </select>
            </div>

            {/* Tasa Anual de Interés (%) */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Percent className="w-3.5 h-3.5 text-slate-400" />
                  Tasa de Interés Anual (%)
                </span>
                <span className="text-slate-900 font-extrabold text-xs">{formatPercent(tasaAnual)}</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0.1"
                  max="100"
                  step="0.05"
                  value={tasaAnual || ''}
                  onChange={(e) => setTasaAnual(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full px-3 py-2.5 text-sm font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-cotripar-600 focus:border-transparent transition-all"
                  placeholder="7.40"
                />
                <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-bold">%</span>
              </div>
            </div>

            {/* Plazo en Años (1 a 6) */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  Plazo del Financiamiento
                </span>
                <span className="text-cotripar-700 font-extrabold text-xs">
                  {plazoAnios} {plazoAnios === 1 ? 'Año' : 'Años'}
                </span>
              </label>
              <div className="grid grid-cols-6 gap-1.5">
                {[1, 2, 3, 4, 5, 6].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPlazoAnios(p)}
                    className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                      plazoAnios === p
                        ? 'bg-cotripar-700 text-white border-cotripar-700 shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {p}a
                  </button>
                ))}
              </div>
            </div>

            {/* Frecuencia de Pago */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Periodicidad de Amortización</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFrecuencia('anual')}
                  className={`py-2.5 px-3 text-xs font-bold rounded-xl border transition-all text-center ${
                    frecuencia === 'anual'
                      ? 'bg-cotripar-700 text-white border-cotripar-700 shadow-sm'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Anual (1 cuota/año)
                </button>
                <button
                  type="button"
                  onClick={() => setFrecuencia('semestral')}
                  className={`py-2.5 px-3 text-xs font-bold rounded-xl border transition-all text-center ${
                    frecuencia === 'semestral'
                      ? 'bg-cotripar-700 text-white border-cotripar-700 shadow-sm'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Semestral (2 cuotas/año)
                </button>
              </div>
            </div>

            {/* Modalidad Semestral (Zafra vs Constante) */}
            {frecuencia === 'semestral' && (
              <div className="space-y-1.5 p-3 bg-cotripar-50/70 border border-cotripar-200 rounded-xl animate-in fade-in">
                <label className="text-xs font-bold text-cotripar-900 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-cotripar-700" />
                  <span>Esquema Semestral de Pagos</span>
                </label>
                <select
                  value={modalidadSemestral}
                  onChange={(e) => setModalidadSemestral(e.target.value as ModalidadSemestral)}
                  className="w-full px-3 py-2 text-xs font-semibold text-slate-900 bg-white border border-cotripar-300 rounded-lg focus:ring-2 focus:ring-cotripar-600"
                >
                  <option value="zafra_interes_primero">
                    Esquema Zafra (1° sem solo interés, 2° sem cap + int)
                  </option>
                  <option value="constante">
                    Amortización Constante Semestral (Capital uniforme)
                  </option>
                </select>
                <p className="text-[10px] text-cotripar-800 leading-tight">
                  {modalidadSemestral === 'zafra_interes_primero'
                    ? '🌾 Ideal para zafreros: paga solo intereses en siembra/entresafra y amortiza capital en época de cosecha.'
                    : '⚖️ Amortización lineal regular: el capital se divide equitativamente en todos los semestres.'}
                </p>
              </div>
            )}

            {/* Gasto Administrativo 1% (Automatic) */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
              <div>
                <span className="font-semibold text-slate-700 block">Gasto Administrativo (1%):</span>
                <span className="text-[10px] text-slate-500">Cómputo automático sobre capital</span>
              </div>
              <span className="font-bold text-slate-900 text-sm">{formatUSD(resultado.gastoAdmin)}</span>
            </div>

            {/* IVA Bancario 10% Notice */}
            <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl flex items-start gap-2 text-xs text-amber-900">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[11px] leading-tight">
                <strong>Régimen Fiscal PY:</strong> Se aplica el <strong>10% de IVA</strong> exclusivamente sobre los intereses devengados de cada cuota bancaria.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: KPIs & Schedule Table (8 cols on lg) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Consolidated Financial Summary (Cards) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {/* Total Intereses */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Total Intereses
              </span>
              <span className="text-lg sm:text-xl font-extrabold text-slate-900 mt-1 block">
                {formatUSD(resultado.totalIntereses)}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">Interés bancario acumulado</span>
            </div>

            {/* Total IVA 10% */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Total IVA (10%)
              </span>
              <span className="text-lg sm:text-xl font-extrabold text-slate-900 mt-1 block">
                {formatUSD(resultado.totalIva)}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">10% s/ intereses PY</span>
            </div>

            {/* Costo Financiero Total */}
            <div className="bg-white p-4 rounded-2xl border border-amber-200 bg-amber-50/30 shadow-sm">
              <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider block">
                Costo Financiero (CFT)
              </span>
              <span className="text-lg sm:text-xl font-extrabold text-amber-700 mt-1 block">
                {formatUSD(resultado.costoFinancieroTotal)}
              </span>
              <span className="text-[10px] text-amber-600 font-medium">Int. + IVA + Gasto Admin</span>
            </div>

            {/* Total Pagado */}
            <div className="bg-white p-4 rounded-2xl border border-cotripar-300 bg-cotripar-50/40 shadow-sm">
              <span className="text-[11px] font-bold text-cotripar-800 uppercase tracking-wider block">
                Total a Pagar
              </span>
              <span className="text-lg sm:text-xl font-extrabold text-cotripar-700 mt-1 block">
                {formatUSD(resultado.totalPagado)}
              </span>
              <span className="text-[10px] text-cotripar-600 font-medium">Capital + Costo Financiero</span>
            </div>
          </div>

          {/* Special Badge: Mayor Cuota Año 1 */}
          <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-white p-4 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="text-xs font-semibold text-amber-100 uppercase tracking-wider block">
                  Exigibilidad de Repago Año 1
                </span>
                <span className="text-sm sm:text-base font-bold">
                  Mayor Cuota Año 1: {formatUSD(resultado.cuotaMayorAnio1)}
                </span>
              </div>
            </div>
            <div className="text-xs sm:text-right bg-white/10 px-3 py-1.5 rounded-xl">
              <span className="text-amber-100 block">Total Pagos Año 1:</span>
              <strong className="text-white text-sm">{formatUSD(resultado.totalCuotasAnio1)}</strong>
            </div>
          </div>

          {/* Amortization Schedule Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span>Cronograma Detallado de Amortización</span>
                  <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md">
                    {resultado.cronograma.length} {frecuencia === 'semestral' ? 'semestres' : 'años'}
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Cuotas decrecientes bajo Sistema Alemán con {resultado.tasaAnual}% anual en {resultado.bancoEntidad}.
                </p>
              </div>
              <span className="text-xs text-slate-500 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg self-start sm:self-auto">
                Valores en USD
              </span>
            </div>

            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/80 text-slate-600 font-bold border-b border-slate-200">
                    <th className="py-3 px-4">Período</th>
                    <th className="py-3 px-3 text-right">Saldo Inicial</th>
                    <th className="py-3 px-3 text-right">Amortización</th>
                    <th className="py-3 px-3 text-right">Interés</th>
                    <th className="py-3 px-3 text-right">IVA (10%)</th>
                    <th className="py-3 px-4 text-right font-extrabold text-cotripar-800 bg-cotripar-50/50">
                      Cuota Total
                    </th>
                    <th className="py-3 px-4 text-right">Saldo Final</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {resultado.cronograma.map((c) => {
                    const isMayorAnio1 = c.anio === 1 && Math.abs(c.cuota - resultado.cuotaMayorAnio1) < 0.5;
                    return (
                      <tr
                        key={c.periodo}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          isMayorAnio1 ? 'bg-amber-50/60 font-semibold' : ''
                        }`}
                      >
                        <td className="py-3 px-4 font-bold text-slate-800 flex items-center gap-1.5">
                          <span>{c.label}</span>
                          {isMayorAnio1 && (
                            <span className="text-[10px] font-extrabold px-1.5 py-0.5 bg-amber-500 text-white rounded-md shrink-0">
                              ★ Mayor Año 1
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right text-slate-600">{formatUSD(c.saldoInicial)}</td>
                        <td className="py-3 px-3 text-right text-slate-800 font-semibold">{formatUSD(c.amortizacion)}</td>
                        <td className="py-3 px-3 text-right text-slate-600">{formatUSD(c.interes)}</td>
                        <td className="py-3 px-3 text-right text-slate-500">{formatUSD(c.iva)}</td>
                        <td className="py-3 px-4 text-right font-bold text-cotripar-700 bg-cotripar-50/40 text-sm">
                          {formatUSD(c.cuota)}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-600">{formatUSD(c.saldoFinal)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300">
                    <td className="py-3 px-4 uppercase text-[11px] tracking-wider">TOTALES</td>
                    <td className="py-3 px-3 text-right">-</td>
                    <td className="py-3 px-3 text-right">{formatUSD(resultado.capital)}</td>
                    <td className="py-3 px-3 text-right">{formatUSD(resultado.totalIntereses)}</td>
                    <td className="py-3 px-3 text-right">{formatUSD(resultado.totalIva)}</td>
                    <td className="py-3 px-4 text-right text-cotripar-800 text-sm bg-cotripar-100/50">
                      {formatUSD(resultado.totalCuotas)}
                    </td>
                    <td className="py-3 px-4 text-right">$ 0</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Save Simulation Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Save className="w-5 h-5 text-cotripar-700" />
                Guardar Simulación en Supabase
              </h3>
              <button
                onClick={() => setShowSaveModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Esta simulación se registrará de forma persistente en la tabla <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700">simulaciones_pdf</code> vinculada a tu cuenta de usuario.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Nombre del Cliente o Razón Social *
                </label>
                <input
                  type="text"
                  value={clienteNombre}
                  onChange={(e) => setClienteNombre(e.target.value)}
                  placeholder="Ej: Agropecuaria Santa Rita S.A."
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-cotripar-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  RUC o Cédula de Identidad (Paraguay)
                </label>
                <input
                  type="text"
                  value={clienteRuc}
                  onChange={(e) => setClienteRuc(e.target.value)}
                  placeholder="Ej: 80034921-5"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-cotripar-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Notas u Observaciones del Crédito
                </label>
                <textarea
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  rows={2}
                  placeholder="Ej: Compra de Cosechadora New Holland TC5090 con entrega a zafra..."
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-cotripar-600 focus:outline-none"
                />
              </div>

              {/* Summary snapshot */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Capital Solicitado:</span>
                  <span className="font-bold text-slate-800">{formatUSD(resultado.capital)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Banco / Tasa:</span>
                  <span className="font-semibold text-slate-800">{selectedBancoNombre} ({resultado.tasaAnual}%)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Plazo / Modalidad:</span>
                  <span className="font-semibold text-slate-800">{resultado.plazoAnios} años ({frecuencia})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Mayor Cuota Año 1:</span>
                  <span className="font-bold text-amber-700">{formatUSD(resultado.cuotaMayorAnio1)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-1 mt-1">
                  <span className="text-slate-700 font-bold">Total a Pagar:</span>
                  <span className="font-extrabold text-cotripar-700">{formatUSD(resultado.totalPagado)}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmSave}
                className="px-4 py-2 text-xs font-bold text-white bg-cotripar-700 hover:bg-cotripar-800 rounded-xl transition-all shadow-sm flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirmar y Guardar</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
