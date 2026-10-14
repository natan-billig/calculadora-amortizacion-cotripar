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
  RotateCcw,
  Sparkles,
  Info,
  Sliders,
  User,
  FileCheck2,
  ExternalLink,
  CheckCircle2,
  Loader2
} from 'lucide-react';

interface CalculatorProps {
  onOpenBankManager: () => void;
  showToast: (msg: string) => void;
  initialSimulation?: SimulacionPDF | null;
}

export const Calculator: React.FC<CalculatorProps> = ({
  onOpenBankManager,
  showToast,
  initialSimulation
}) => {
  const { currentUser, isAdmin } = useAuth();

  // Inputs
  const [clienteNombre, setClienteNombre] = useState<string>('');
  const [capital, setCapital] = useState<number>(110000);
  const [tasaAnual, setTasaAnual] = useState<number>(7.40);
  const [plazoAnios, setPlazoAnios] = useState<number>(5);
  const [frecuencia, setFrecuencia] = useState<FrecuenciaPago>('anual');
  const [modalidadSemestral, setModalidadSemestral] = useState<ModalidadSemestral>('zafra_interes_primero');

  // Banks from Supabase
  const [bancos, setBancos] = useState<BancoTasa[]>([]);
  const [selectedBancoId, setSelectedBancoId] = useState<string>('');
  const [isLoadingBancos, setIsLoadingBancos] = useState<boolean>(true);

  // Generation & Success Modal state
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [successModalData, setSuccessModalData] = useState<{
    resultado: ResultadoAleman;
    cliente: string;
    banco: string;
    docInstance: any;
    pdfBlobUrl: string;
  } | null>(null);

  // Fetch banks in real-time from Supabase
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
      const bFound = bancos.find(b => b.entidad.toLowerCase() === initialSimulation.banco_entidad.toLowerCase());
      if (bFound) setSelectedBancoId(bFound.id);
      showToast(`Simulación de "${initialSimulation.cliente_nombre}" cargada.`);
    }
  }, [initialSimulation]);

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

  // Real-time calculation
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

  const capitalPresets = [25000, 50000, 75000, 110000, 150000, 200000];

  const handleReset = () => {
    setClienteNombre('');
    setCapital(110000);
    setPlazoAnios(5);
    setFrecuencia('anual');
    setModalidadSemestral('zafra_interes_primero');
    if (bancos.length > 0) {
      setSelectedBancoId(bancos[0].id);
      setTasaAnual(Number(bancos[0].tasa_anual));
    }
    showToast('Parámetros restablecidos.');
  };

  // Single Action Flow: Calculate, Generate PDF, and Save to Supabase
  const handleCalcularYGenerarPDF = async () => {
    if (capital <= 0) {
      showToast('Por favor ingrese un monto de capital válido');
      return;
    }

    setIsProcessing(true);
    const clienteFinal = clienteNombre.trim() || 'Cliente General';

    const simulacionPayload: SimulacionPDF = {
      usuario_id: currentUser?.id || null,
      vendedor_nombre: currentUser?.nombre || 'Asesor Cotripar',
      cliente_nombre: clienteFinal,
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
      cronograma_json: resultado.cronograma
    };

    try {
      // 1. Generate PDF
      const doc = await generarPDFSimulacion(simulacionPayload, resultado);
      const blobUrl = (doc.output('bloburl') as any)?.toString() || '';

      // Try opening in new tab
      try {
        window.open(blobUrl, '_blank');
      } catch {
        // popup blocker may catch it; success modal will provide direct link
      }

      // Trigger automatic file download
      const filename = `Cotripar_Simulacion_${clienteFinal.replace(/\s+/g, '_')}.pdf`;
      doc.save(filename);

      // 2. Save in background to Supabase
      supabase
        .from('simulaciones_pdf')
        .insert(simulacionPayload)
        .then(({ error }) => {
          if (error) {
            console.warn('Error saving simulation to Supabase:', error);
          }
        });

      // 3. Show Success Modal with action buttons
      setSuccessModalData({
        resultado,
        cliente: clienteFinal,
        banco: selectedBancoNombre,
        docInstance: doc,
        pdfBlobUrl: blobUrl
      });

      showToast('¡Simulación calculada y PDF generado con éxito!');
    } catch (err) {
      console.error(err);
      showToast('Error al generar el reporte PDF');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="py-2 sm:py-6">
      {/* Centralized Card (Mobile & Desktop Perfect) */}
      <div className="max-w-xl mx-auto w-full bg-white p-5 sm:p-7 rounded-3xl border border-slate-200 shadow-md space-y-5">
        {/* Card Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-cotripar-50 text-cotripar-700 flex items-center justify-center font-bold">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight">
                Parámetros del Crédito
              </h2>
              <p className="text-[11px] text-slate-400 font-medium">
                Sistema Alemán de Amortización • Cotripar S.A.
              </p>
            </div>
          </div>
          <span className="text-[11px] font-bold text-cotripar-700 bg-cotripar-50 px-2.5 py-1 rounded-full border border-cotripar-100">
            USD ($)
          </span>
        </div>

        {/* Form Fields */}
        <div className="space-y-4">
          {/* 1. Nombre del Cliente / Productor */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span>Nombre del Cliente / Productor (Opcional)</span>
            </label>
            <input
              type="text"
              value={clienteNombre}
              onChange={(e) => setClienteNombre(e.target.value)}
              placeholder="Ej: Agropecuaria El Palmar S.A. (o dejar en blanco)"
              className="w-full px-3.5 py-2.5 text-sm font-medium text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-cotripar-700 focus:outline-none transition-all"
            />
          </div>

          {/* 2. Capital Solicitado (USD) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                <span>Capital Solicitado (USD)</span>
              </label>
              <span className="text-cotripar-700 font-black text-sm">
                {formatUSD(capital)}
              </span>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <span className="text-xs font-bold text-slate-400">$</span>
              </div>
              <input
                type="number"
                min="1000"
                step="1000"
                value={capital || ''}
                onChange={(e) => setCapital(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full pl-8 pr-3.5 py-2.5 text-sm font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-cotripar-700 focus:outline-none transition-all"
                placeholder="110,000"
              />
            </div>

            {/* Quick Presets */}
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {capitalPresets.map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setCapital(val)}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                    capital === val
                      ? 'bg-cotripar-700 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  ${val / 1000}k
                </button>
              ))}
            </div>
          </div>

          {/* 3. Entidad Bancaria (Paraguay) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <span>Entidad Bancaria (Paraguay)</span>
              </label>
              {/* Oculto estrictamente para vendedores; solo visible para admin */}
              {isAdmin && (
                <button
                  type="button"
                  onClick={onOpenBankManager}
                  className="text-[11px] font-bold text-cotripar-700 hover:underline"
                >
                  ⚙️ Gestionar Tasas
                </button>
              )}
            </div>
            <select
              value={selectedBancoId}
              onChange={(e) => handleBankChange(e.target.value)}
              disabled={isLoadingBancos}
              className="w-full px-3.5 py-2.5 text-sm font-semibold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-cotripar-700 focus:outline-none transition-all"
            >
              {bancos.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.entidad} — {Number(b.tasa_anual).toFixed(2)}% anual
                </option>
              ))}
            </select>
          </div>

          {/* 4. Tasa de Interés Anual (%) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Percent className="w-3.5 h-3.5 text-slate-400" />
                <span>Tasa de Interés Anual (%)</span>
              </label>
              <span className="text-xs font-bold text-slate-500">
                {formatPercent(tasaAnual)}
              </span>
            </div>
            <div className="relative">
              <input
                type="number"
                min="0.1"
                max="100"
                step="0.05"
                value={tasaAnual || ''}
                onChange={(e) => setTasaAnual(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full px-3.5 py-2.5 text-sm font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-cotripar-700 focus:outline-none transition-all"
                placeholder="7.40"
              />
              <span className="absolute right-3.5 top-2.5 text-xs text-slate-400 font-bold">%</span>
            </div>
          </div>

          {/* 5. Plazo del Financiamiento (1 a 6 años) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Plazo del Financiamiento</span>
              </label>
              <span className="text-cotripar-700 font-black text-xs">
                {plazoAnios} {plazoAnios === 1 ? 'Año' : 'Años'}
              </span>
            </div>
            <div className="grid grid-cols-6 gap-1.5">
              {[1, 2, 3, 4, 5, 6].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPlazoAnios(p)}
                  className={`py-2 text-xs font-extrabold rounded-xl border transition-all ${
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

          {/* 6. Periodicidad de Amortización */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 block">
              Periodicidad de Amortización
            </label>
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

            {/* Modalidad Semestral */}
            {frecuencia === 'semestral' && (
              <div className="mt-2 p-3 bg-cotripar-50/70 border border-cotripar-200 rounded-xl animate-in fade-in space-y-1.5">
                <label className="text-xs font-bold text-cotripar-900 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-cotripar-700" />
                  <span>Modalidad Semestral</span>
                </label>
                <select
                  value={modalidadSemestral}
                  onChange={(e) => setModalidadSemestral(e.target.value as ModalidadSemestral)}
                  className="w-full px-3 py-2 text-xs font-bold text-slate-900 bg-white border border-cotripar-300 rounded-lg focus:ring-2 focus:ring-cotripar-700 focus:outline-none"
                >
                  <option value="zafra_interes_primero">
                    Zafra (1° sem solo interés, 2° sem cap + int)
                  </option>
                  <option value="constante">
                    Constante Semestral (Capital uniforme)
                  </option>
                </select>
                <p className="text-[10px] text-cotripar-800">
                  {modalidadSemestral === 'zafra_interes_primero'
                    ? '🌾 Esquema Zafra: cuota de interés en siembra y amortización principal en cosecha.'
                    : '⚖️ Amortización constante: el capital se divide equitativamente en todos los semestres.'}
                </p>
              </div>
            )}
          </div>

          {/* 7. Resumen Compacto: Gasto Administrativo */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
            <div>
              <span className="font-bold text-slate-700 block">Gasto Administrativo (1%):</span>
              <span className="text-[10px] text-slate-400">Cálculo automático s/ capital</span>
            </div>
            <span className="font-extrabold text-slate-900 text-sm">
              {formatUSD(resultado.gastoAdmin)}
            </span>
          </div>

          {/* Nota breve legal */}
          <div className="flex items-start gap-1.5 text-[10px] text-slate-400 leading-tight px-1">
            <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
            <span>IVA bancario del 10% aplicado exclusivamente sobre los intereses proyectados.</span>
          </div>
        </div>

        {/* 8. Botão Único de Ação Principal em Vermelho Cotripar */}
        <div className="pt-2 space-y-2">
          <button
            type="button"
            disabled={isProcessing}
            onClick={handleCalcularYGenerarPDF}
            className="w-full py-3.5 bg-cotripar-700 hover:bg-cotripar-800 active:bg-cotripar-900 text-white font-extrabold rounded-xl shadow-md hover:shadow-lg flex items-center justify-center gap-2 text-base transition-all disabled:opacity-60"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Generando Proyección...</span>
              </>
            ) : (
              <>
                <FileCheck2 className="w-5 h-5" />
                <span>CALCULAR Y GENERAR PDF</span>
              </>
            )}
          </button>

          <div className="text-center">
            <button
              type="button"
              onClick={handleReset}
              className="text-xs text-slate-400 hover:text-slate-600 font-semibold inline-flex items-center gap-1 transition-colors py-1 px-2"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Restablecer Parámetros</span>
            </button>
          </div>
        </div>
      </div>

      {/* Success Modal with PDF Links */}
      {successModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-cotripar-100 text-cotripar-700 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                ¡Proyección Generada con Éxito!
              </h3>
              <p className="text-xs text-slate-500">
                El cálculo bajo el Sistema Alemán fue procesado y guardado en el historial de Cotripar.
              </p>
            </div>

            {/* Quick KPI Snapshot */}
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1.5 font-medium">
              <div className="flex justify-between">
                <span className="text-slate-500">Cliente / Solicitante:</span>
                <span className="font-bold text-slate-900">{successModalData.cliente}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Capital Solicitado:</span>
                <span className="font-extrabold text-slate-900">{formatUSD(successModalData.resultado.capital)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Banco / Tasa:</span>
                <span className="font-semibold text-slate-800">{successModalData.banco} ({successModalData.resultado.tasaAnual}%)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Mayor Cuota Año 1:</span>
                <span className="font-bold text-cotripar-700">{formatUSD(successModalData.resultado.cuotaMayorAnio1)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-1.5 mt-1.5">
                <span className="text-slate-700 font-bold">Total a Pagar:</span>
                <span className="font-black text-cotripar-700 text-sm">
                  {formatUSD(successModalData.resultado.totalPagado)}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  try {
                    window.open(successModalData.pdfBlobUrl, '_blank');
                  } catch {
                    successModalData.docInstance.save(`Cotripar_Simulacion_${successModalData.cliente}.pdf`);
                  }
                }}
                className="w-full py-2.5 px-4 bg-cotripar-700 hover:bg-cotripar-800 text-white font-bold text-xs rounded-xl shadow flex items-center justify-center gap-2 transition-all"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Abrir / Descargar PDF nuevamente</span>
              </button>

              <button
                type="button"
                onClick={() => setSuccessModalData(null)}
                className="w-full py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-all"
              >
                Cerrar y Nueva Consulta
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
