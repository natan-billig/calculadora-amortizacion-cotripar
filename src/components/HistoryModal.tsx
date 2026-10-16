import React, { useState, useEffect, useMemo } from 'react';
import type { SimulacionPDF, ResultadoAleman, ItemMaquinaria } from '../types';
import { supabase } from '../lib/supabase';
import { formatUSD, formatPercent } from '../utils/calculatorEngine';
import { generarPDFSimulacion, generarPDFComparativo } from '../utils/pdfGenerator';
import { useAuth } from '../context/AuthContext';
import {
  Search,
  FileDown,
  Trash2,
  ExternalLink,
  RefreshCw,
  FolderOpen,
  Calendar,
  Building2,
  Download,
  BarChart3,
  TrendingUp,
  DollarSign,
  Briefcase,
  FileSignature,
  X,
  CheckCircle2,
  Plus,
  Scale,
  Tag
} from 'lucide-react';
import { generarPDFCartaOferta, type CartaOfertaPayload } from '../utils/offerLetterGenerator';

interface HistoryModalProps {
  onLoadSimulation: (sim: SimulacionPDF) => void;
  showToast: (msg: string) => void;
}

type PeriodoTipo = 'todo' | 'mes' | 'semestre' | 'anio';

const isComparativoSim = (sim?: { tipo_financiacion?: string | null; periodicidad?: string | null; banco_entidad?: string | null } | null): boolean => {
  if (!sim) return false;
  return sim.tipo_financiacion === 'COMPARATIVO' ||
         sim.periodicidad === 'Comparativo Dual' ||
         Boolean(sim.banco_entidad && sim.banco_entidad.includes('vs. Financiación Cotripar'));
};

const isCotriparSim = (sim?: { tipo_financiacion?: string | null; banco_entidad?: string | null } | null): boolean => {
  if (!sim) return false;
  if (isComparativoSim(sim)) return false;
  if (sim.tipo_financiacion === 'BANCARIA') return false;
  return sim.tipo_financiacion === 'F_COTRIPAR' || (sim.banco_entidad || '').toUpperCase().includes('COTRIPAR');
};

const isBancoSim = (sim?: { tipo_financiacion?: string | null; banco_entidad?: string | null } | null): boolean => {
  if (!sim) return false;
  if (isComparativoSim(sim)) return false;
  if (isCotriparSim(sim)) return false;
  return true;
};

const normalizeBancoNombre = (sim?: { tipo_financiacion?: string | null; banco_entidad?: string | null; comparativo_json?: any; periodicidad?: string | null } | null): string => {
  if (isComparativoSim(sim)) {
    const bName = sim?.comparativo_json?.bancoNombre;
    return bName ? `Comparativo: ${bName} vs. Cotripar` : (sim?.banco_entidad?.trim() || 'Comparativo Banco vs. Cotripar');
  }
  if (isCotriparSim(sim)) {
    return 'Financiación Cotripar';
  }
  return sim?.banco_entidad?.trim() || 'Banco Comercial';
};

export const HistoryModal: React.FC<HistoryModalProps> = ({
  onLoadSimulation,
  showToast
}) => {
  const { currentUser } = useAuth();

  const [simulaciones, setSimulaciones] = useState<SimulacionPDF[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Filters State
  const [periodoTipo, setPeriodoTipo] = useState<PeriodoTipo>('todo');
  const [selectedAnio, setSelectedAnio] = useState<number>(new Date().getFullYear());
  const [selectedMes, setSelectedMes] = useState<number>(new Date().getMonth());
  const [selectedSemestre, setSelectedSemestre] = useState<1 | 2>(new Date().getMonth() < 6 ? 1 : 2);
  const [selectedTipoFinanciacion, setSelectedTipoFinanciacion] = useState<string>('todos');
  const [selectedAsesor, setSelectedAsesor] = useState<string>('todos');
  const [selectedBanco, setSelectedBanco] = useState<string>('todos');
  const [selectedMarca, setSelectedMarca] = useState<string>('todas');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Offer Letter Modal State (Admin Only)
  const [offerModalSim, setOfferModalSim] = useState<SimulacionPDF | null>(null);
  const [isGeneratingOffer, setIsGeneratingOffer] = useState<boolean>(false);
  const [offerFormData, setOfferFormData] = useState({
    numeroOferta: '',
    validezOferta: '20 días calendario',
    clienteNombre: '',
    clienteRuc: '',
    vendedorNombre: '',
    bancoEntidad: '',
    maquinaImplemento: '',
    especificacionTecnica: '',
    cantidad: 1,
    precioTotalUSD: 0,
    anticipoUSD: 0,
    descuentoUSD: 0,
    ubicacion: 'Santa Rita / Alto Paraná, Paraguay',
    telefono: '+595 673 220 000',
    atencionContacto: 'Gerencia de Crédito Agropecuario',
    items: [] as ItemMaquinaria[]
  });

  const meses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

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

  // Dynamic filter options extracted from data
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    years.add(new Date().getFullYear());
    simulaciones.forEach((s) => {
      if (s.created_at) {
        const y = new Date(s.created_at).getFullYear();
        if (!isNaN(y)) years.add(y);
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [simulaciones]);

  const availableAsesores = useMemo(() => {
    const set = new Set<string>();
    simulaciones.forEach((s) => {
      if (s.vendedor_nombre?.trim()) set.add(s.vendedor_nombre.trim());
    });
    return Array.from(set).sort();
  }, [simulaciones]);

  const availableBancos = useMemo(() => {
    const set = new Set<string>();
    simulaciones.forEach((s) => {
      const b = normalizeBancoNombre(s);
      if (b) set.add(b);
    });
    return Array.from(set).sort();
  }, [simulaciones]);

  const availableMarcas = useMemo(() => {
    const set = new Set<string>();
    simulaciones.forEach((s) => {
      if (s.marca_producto?.trim()) {
        s.marca_producto.split(',').forEach((m) => {
          const trimmed = m.trim();
          if (trimmed) set.add(trimmed);
        });
      }
      if (s.items_json && Array.isArray(s.items_json)) {
        s.items_json.forEach((it) => {
          if (it.marca?.trim()) set.add(it.marca.trim());
        });
      }
    });
    return Array.from(set).sort();
  }, [simulaciones]);

  // Main Filtering Logic
  const filteredSimulaciones = useMemo(() => {
    return simulaciones.filter((sim) => {
      const date = sim.created_at ? new Date(sim.created_at) : new Date();
      const year = date.getFullYear();
      const month = date.getMonth();

      // Period filter
      if (periodoTipo === 'anio') {
        if (year !== selectedAnio) return false;
      } else if (periodoTipo === 'mes') {
        if (year !== selectedAnio || month !== selectedMes) return false;
      } else if (periodoTipo === 'semestre') {
        if (year !== selectedAnio) return false;
        const sem = month < 6 ? 1 : 2;
        if (sem !== selectedSemestre) return false;
      }

      // Tipo de Financiación filter
      if (selectedTipoFinanciacion !== 'todos') {
        if (selectedTipoFinanciacion === 'COMPARATIVO' && !isComparativoSim(sim) && !sim.comparativo_json) return false;
        if (selectedTipoFinanciacion === 'F_COTRIPAR' && !isCotriparSim(sim)) return false;
        if (selectedTipoFinanciacion === 'BANCARIA' && !isBancoSim(sim)) return false;
      }

      // Asesor filter
      if (selectedAsesor !== 'todos' && sim.vendedor_nombre !== selectedAsesor) {
        return false;
      }

      // Banco filter
      if (selectedBanco !== 'todos' && normalizeBancoNombre(sim) !== selectedBanco) {
        return false;
      }

      // Marca filter
      if (selectedMarca !== 'todas') {
        const sMarca = (sim.marca_producto || '').toLowerCase();
        const target = selectedMarca.toLowerCase();
        const matchInMarcaField = sMarca.includes(target);
        const matchInItems = sim.items_json && Array.isArray(sim.items_json)
          ? sim.items_json.some((it) => (it.marca || '').toLowerCase().includes(target))
          : false;
        if (!matchInMarcaField && !matchInItems) return false;
      }

      // Search (Name or RUC or Asesor or Bank or Marca)
      if (searchTerm.trim() !== '') {
        const term = searchTerm.toLowerCase();
        const matchName = (sim.cliente_nombre || '').toLowerCase().includes(term);
        const matchRuc = (sim.cliente_ruc || '').toLowerCase().includes(term);
        const matchMaquina = (sim.maquina_implemento || '').toLowerCase().includes(term);
        const matchAsesor = (sim.vendedor_nombre || '').toLowerCase().includes(term);
        const matchBanco = (sim.banco_entidad || '').toLowerCase().includes(term) || normalizeBancoNombre(sim).toLowerCase().includes(term);
        const matchMarca = (sim.marca_producto || '').toLowerCase().includes(term);
        if (!matchName && !matchRuc && !matchMaquina && !matchAsesor && !matchBanco && !matchMarca) return false;
      }

      return true;
    });
  }, [
    simulaciones,
    periodoTipo,
    selectedAnio,
    selectedMes,
    selectedSemestre,
    selectedTipoFinanciacion,
    selectedAsesor,
    selectedBanco,
    selectedMarca,
    searchTerm
  ]);

  // Analytical KPIs
  const totalProyecciones = filteredSimulaciones.length;
  const rucsUnicos = useMemo(() => {
    return new Set(filteredSimulaciones.map((s) => s.cliente_ruc?.trim()).filter(Boolean)).size;
  }, [filteredSimulaciones]);

  const volumenTotalCapital = useMemo(() => {
    return filteredSimulaciones.reduce((sum, s) => sum + Number(s.capital_usd || 0), 0);
  }, [filteredSimulaciones]);

  const volumenTotalPagar = useMemo(() => {
    return filteredSimulaciones.reduce((sum, s) => sum + Number(s.total_pagado_usd || 0), 0);
  }, [filteredSimulaciones]);

  const ticketPromedioCapital = totalProyecciones > 0 ? volumenTotalCapital / totalProyecciones : 0;

  const { bancoMasSolicitado, plazoMasSolicitado } = useMemo(() => {
    if (filteredSimulaciones.length === 0) {
      return { bancoMasSolicitado: '-', plazoMasSolicitado: '-' };
    }
    const bancoCounts: Record<string, number> = {};
    const plazoCounts: Record<number, number> = {};
    filteredSimulaciones.forEach((s) => {
      const b = normalizeBancoNombre(s);
      bancoCounts[b] = (bancoCounts[b] || 0) + 1;
      const p = s.plazo_anios || 5;
      plazoCounts[p] = (plazoCounts[p] || 0) + 1;
    });
    const topBanco = Object.entries(bancoCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';
    const topPlazo = Object.entries(plazoCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';
    const topPlazoLabel = topPlazo === '-' ? '-' : (Math.abs(Number(topPlazo) - 1.5) < 0.05 ? '18 meses' : `${topPlazo} años`);
    return { bancoMasSolicitado: topBanco, plazoMasSolicitado: topPlazoLabel };
  }, [filteredSimulaciones]);

  // BI Breakdown 1: Rendimiento por Asesor
  const rendimientoAsesores = useMemo(() => {
    const stats: Record<string, { nombre: string; count: number; volumen: number }> = {};
    filteredSimulaciones.forEach((s) => {
      const key = s.vendedor_nombre || 'Asesor Cotripar';
      if (!stats[key]) {
        stats[key] = { nombre: key, count: 0, volumen: 0 };
      }
      stats[key].count += 1;
      stats[key].volumen += Number(s.capital_usd || 0);
    });
    return Object.values(stats).sort((a, b) => b.count - a.count);
  }, [filteredSimulaciones]);

  // BI Breakdown 2: Distribución por Banco
  const distribucionBancos = useMemo(() => {
    const stats: Record<string, { nombre: string; count: number; volumen: number; tasaSum: number }> = {};
    filteredSimulaciones.forEach((s) => {
      const key = normalizeBancoNombre(s);
      if (!stats[key]) {
        stats[key] = { nombre: key, count: 0, volumen: 0, tasaSum: 0 };
      }
      stats[key].count += 1;
      stats[key].volumen += Number(s.capital_usd || 0);
      stats[key].tasaSum += Number(s.tasa_anual || 0);
    });
    return Object.values(stats)
      .map((item) => ({
        ...item,
        tasaPromedio: item.count > 0 ? item.tasaSum / item.count : 0
      }))
      .sort((a, b) => b.volumen - a.volumen);
  }, [filteredSimulaciones]);

  // BI Breakdown 3: Cotizaciones y Volumen por Marca
  const distribucionMarcas = useMemo(() => {
    const stats: Record<string, { nombre: string; count: number; volumen: number }> = {};
    filteredSimulaciones.forEach((s) => {
      const marcasArr = s.marca_producto
        ? s.marca_producto.split(',').map((m) => m.trim()).filter(Boolean)
        : [];
      const list = marcasArr.length > 0 ? Array.from(new Set(marcasArr)) : ['Otras Marcas'];

      list.forEach((marca) => {
        if (!stats[marca]) {
          stats[marca] = { nombre: marca, count: 0, volumen: 0 };
        }
        stats[marca].count += 1;
        stats[marca].volumen += Number(s.capital_usd || 0);
      });
    });
    return Object.values(stats).sort((a, b) => b.volumen - a.volumen);
  }, [filteredSimulaciones]);

  // Export CSV Function (Excel Compatible with UTF-8 BOM and ;)
  const sanitizeCSVCell = (val: string | number | null | undefined): string => {
    if (val === null || val === undefined) return '""';
    let str = String(val).replace(/"/g, '""');
    if (/^[=\+\-@\t\r]/.test(str)) {
      str = "'" + str;
    }
    return `"${str}"`;
  };

  const handleExportCSV = () => {
    if (filteredSimulaciones.length === 0) {
      showToast('No hay datos para exportar con los filtros actuales');
      return;
    }

    const headers = [
      'Fecha',
      'Hora',
      'Protocolo',
      'Tipo Financiación',
      'Asesor Comercial',
      'Cliente',
      'RUC',
      'Marca',
      'Máquina / Implemento',
      'Banco / Entidad',
      'Tasa (%)',
      'Capital Solicitado (USD)',
      'Gasto Admin (USD)',
      'Plazo (Meses / Años)',
      'Periodicidad',
      'Modalidad',
      'Total Intereses (USD)',
      'Total IVA (USD)',
      'Costo Financiero Total (USD)',
      'Mayor Cuota Año 1 (USD)',
      'Total a Pagar (USD)'
    ].join(';');

    const rows = filteredSimulaciones.map((sim) => {
      const dateObj = sim.created_at ? new Date(sim.created_at) : new Date();
      const fecha = dateObj.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
      const hora = dateObj.toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
      const proto = `COT-SIM-${dateObj.getFullYear()}${String(dateObj.getMonth() + 1).padStart(2, '0')}${String(dateObj.getDate()).padStart(2, '0')}-${(sim.id || '').substring(0, 4).toUpperCase()}`;

      const isComparativo = isComparativoSim(sim);
      const isCotripar = isCotriparSim(sim);
      const tipoFin = isComparativo
        ? 'Comparativo (Banco vs. Cotripar)'
        : (isCotripar ? 'Financiación Cotripar' : 'Financiación Bancaria (SAC)');
      const bancoTxt = isComparativo
        ? normalizeBancoNombre(sim)
        : (isCotripar ? 'Financiación Cotripar' : (sim.banco_entidad || 'Banco'));
      const plazoNum = Number(sim.plazo_anios);
      const plazoTxt = isCotripar
        ? `${sim.plazo_meses || 17} meses`
        : (Math.abs(plazoNum - 1.5) < 0.05 ? '18 meses' : `${plazoNum} ${plazoNum === 1 ? 'año' : 'años'}`);
      const tasaTxt = isCotripar
        ? `${Number(sim.tasa_anual > 2 ? sim.tasa_anual / 12 : sim.tasa_anual).toFixed(2)}% m.`
        : `${Number(sim.tasa_anual || 0).toFixed(2)}% a.`;

      return [
        fecha,
        hora,
        proto,
        sanitizeCSVCell(tipoFin),
        sanitizeCSVCell(sim.vendedor_nombre || ''),
        sanitizeCSVCell(sim.cliente_nombre || ''),
        sanitizeCSVCell(sim.cliente_ruc || ''),
        sanitizeCSVCell(sim.marca_producto || '-'),
        sanitizeCSVCell(sim.maquina_implemento || ''),
        sanitizeCSVCell(bancoTxt),
        sanitizeCSVCell(tasaTxt),
        Number(sim.capital_usd || 0).toFixed(2),
        Number(sim.gasto_admin_usd || 0).toFixed(2),
        sanitizeCSVCell(plazoTxt),
        sanitizeCSVCell(sim.periodicidad || 'anual'),
        sanitizeCSVCell(sim.modalidad_semestral || '-'),
        Number(sim.total_intereses_usd || 0).toFixed(2),
        Number(sim.total_iva_usd || 0).toFixed(2),
        Number(sim.costo_financiero_total_usd || 0).toFixed(2),
        Number(sim.mayor_cuota_anio1_usd || 0).toFixed(2),
        Number(sim.total_pagado_usd || 0).toFixed(2)
      ].join(';');
    });

    const csvContent = '\uFEFF' + [headers, ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Cotripar_Reporte_BI_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('¡Reporte CSV exportado con éxito!');
  };

  const handleDelete = async (id: string, clienteNombre: string) => {
    if (!currentUser || currentUser.rol !== 'admin') {
      showToast('Acceso denegado: solo Administradores pueden eliminar registros del historial.');
      return;
    }

    if (!window.confirm(`¿Está seguro de eliminar la simulación de "${clienteNombre}"?`)) {
      return;
    }

    setDeletingId(id);
    try {
      const { error } = await supabase.from('simulaciones_pdf').delete().eq('id', id);

      if (!error) {
        setSimulaciones((prev) => prev.filter((s) => s.id !== id));
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

  const handleDownloadHistoricalPDF = async (sim: SimulacionPDF) => {
    const safeName = (sim.cliente_nombre || 'Cliente').replace(/\s+/g, '_');
    const safeRuc = (sim.cliente_ruc || '').replace(/\s+/g, '');

    if (isComparativoSim(sim) && sim.comparativo_json) {
      const doc = await generarPDFComparativo(sim.comparativo_json);
      doc.save(`Cotripar_Comparativo_${safeName}${safeRuc ? `_${safeRuc}` : ''}.pdf`);
      showToast('¡PDF Comparativo histórico descargado con éxito!');
      return;
    }

    const isCotripar = isCotriparSim(sim);
    const tasaMensual = isCotripar
      ? (sim.tasa_anual > 2 ? sim.tasa_anual / 12 : sim.tasa_anual)
      : undefined;

    const resultadoMock: ResultadoAleman = {
      capital: sim.capital_usd,
      tasaAnual: sim.tasa_anual,
      tasaMensual,
      plazoAnios: sim.plazo_anios,
      plazoMeses: sim.plazo_meses,
      mesColocacion: sim.mes_colocacion,
      fechaTopeVencimiento: sim.fecha_tope_vencimiento,
      tipoFinanciacion: isCotripar ? 'F_COTRIPAR' : (sim.tipo_financiacion as any),
      frecuencia: (sim.periodicidad === 'semestral' || sim.periodicidad === 'semestral_zafra')
        ? 'semestral'
        : (sim.periodicidad === 'mensual' ? 'mensual' as any : 'anual'),
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
      bancoEntidad: isCotripar ? 'Financiación Cotripar' : sim.banco_entidad,
      fechasCuotas: sim.fechas_cuotas,
      fechaUltimaCuota: sim.fecha_ultima_cuota,
      cantidadCuotas: sim.cantidad_cuotas || (sim.cronograma_json ? sim.cronograma_json.length : undefined)
    };

    const doc = await generarPDFSimulacion(sim, resultadoMock);
    const prefix = isCotripar ? 'Cotripar_Financiacion_Cotripar' : 'Cotripar_Simulacion';
    doc.save(`${prefix}_${safeName}${safeRuc ? `_${safeRuc}` : ''}.pdf`);
    showToast('¡PDF histórico descargado con éxito!');
  };

  const handleDownloadComparativoPDF = async (sim: SimulacionPDF) => {
    if (!sim.comparativo_json) {
      showToast('No se encontró el comparativo adjunto');
      return;
    }
    const safeName = (sim.cliente_nombre || 'Cliente').replace(/\s+/g, '_');
    const safeRuc = (sim.cliente_ruc || '').replace(/\s+/g, '');
    const doc = await generarPDFComparativo(sim.comparativo_json);
    doc.save(`Cotripar_Comparativo_${safeName}${safeRuc ? `_${safeRuc}` : ''}.pdf`);
    showToast('¡PDF Comparativo descargado con éxito!');
  };

  const handleOpenOfferLetterModal = (sim: SimulacionPDF) => {
    const isComparativo = isComparativoSim(sim);
    const dateObj = sim.created_at ? new Date(sim.created_at) : new Date();
    const year = dateObj.getFullYear();
    const suffix = sim.id ? sim.id.slice(0, 4).toUpperCase() : '001';
    const autoNum = `OF-${year}-${suffix}`;

    // Si es comparativo, extrae los datos del banco comparado
    const bancoNombreFinal = isComparativo
      ? (sim.comparativo_json?.bancoComparado ||
         sim.comparativo_json?.bancoNombre ||
         (sim.banco_entidad || '').replace(' vs. Financiación Cotripar', '').trim() ||
         'Banco Oficial')
      : (sim.banco_entidad || 'Banco Oficial');

    const initialItems: ItemMaquinaria[] =
      sim.items_json && Array.isArray(sim.items_json) && sim.items_json.length > 0
        ? sim.items_json.map((it) => ({
            ...it,
            marca: it.marca || sim.marca_producto || 'Cotripar'
          }))
        : [
            {
              id: '1',
              marca: sim.marca_producto || 'Cotripar',
              descripcion: sim.maquina_implemento || 'Equipamiento Agrícola Cotripar',
              cantidad: 1,
              precioUnitarioUSD: Number(sim.capital_usd) + (Number(sim.anticipo_usd) || 0)
            }
          ];

    const initialAnticipo = isComparativo && sim.comparativo_json?.anticipoBanco !== undefined
      ? Number(sim.comparativo_json.anticipoBanco)
      : (Number(sim.anticipo_usd) || 0);

    const itemsTotal = initialItems.reduce(
      (acc, it) => acc + (Number(it.cantidad) || 1) * (Number(it.precioUnitarioUSD) || 0),
      0
    );

    setOfferModalSim(sim);
    setOfferFormData({
      numeroOferta: autoNum,
      validezOferta: '20 días calendario',
      clienteNombre: sim.cliente_nombre || '',
      clienteRuc: sim.cliente_ruc || '',
      vendedorNombre: sim.vendedor_nombre || currentUser?.nombre || 'Asesor Comercial Cotripar',
      bancoEntidad: bancoNombreFinal,
      maquinaImplemento: sim.maquina_implemento || 'Equipamiento Agrícola Cotripar',
      especificacionTecnica:
        'Maquinaria agrícola con especificaciones estándar del fabricante, lista para entrega técnica y garantía integral.',
      cantidad: initialItems.reduce((acc, it) => acc + (Number(it.cantidad) || 1), 0),
      precioTotalUSD: itemsTotal,
      anticipoUSD: initialAnticipo,
      descuentoUSD: 0,
      ubicacion: 'Santa Rita / Alto Paraná, Paraguay',
      telefono: '+595 673 220 000',
      atencionContacto: 'Gerencia de Negocios y Crédito Agropecuario',
      items: initialItems
    });
  };

  const handleOfferAddItem = () => {
    setOfferFormData((prev) => {
      const newItems: ItemMaquinaria[] = [
        ...prev.items,
        {
          id: Date.now().toString(),
          descripcion: '',
          cantidad: 1,
          precioUnitarioUSD: 0
        }
      ];
      const newSubtotal = newItems.reduce(
        (acc, it) => acc + (Number(it.cantidad) || 1) * (Number(it.precioUnitarioUSD) || 0),
        0
      );
      return {
        ...prev,
        items: newItems,
        precioTotalUSD: newSubtotal
      };
    });
  };

  const handleOfferRemoveItem = (id: string) => {
    setOfferFormData((prev) => {
      if (prev.items.length <= 1) return prev;
      const newItems = prev.items.filter((it) => it.id !== id);
      const newSubtotal = newItems.reduce(
        (acc, it) => acc + (Number(it.cantidad) || 1) * (Number(it.precioUnitarioUSD) || 0),
        0
      );
      return {
        ...prev,
        items: newItems,
        precioTotalUSD: newSubtotal
      };
    });
  };

  const handleOfferItemChange = (id: string, field: keyof ItemMaquinaria, val: any) => {
    setOfferFormData((prev) => {
      const newItems = prev.items.map((it) => (it.id === id ? { ...it, [field]: val } : it));
      const newSubtotal = newItems.reduce(
        (acc, it) => acc + (Number(it.cantidad) || 1) * (Number(it.precioUnitarioUSD) || 0),
        0
      );
      return {
        ...prev,
        items: newItems,
        precioTotalUSD: newSubtotal
      };
    });
  };

  const handleGenerateOfferPDF = async () => {
    if (!offerModalSim) return;
    setIsGeneratingOffer(true);
    try {
      const dateObj = offerModalSim.created_at ? new Date(offerModalSim.created_at) : new Date();
      const mesesNombres = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre'
      ];
      const fechaEmision = `${dateObj.getDate()} de ${mesesNombres[dateObj.getMonth()]} de ${dateObj.getFullYear()}`;

      const isComparativo = isComparativoSim(offerModalSim);
      const bancoNombreFinal = offerFormData.bancoEntidad ||
        (isComparativo
          ? (offerModalSim.comparativo_json?.bancoComparado ||
             offerModalSim.comparativo_json?.bancoNombre ||
             (offerModalSim.banco_entidad || '').replace(' vs. Financiación Cotripar', '').trim())
          : offerModalSim.banco_entidad) || 'Banco Oficial';

      const payload: CartaOfertaPayload = {
        numeroOferta: offerFormData.numeroOferta || `OF-${dateObj.getFullYear()}-001`,
        fechaEmision,
        validezOferta: offerFormData.validezOferta || '20 días calendario',
        clienteNombre: offerFormData.clienteNombre || offerModalSim.cliente_nombre,
        clienteRuc: offerFormData.clienteRuc || offerModalSim.cliente_ruc || '',
        vendedorNombre: offerFormData.vendedorNombre || offerModalSim.vendedor_nombre,
        bancoEntidad: bancoNombreFinal,
        maquinaImplemento: offerFormData.maquinaImplemento || offerModalSim.maquina_implemento || 'Maquinaria Agrícola',
        especificacionTecnica: offerFormData.especificacionTecnica,
        cantidad: Number(offerFormData.cantidad) || 1,
        precioTotalUSD: Number(offerFormData.precioTotalUSD) || Number(offerModalSim.capital_usd) || 0,
        anticipoUSD: Number(offerFormData.anticipoUSD) || 0,
        descuentoUSD: Number(offerFormData.descuentoUSD) || 0,
        ubicacion: offerFormData.ubicacion,
        telefono: offerFormData.telefono,
        atencionContacto: offerFormData.atencionContacto,
        items: offerFormData.items,
        plazoAnios: isComparativo && offerModalSim.comparativo_json?.plazoAniosBanco
          ? Number(offerModalSim.comparativo_json.plazoAniosBanco)
          : offerModalSim.plazo_anios,
        periodicidad: isComparativo
          ? 'semestral'
          : offerModalSim.periodicidad,
        modalidadSemestral: isComparativo && offerModalSim.comparativo_json?.compareEsquemaBancario
          ? offerModalSim.comparativo_json.compareEsquemaBancario
          : offerModalSim.modalidad_semestral,
        tasaAnual: isComparativo && offerModalSim.comparativo_json?.tasaAnualBanco
          ? Number(offerModalSim.comparativo_json.tasaAnualBanco)
          : offerModalSim.tasa_anual,
        gastoAdminUSD: isComparativo && offerModalSim.comparativo_json?.resultadoBanco?.gastoAdmin !== undefined
          ? Number(offerModalSim.comparativo_json.resultadoBanco.gastoAdmin)
          : offerModalSim.gasto_admin_usd,
        mayorCuotaAnio1USD: isComparativo && offerModalSim.comparativo_json?.resultadoBanco?.cuotaMayorAnio1 !== undefined
          ? Number(offerModalSim.comparativo_json.resultadoBanco.cuotaMayorAnio1)
          : offerModalSim.mayor_cuota_anio1_usd,
        totalPagadoUSD: isComparativo && offerModalSim.comparativo_json?.resultadoBanco?.totalPagado !== undefined
          ? Number(offerModalSim.comparativo_json.resultadoBanco.totalPagado)
          : offerModalSim.total_pagado_usd,
        tipoFinanciacion: 'BANCARIA'
      };

      const doc = await generarPDFCartaOferta(payload);
      const safeCliente = (payload.clienteNombre || 'Cliente').replace(/[^a-zA-Z0-9]/g, '_');
      const safeNum = (payload.numeroOferta || 'OF').replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `Carta_Oferta_${safeCliente}_${safeNum}.pdf`;

      const blobUrl = doc.output('bloburl');
      window.open(blobUrl, '_blank');
      doc.save(filename);

      showToast('¡Carta de Oferta Comercial generada con éxito!');
      setOfferModalSim(null);
    } catch (err) {
      console.error('Error generando Carta de Oferta:', err);
      showToast('Error al generar la Carta de Oferta Comercial');
    } finally {
      setIsGeneratingOffer(false);
    }
  };

  // Guard: sellers cannot access History, but admin and coordinador can
  if (!currentUser || (currentUser.rol !== 'admin' && currentUser.rol !== 'coordinador')) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Top Banner / BI Header */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <BarChart3 className="w-6 h-6 text-cotripar-700" />
            <span>Panel de Inteligencia Comercial & Historial (BI)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Análisis consolidado de proyecciones crediticias, clientes atendidos y exportación analítica en tiempo real.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start lg:self-auto flex-wrap">
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
            title="Exportar registros filtrados a CSV para Excel"
          >
            <Download className="w-4 h-4" />
            <span>Exportar CSV (Excel)</span>
          </button>

          <button
            onClick={fetchSimulaciones}
            className="p-2.5 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 transition-colors"
            title="Sincronizar con Supabase"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-cotripar-700' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3.5">
        <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-slate-700 mr-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-cotripar-700" />
              <span>Período:</span>
            </span>
            {(['todo', 'mes', 'semestre', 'anio'] as PeriodoTipo[]).map((tipo) => (
              <button
                key={tipo}
                onClick={() => setPeriodoTipo(tipo)}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                  periodoTipo === tipo
                    ? 'bg-cotripar-700 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tipo === 'todo' && 'Todo el Historial'}
                {tipo === 'mes' && 'Por Mes'}
                {tipo === 'semestre' && 'Por Semestre'}
                {tipo === 'anio' && 'Por Año'}
              </button>
            ))}
          </div>

          <span className="text-xs font-bold text-slate-400">
            {filteredSimulaciones.length} de {simulaciones.length} cotizaciones
          </span>
        </div>

        {/* Dynamic Period Selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-1">
          {/* Year selector (visible when not 'todo') */}
          {periodoTipo !== 'todo' && (
            <div>
              <label className="text-[11px] font-bold text-slate-600 block mb-1">Año</label>
              <select
                value={selectedAnio}
                onChange={(e) => setSelectedAnio(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-cotripar-700 focus:outline-none"
              >
                {availableYears.map((yr) => (
                  <option key={yr} value={yr}>
                    Año {yr}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Month selector (when 'mes') */}
          {periodoTipo === 'mes' && (
            <div>
              <label className="text-[11px] font-bold text-slate-600 block mb-1">Mes</label>
              <select
                value={selectedMes}
                onChange={(e) => setSelectedMes(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-cotripar-700 focus:outline-none"
              >
                {meses.map((m, idx) => (
                  <option key={m} value={idx}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Semester selector (when 'semestre') */}
          {periodoTipo === 'semestre' && (
            <div>
              <label className="text-[11px] font-bold text-slate-600 block mb-1">Semestre</label>
              <select
                value={selectedSemestre}
                onChange={(e) => setSelectedSemestre(Number(e.target.value) as 1 | 2)}
                className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-cotripar-700 focus:outline-none"
              >
                <option value={1}>1º Semestre (Ene - Jun)</option>
                <option value={2}>2º Semestre (Jul - Dic)</option>
              </select>
            </div>
          )}

          {/* Tipo de Financiación Selector */}
          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1 flex items-center gap-1">
              <Building2 className="w-3 h-3 text-cotripar-700" />
              <span>Tipo de Financiación</span>
            </label>
            <select
              value={selectedTipoFinanciacion}
              onChange={(e) => setSelectedTipoFinanciacion(e.target.value)}
              className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-cotripar-700 focus:outline-none"
            >
              <option value="todos">Todos los Tipos</option>
              <option value="BANCARIA">Financiación Bancaria</option>
              <option value="F_COTRIPAR">Financiación Cotripar</option>
              <option value="COMPARATIVO">Comparativo Banco vs. Cotripar</option>
            </select>
          </div>

          {/* Advisor Selector */}
          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1 flex items-center gap-1">
              <Briefcase className="w-3 h-3 text-slate-400" />
              <span>Asesor Comercial</span>
            </label>
            <select
              value={selectedAsesor}
              onChange={(e) => setSelectedAsesor(e.target.value)}
              className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-cotripar-700 focus:outline-none"
            >
              <option value="todos">Todos los Asesores</option>
              {availableAsesores.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          {/* Bank Selector */}
          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1 flex items-center gap-1">
              <Building2 className="w-3 h-3 text-slate-400" />
              <span>Entidad Bancaria</span>
            </label>
            <select
              value={selectedBanco}
              onChange={(e) => setSelectedBanco(e.target.value)}
              className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-cotripar-700 focus:outline-none"
            >
              <option value="todos">Todos los Bancos</option>
              {availableBancos.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          {/* Brand Selector */}
          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1 flex items-center gap-1">
              <Tag className="w-3 h-3 text-slate-400" />
              <span>Marca de Producto</span>
            </label>
            <select
              value={selectedMarca}
              onChange={(e) => setSelectedMarca(e.target.value)}
              className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-cotripar-700 focus:outline-none"
            >
              <option value="todas">Todas las Marcas</option>
              {availableMarcas.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* Search by Client or RUC */}
          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1 flex items-center gap-1">
              <Search className="w-3 h-3 text-slate-400" />
              <span>Buscar Cliente / RUC</span>
            </label>
            <input
              type="text"
              placeholder="Nombre de cliente o RUC..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-cotripar-700 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* 4 KPI Cards (Analytical Summary) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Proyecciones & Clientes */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Proyecciones Generadas</span>
            <FolderOpen className="w-4 h-4 text-cotripar-700" />
          </div>
          <p className="text-2xl font-black text-slate-900">{totalProyecciones}</p>
          <p className="text-[11px] text-slate-400 font-medium">
            <strong className="text-slate-700 font-bold">{rucsUnicos}</strong> clientes/RUCs únicos
          </p>
        </div>

        {/* KPI 2: Volumen Total Capital */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Volumen Capital Cotizado</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-emerald-700">{formatUSD(volumenTotalCapital)}</p>
          <p className="text-[11px] text-slate-400 font-medium">
            Monto acumulado solicitado en USD
          </p>
        </div>

        {/* KPI 3: Ticket Promedio por Operación */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Ticket Promedio Capital</span>
            <TrendingUp className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-black text-slate-900">{formatUSD(ticketPromedioCapital)}</p>
          <p className="text-[11px] text-slate-400 font-medium">
            Total a pagar: <strong className="text-cotripar-700">{formatUSD(volumenTotalPagar)}</strong>
          </p>
        </div>

        {/* KPI 4: Banco y Plazo Más Solicitados */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Preferencia Crediticia</span>
            <Building2 className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-base font-extrabold text-slate-900 truncate" title={bancoMasSolicitado}>
            {bancoMasSolicitado}
          </p>
          <p className="text-[11px] text-slate-500 font-medium">
            Plazo más común: <strong className="text-slate-800">{plazoMasSolicitado}</strong>
          </p>
        </div>
      </div>

      {/* 3 Quadros de Análise lado a lado (BI) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Panel 1: Rendimiento por Asesor */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-cotripar-700" />
              <span>Rendimiento por Asesor Comercial</span>
            </h3>
            <span className="text-xs text-slate-400 font-semibold">{rendimientoAsesores.length} asesores</span>
          </div>

          {rendimientoAsesores.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">Sin registros para el período seleccionado.</p>
          ) : (
            <div className="space-y-3">
              {rendimientoAsesores.map((item) => {
                const percent = totalProyecciones > 0 ? (item.count / totalProyecciones) * 100 : 0;
                return (
                  <div key={item.nombre} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800">{item.nombre}</span>
                      <div className="text-right">
                        <span className="font-extrabold text-slate-900 mr-2">{item.count} cotizaciones</span>
                        <span className="text-[11px] text-slate-500 font-medium">({formatUSD(item.volumen)})</span>
                      </div>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-cotripar-700 rounded-full transition-all"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Panel 2: Distribución por Banco */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Building2 className="w-4 h-4 text-cotripar-700" />
              <span>Distribución por Entidad Bancaria</span>
            </h3>
            <span className="text-xs text-slate-400 font-semibold">{distribucionBancos.length} bancos</span>
          </div>

          {distribucionBancos.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">Sin registros para el período seleccionado.</p>
          ) : (
            <div className="space-y-3">
              {distribucionBancos.map((item) => {
                const percent = totalProyecciones > 0 ? (item.count / totalProyecciones) * 100 : 0;
                return (
                  <div key={item.nombre} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800">{item.nombre}</span>
                      <div className="text-right">
                        <span className="font-bold text-cotripar-700 mr-2">{item.tasaPromedio.toFixed(2)}% anual</span>
                        <span className="text-slate-600 font-extrabold">{formatUSD(item.volumen)}</span>
                      </div>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-slate-700 rounded-full transition-all"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Panel 3: Cotizaciones y Volumen por Marca */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Tag className="w-4 h-4 text-emerald-600" />
              <span>🏷️ Cotizaciones y Volumen por Marca</span>
            </h3>
            <span className="text-xs text-slate-400 font-semibold">{distribucionMarcas.length} marcas</span>
          </div>

          {distribucionMarcas.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">Sin registros para el período seleccionado.</p>
          ) : (
            <div className="space-y-3">
              {distribucionMarcas.map((item) => {
                const percent = totalProyecciones > 0 ? (item.count / totalProyecciones) * 100 : 0;
                return (
                  <div key={item.nombre} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                        {item.nombre}
                      </span>
                      <div className="text-right">
                        <span className="font-extrabold text-slate-900 mr-2">{item.count} cotiz.</span>
                        <span className="text-[11px] text-emerald-700 font-bold">({formatUSD(item.volumen)})</span>
                      </div>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-600 rounded-full transition-all"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Detailed Simulations Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <span>Listado Detallado de Simulaciones</span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-slate-100 text-slate-700">
              {filteredSimulaciones.length} registros
            </span>
          </h3>
          <span className="text-xs text-slate-400 font-medium">
            Haga clic en el ícono para descargar el PDF histórico o cargarlo en la calculadora.
          </span>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-cotripar-700" />
            <p className="text-xs font-semibold">Cargando simulaciones desde Supabase...</p>
          </div>
        ) : filteredSimulaciones.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <FolderOpen className="w-10 h-10 mx-auto text-slate-300" />
            <p className="text-sm font-semibold text-slate-700">No se encontraron cotizaciones con los filtros aplicados</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Pruebe cambiando el período, limpiando el texto de búsqueda o seleccionando "Todo el Historial".
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/80 text-slate-600 font-bold border-b border-slate-200">
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4">Cliente / RUC</th>
                  <th className="py-3 px-3">Marca</th>
                  <th className="py-3 px-3">Máquina / Implemento</th>
                  <th className="py-3 px-3">Asesor</th>
                  <th className="py-3 px-3">Modalidad / Banco</th>
                  <th className="py-3 px-3 text-right">Capital</th>
                  <th className="py-3 px-3">Plazo</th>
                  <th className="py-3 px-3 text-right">Mayor Cuota Año 1</th>
                  <th className="py-3 px-4 text-right">Total a Pagar</th>
                  <th className="py-3 px-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredSimulaciones.map((sim) => {
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
                        <span className="font-bold text-slate-900 block truncate max-w-[170px]" title={sim.cliente_nombre}>
                          {sim.cliente_nombre}
                        </span>
                        {sim.cliente_ruc ? (
                          <span className="text-[10px] text-slate-500 font-mono block">RUC: {sim.cliente_ruc}</span>
                        ) : (
                          <span className="text-[10px] text-slate-400 block">-</span>
                        )}
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-extrabold bg-slate-100 text-slate-800 border border-slate-200">
                          🏷️ {sim.marca_producto || 'Cotripar'}
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        <span className="text-[11px] text-slate-800 font-semibold block truncate max-w-[190px]" title={sim.maquina_implemento}>
                          🚜 {sim.maquina_implemento || 'Equipamiento Agrícola'}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                        {sim.vendedor_nombre}
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        {isComparativoSim(sim) ? (
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="inline-flex items-center gap-1 font-extrabold text-indigo-800 bg-indigo-100 border border-indigo-300 px-2 py-0.5 rounded-md text-[11px] shadow-xs">
                                🔄 Comparativo
                              </span>
                              <span className="font-semibold text-slate-800 text-[11px]">
                                {sim.banco_entidad}
                              </span>
                            </div>
                            <span className="text-[10px] text-indigo-700 block mt-0.5 font-semibold">
                              Banco: {formatPercent(sim.tasa_anual)} vs. Cotripar:{' '}
                              {Number(sim.comparativo_json?.resultadoCotripar?.tasaMensual ?? 0.80).toFixed(2)}% m.
                            </span>
                          </div>
                        ) : isCotriparSim(sim) ? (
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="inline-flex items-center gap-1 font-extrabold text-cotripar-700 bg-cotripar-50 border border-cotripar-200 px-2 py-0.5 rounded-md text-[11px]">
                                Financiación Cotripar
                              </span>
                              {Boolean(sim.comparativo_json) && (
                                <span className="inline-flex items-center gap-1 font-extrabold text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded text-[10px] shadow-xs" title="Tiene comparativo bancario adjunto">
                                  ⚖️ Comparativo Adjunto
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-500 block mt-0.5 font-semibold">
                              {Number(sim.tasa_anual > 2 ? sim.tasa_anual / 12 : sim.tasa_anual).toFixed(2)}% mensual
                            </span>
                          </div>
                        ) : (
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-slate-800 flex items-center gap-1">
                                <Building2 className="w-3 h-3 text-slate-400" />
                                {sim.banco_entidad}
                              </span>
                              {Boolean(sim.comparativo_json) && (
                                <span className="inline-flex items-center gap-1 font-extrabold text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded text-[10px] shadow-xs" title="Tiene comparativo adjunto">
                                  ⚖️ Comparativo Adjunto
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-500 block">{formatPercent(sim.tasa_anual)}</span>
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3 text-right font-bold text-slate-900 whitespace-nowrap">
                        {formatUSD(sim.capital_usd)}
                      </td>

                      <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                        {isComparativoSim(sim) ? (
                          <div>
                            <span className="font-bold text-slate-900">
                              {Math.abs(Number(sim.plazo_anios) - 1.5) < 0.05
                                ? '18m'
                                : `${sim.plazo_anios}a`}{' '}
                              vs. {sim.plazo_meses || 17}m
                            </span>
                            <span className="text-[10px] text-emerald-700 block font-semibold">
                              Comparativo Dual
                            </span>
                          </div>
                        ) : isCotriparSim(sim) ? (
                          <div>
                            <span className="font-bold text-slate-900">{sim.plazo_meses || 17} meses</span>
                            <span className="text-[10px] text-cotripar-600 block font-medium">Tope: {sim.fecha_tope_vencimiento || '-'}</span>
                          </div>
                        ) : (
                          <div>
                            <span className="font-semibold">
                              {Math.abs(Number(sim.plazo_anios) - 1.5) < 0.05
                                ? '18 meses'
                                : `${sim.plazo_anios} ${Number(sim.plazo_anios) === 1 ? 'año' : 'años'}`}
                            </span>
                            <span className="text-[10px] text-slate-400 block capitalize">{sim.periodicidad}</span>
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3 text-right font-bold text-amber-700 whitespace-nowrap">
                        {formatUSD(sim.mayor_cuota_anio1_usd)}
                      </td>

                      <td className="py-3 px-4 text-right font-extrabold text-cotripar-700 whitespace-nowrap">
                        {formatUSD(sim.total_pagado_usd)}
                      </td>

                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {isComparativoSim(sim) ? (
                            <>
                              {/* Fila Comparativa: Solo 1 botón de descarga (Balanza), Cargar y Eliminar. Sin Carta Oferta */}
                              <button
                                onClick={() => handleDownloadComparativoPDF(sim)}
                                className="p-1.5 text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded-lg transition-colors"
                                title="Descargar Comparativo PDF"
                              >
                                <Scale className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => onLoadSimulation(sim)}
                                className="p-1.5 text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Cargar en la Calculadora"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </button>

                              {currentUser?.rol === 'admin' && (
                                <button
                                  onClick={() => sim.id && handleDelete(sim.id, sim.cliente_nombre)}
                                  disabled={deletingId === sim.id}
                                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Eliminar registro"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </>
                          ) : (
                            <>
                              {/* Filas habituales: Cotripar o Banco */}
                              {isBancoSim(sim) && (currentUser?.rol === 'admin' || currentUser?.rol === 'coordinador') && (
                                <button
                                  onClick={() => handleOpenOfferLetterModal(sim)}
                                  className="px-2.5 py-1 text-cotripar-700 hover:text-white hover:bg-cotripar-700 bg-cotripar-50 border border-cotripar-200 rounded-lg transition-all duration-150 flex items-center gap-1 font-bold text-xs shadow-xs"
                                  title="Generar Carta de Oferta Comercial para el Banco"
                                >
                                  <FileSignature className="w-3.5 h-3.5" />
                                  <span>Carta Oferta</span>
                                </button>
                              )}

                              {Boolean(sim.comparativo_json) && (
                                <button
                                  onClick={() => handleDownloadComparativoPDF(sim)}
                                  className="p-1.5 text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded-lg transition-colors"
                                  title="Descargar Reporte Comparativo (Banco vs. Cotripar)"
                                >
                                  <Scale className="w-4 h-4" />
                                </button>
                              )}

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

                              {currentUser?.rol === 'admin' && (
                                <button
                                  onClick={() => sim.id && handleDelete(sim.id, sim.cliente_nombre)}
                                  disabled={deletingId === sim.id}
                                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Eliminar registro"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </>
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

      {/* Modal: Emitir Carta de Oferta Comercial para el Banco */}
      {offerModalSim && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-4xl w-full max-h-[92vh] flex flex-col my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-cotripar-900 text-white px-6 py-4.5 flex items-center justify-between border-b border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-cotripar-600/30 border border-cotripar-500/40 flex items-center justify-center text-white">
                  <FileSignature className="w-5 h-5 text-cotripar-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    Emitir Carta de Oferta Comercial (Banco)
                    <span className="text-[10px] font-semibold bg-cotripar-500/30 text-cotripar-200 px-2 py-0.5 rounded-full border border-cotripar-400/30">
                      Exclusivo Admin
                    </span>
                  </h3>
                  <p className="text-xs text-slate-300">
                    Documento formal emitido a nombre de la entidad bancaria para tramitación de crédito agropecuario.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setOfferModalSim(null)}
                className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800/80 transition-colors"
                title="Cerrar ventana"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-700">
              {/* Sección 1: Datos de Emisión y Banco */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-cotripar-600" />
                  1. Protocolo de Oferta y Banco Destinatario
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      N° de Oferta Comercial
                    </label>
                    <input
                      type="text"
                      value={offerFormData.numeroOferta}
                      onChange={(e) => setOfferFormData({ ...offerFormData, numeroOferta: e.target.value })}
                      className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-cotripar-500 focus:bg-white outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Validez de la Oferta
                    </label>
                    <input
                      type="text"
                      value={offerFormData.validezOferta}
                      onChange={(e) => setOfferFormData({ ...offerFormData, validezOferta: e.target.value })}
                      className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-cotripar-500 focus:bg-white outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Banco Destinatario
                    </label>
                    <input
                      type="text"
                      value={offerFormData.bancoEntidad}
                      onChange={(e) => setOfferFormData({ ...offerFormData, bancoEntidad: e.target.value })}
                      className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-cotripar-500 focus:bg-white outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Atención / A cargo de (Opcional)
                    </label>
                    <input
                      type="text"
                      value={offerFormData.atencionContacto}
                      onChange={(e) => setOfferFormData({ ...offerFormData, atencionContacto: e.target.value })}
                      placeholder="Oficial de Crédito"
                      className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-cotripar-500 focus:bg-white outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Sección 2: Datos del Cliente y Asesor Cotripar */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-cotripar-600" />
                  2. Cliente Proponente y Asesor Comercial
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Nombre o Razón Social del Cliente
                    </label>
                    <input
                      type="text"
                      value={offerFormData.clienteNombre}
                      onChange={(e) => setOfferFormData({ ...offerFormData, clienteNombre: e.target.value })}
                      className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-cotripar-500 focus:bg-white outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      RUC o C.I. del Cliente
                    </label>
                    <input
                      type="text"
                      value={offerFormData.clienteRuc}
                      onChange={(e) => setOfferFormData({ ...offerFormData, clienteRuc: e.target.value })}
                      className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-cotripar-500 focus:bg-white outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Asesor Comercial Cotripar
                    </label>
                    <input
                      type="text"
                      value={offerFormData.vendedorNombre}
                      onChange={(e) => setOfferFormData({ ...offerFormData, vendedorNombre: e.target.value })}
                      className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-cotripar-500 focus:bg-white outline-none"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Ubicación / Ciudad de Emisión
                    </label>
                    <input
                      type="text"
                      value={offerFormData.ubicacion}
                      onChange={(e) => setOfferFormData({ ...offerFormData, ubicacion: e.target.value })}
                      className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-cotripar-500 focus:bg-white outline-none"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Teléfono de Contacto del Asesor
                    </label>
                    <input
                      type="text"
                      value={offerFormData.telefono}
                      onChange={(e) => setOfferFormData({ ...offerFormData, telefono: e.target.value })}
                      className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-cotripar-500 focus:bg-white outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Sección 3: Maquinaria y Valores Financieros */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-cotripar-600" />
                    3. Maquinaria Cotizada y Desglose Económico
                  </h4>
                  <button
                    type="button"
                    onClick={handleOfferAddItem}
                    className="text-xs font-bold text-cotripar-700 hover:text-cotripar-800 flex items-center gap-1 bg-cotripar-50 hover:bg-cotripar-100 px-2.5 py-1 rounded-lg border border-cotripar-200 transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Agregar Ítem</span>
                  </button>
                </div>

                {/* Items List in Modal */}
                <div className="space-y-3 mb-4">
                  {offerFormData.items.map((it, idx) => (
                    <div
                      key={it.id || idx}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 relative"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-extrabold text-cotripar-700 uppercase">
                          Ítem #{String(idx + 1).padStart(2, '0')}
                        </span>
                        {offerFormData.items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleOfferRemoveItem(it.id)}
                            className="text-slate-400 hover:text-red-600 p-1 text-xs"
                            title="Eliminar este ítem"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                        <div className="sm:col-span-6">
                          <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                            Descripción del Equipo
                          </label>
                          <input
                            type="text"
                            value={it.descripcion}
                            onChange={(e) => handleOfferItemChange(it.id, 'descripcion', e.target.value)}
                            className="w-full text-xs font-semibold px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-cotripar-500 outline-none"
                            placeholder="Descripción de la maquinaria"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                            Cant.
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={it.cantidad}
                            onChange={(e) =>
                              handleOfferItemChange(
                                it.id,
                                'cantidad',
                                Math.max(1, parseInt(e.target.value) || 1)
                              )
                            }
                            className="w-full text-xs font-semibold px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-cotripar-500 outline-none text-center"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                            Precio Unit. (USD)
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={it.precioUnitarioUSD}
                            onChange={(e) =>
                              handleOfferItemChange(
                                it.id,
                                'precioUnitarioUSD',
                                Math.max(0, parseFloat(e.target.value) || 0)
                              )
                            }
                            className="w-full text-xs font-semibold px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-cotripar-500 outline-none text-right"
                          />
                        </div>

                        <div className="sm:col-span-2 sm:text-right pt-2 sm:pt-4">
                          <span className="text-[10px] font-bold text-slate-400 block">Subtotal:</span>
                          <span className="text-xs font-extrabold text-slate-800">
                            {formatUSD((Number(it.cantidad) || 1) * (Number(it.precioUnitarioUSD) || 0))}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Entrada / Anticipo del Cliente (USD)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={offerFormData.anticipoUSD}
                      onChange={(e) =>
                        setOfferFormData({
                          ...offerFormData,
                          anticipoUSD: Math.max(0, parseFloat(e.target.value) || 0)
                        })
                      }
                      className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-cotripar-500 focus:bg-white outline-none"
                    />
                  </div>

                  <div className="sm:col-span-2 flex items-center">
                    <div className="w-full bg-cotripar-50 border border-cotripar-200 rounded-xl p-3 flex items-center justify-between">
                      <span className="text-xs font-bold text-cotripar-900">
                        VALOR TOTAL A FINANCIAR (BANCO):
                      </span>
                      <span className="text-sm font-extrabold text-cotripar-700">
                        {formatUSD(Math.max(0, (Number(offerFormData.precioTotalUSD) || 0) - (Number(offerFormData.anticipoUSD) || 0)))}
                      </span>
                    </div>
                  </div>

                  <div className="sm:col-span-4">
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Especificación Técnica / Equipamiento y Estado
                    </label>
                    <textarea
                      rows={2}
                      value={offerFormData.especificacionTecnica}
                      onChange={(e) => setOfferFormData({ ...offerFormData, especificacionTecnica: e.target.value })}
                      placeholder="Ej: Unidad nueva de fábrica, rodado de alta flotación, cabina climatizada con computadora de a bordo..."
                      className="w-full text-xs font-medium px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-cotripar-500 focus:bg-white outline-none resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Banner de Crédito Asociado (ReadOnly) */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <span className="font-bold text-slate-800">Condiciones de Crédito Referenciales Vinculadas:</span>
                    <p className="text-slate-500 text-[11px]">
                      {isCotriparSim(offerModalSim) ? (
                        <>
                          Plazo:{' '}
                          <strong>
                            {offerModalSim.plazo_meses || 17} meses (
                            {offerModalSim.fechas_cuotas?.length || offerModalSim.cantidad_cuotas || 2}{' '}
                            {(offerModalSim.fechas_cuotas?.length || offerModalSim.cantidad_cuotas || 2) === 1
                              ? 'cuota'
                              : 'cuotas'}
                            )
                          </strong>{' '}
                          ({offerModalSim.periodicidad} {offerModalSim.modalidad_semestral || ''}) • Tasa:{' '}
                          <strong>
                            {(offerModalSim.tasa_anual > 2
                              ? offerModalSim.tasa_anual / 12
                              : offerModalSim.tasa_anual
                            ).toFixed(2)}
                            % mes ({formatPercent(offerModalSim.tasa_anual)} anual)
                          </strong>{' '}
                          • Cuota Referencial:{' '}
                          <strong>{formatUSD(offerModalSim.mayor_cuota_anio1_usd)}</strong>
                        </>
                      ) : (
                        <>
                          Plazo:{' '}
                          <strong>
                            {Math.abs(Number(offerModalSim.plazo_anios) - 1.5) < 0.05
                              ? '18 meses'
                              : `${offerModalSim.plazo_anios} ${
                                  Number(offerModalSim.plazo_anios) === 1 ? 'año' : 'años'
                                }`}
                          </strong>{' '}
                          ({offerModalSim.periodicidad} {offerModalSim.modalidad_semestral || ''}) • Tasa:{' '}
                          <strong>{formatPercent(offerModalSim.tasa_anual)}</strong> • Mayor Cuota Año 1:{' '}
                          <strong>{formatUSD(offerModalSim.mayor_cuota_anio1_usd)}</strong>
                        </>
                      )}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Crédito</span>
                  <span className="font-extrabold text-cotripar-700 text-sm">{formatUSD(offerModalSim.total_pagado_usd)}</span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setOfferModalSim(null)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleGenerateOfferPDF}
                disabled={isGeneratingOffer}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-cotripar-700 hover:bg-cotripar-800 text-white font-bold text-xs shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isGeneratingOffer ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Generando Carta Oficial...</span>
                  </>
                ) : (
                  <>
                    <FileSignature className="w-4 h-4" />
                    <span>📄 Generar y Abrir Carta Oferta (PDF)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
