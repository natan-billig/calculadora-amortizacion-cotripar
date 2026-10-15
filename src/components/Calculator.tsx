import React, { useState, useEffect, useMemo } from 'react';
import type {
  BancoTasa,
  FrecuenciaPago,
  ModalidadSemestral,
  ResultadoAleman,
  SimulacionPDF,
  ItemMaquinaria,
  MarcaProducto,
  TipoFinanciacion,
  PeriodicidadCotripar,
  EsquemaSemestralCotripar
} from '../types';
import { BANCOS_OFICIALES_COTRIPAR } from '../types';
import {
  calcularSistemaAleman,
  calcularFCotripar,
  getMatrizBloqueInfo,
  getTasaMensualCotripar,
  MESES_MATRIZ_COTRIPAR,
  formatUSD,
  formatPercent,
  generarFechasAtajo,
  fechaISOToDDMMYYYY,
  fechaDDMMYYYYToISO,
  parseMesColocacion,
  calcularMesesDesdeColocacion
} from '../utils/calculatorEngine';
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
  FileText,
  FileCheck2,
  ExternalLink,
  CheckCircle2,
  Loader2,
  Tractor,
  Plus,
  Trash2,
  Tag,
  CalendarClock,
  AlertCircle,
  Lock
} from 'lucide-react';

interface CalculatorProps {
  onOpenBankManager: () => void;
  onOpenBrandManager?: () => void;
  showToast: (msg: string) => void;
  initialSimulation?: SimulacionPDF | null;
}

export const Calculator: React.FC<CalculatorProps> = ({
  onOpenBankManager,
  onOpenBrandManager,
  showToast,
  initialSimulation
}) => {
  const { currentUser, isAdmin, isCoordinatorOrAdmin } = useAuth();

  // Mode Selection: Financiación Bancaria vs Financiación Cotripar
  const [tipoFinanciacion, setTipoFinanciacion] = useState<TipoFinanciacion>('BANCARIA');

  // Marcas de Productos from Supabase
  const [marcas, setMarcas] = useState<MarcaProducto[]>([]);
  const [isLoadingMarcas, setIsLoadingMarcas] = useState<boolean>(true);

  // Inputs
  const [clienteNombre, setClienteNombre] = useState<string>('');
  const [clienteRuc, setClienteRuc] = useState<string>('');
  const [items, setItems] = useState<ItemMaquinaria[]>([
    {
      id: '1',
      marca: 'Valtra',
      descripcion: '',
      cantidad: 1,
      precioUnitarioUSD: 110000
    }
  ]);
  const [anticipoUSD, setAnticipoUSD] = useState<number>(0);
  const [validationTriggered, setValidationTriggered] = useState<boolean>(false);
  const [capital, setCapital] = useState<number>(110000);

  // Traditional Banking Mode Inputs
  const [tasaAnual, setTasaAnual] = useState<number>(7.40);
  const [plazoAnios, setPlazoAnios] = useState<number>(5);
  const [frecuencia, setFrecuencia] = useState<FrecuenciaPago>('anual');
  const [modalidadSemestral, setModalidadSemestral] = useState<ModalidadSemestral>('zafra_interes_primero');

  // Financiación Cotripar Mode Inputs (Matriz 2026-2028 & V.2.3 Fechas Cuotas)
  const [mesColocacion, setMesColocacion] = useState<string>('Octubre 2026');
  const [fechasCuotas, setFechasCuotas] = useState<string[]>(() => {
    return generarFechasAtajo('semestral', 'Octubre 2026');
  });
  const [periodicidadCotripar, setPeriodicidadCotripar] = useState<PeriodicidadCotripar>('semestral_zafra');
  const [esquemaSemestralCotripar, setEsquemaSemestralCotripar] = useState<EsquemaSemestralCotripar>('amortizacion_constante');


  // Banks from Supabase
  const [bancos, setBancos] = useState<BancoTasa[]>([]);
  const [selectedBancoId, setSelectedBancoId] = useState<string>('');
  const [isLoadingBancos, setIsLoadingBancos] = useState<boolean>(true);

  // Generation & Success Modal state
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [successModalData, setSuccessModalData] = useState<{
    resultado: ResultadoAleman;
    cliente: string;
    ruc: string;
    maquina: string;
    banco: string;
    docInstance: any;
    pdfBlobUrl: string;
  } | null>(null);

  // Función auxiliar segura para obtener la tasa de un banco para cualquier plazo seleccionado
  const getTasaPorPlazo = (banco: BancoTasa | undefined, plazo: number): number | null => {
    if (!banco) return null;
    if (!banco.tasas_por_plazo) {
      return banco.tasa_anual != null ? Number(banco.tasa_anual) : null;
    }

    const val = banco.tasas_por_plazo[String(plazo)];
    if (val != null && !isNaN(Number(val))) {
      return Number(val);
    }

    // Fallback inmediato para 1 o 1.5 años (18m)
    if (plazo === 1 || plazo === 1.5) {
      const fallback =
        banco.tasas_por_plazo['1.5'] ??
        banco.tasas_por_plazo['2'] ??
        banco.tasas_por_plazo['3'] ??
        banco.tasa_anual;
      return fallback != null && !isNaN(Number(fallback)) ? Number(fallback) : null;
    }

    // Fallback para 6 años (ej: Continental o Itaú) a 5 años o tasa anual
    if (plazo === 6) {
      const fallback6 = banco.tasas_por_plazo['5'] ?? banco.tasa_anual;
      return fallback6 != null && !isNaN(Number(fallback6)) ? Number(fallback6) : null;
    }

    if (banco.tasa_anual != null && !isNaN(Number(banco.tasa_anual))) {
      return Number(banco.tasa_anual);
    }

    return null;
  };

  // Fetch Marcas from Supabase
  const fetchMarcas = async () => {
    setIsLoadingMarcas(true);
    try {
      const { data, error } = await supabase
        .from('marcas_productos')
        .select('*')
        .eq('activo', true)
        .order('nombre', { ascending: true });

      if (!error && data && data.length > 0) {
        setMarcas(data);
        setItems((prev) =>
          prev.map((it) => (it.marca ? it : { ...it, marca: data[0].nombre }))
        );
      } else {
        const defaults: MarcaProducto[] = [
          'Valtra',
          'Fendt',
          'Cotripar Implementos',
          'Tatu Marchesan',
          'Baldan',
          'Stara',
          'Jacto',
          'Second Hand (Usados)',
          'Posventa / Repuestos',
          'Otras Marcas'
        ].map((nombre, i) => ({ id: String(i + 1), nombre, activo: true }));
        setMarcas(defaults);
        setItems((prev) =>
          prev.map((it) => (it.marca ? it : { ...it, marca: defaults[0].nombre }))
        );
      }
    } catch {
      // offline fallback
    } finally {
      setIsLoadingMarcas(false);
    }
  };

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
          const initialRate = getTasaPorPlazo(data[0], plazoAnios) ?? Number(data[0].tasa_anual);
          setTasaAnual(Number(initialRate));
        }
      } else {
        const defaults: BancoTasa[] = BANCOS_OFICIALES_COTRIPAR.map((b, idx) => ({
          id: String(idx + 1),
          entidad: b.entidad,
          tasa_anual: b.tasa_anual,
          activo: true,
          tiene_convenio: b.tiene_convenio,
          modalidad_permitida: b.modalidad_permitida,
          tasas_por_plazo: b.tasas_por_plazo
        }));
        setBancos(defaults);
        if (!selectedBancoId) {
          setSelectedBancoId(defaults[0].id);
          const initialRate = getTasaPorPlazo(defaults[0], plazoAnios) ?? defaults[0].tasa_anual;
          setTasaAnual(Number(initialRate));
        }
      }
    } catch {
      // offline fallback
    } finally {
      setIsLoadingBancos(false);
    }
  };

  useEffect(() => {
    fetchMarcas();
    fetchBancos();
  }, []);

  // Financiación Cotripar Block info, date limits and dynamic rate
  const infoBloqueActivo = useMemo(() => {
    return getMatrizBloqueInfo(mesColocacion);
  }, [mesColocacion]);

  const fechaTopeISO = useMemo(() => {
    return fechaDDMMYYYYToISO(infoBloqueActivo.fechaTopeVencimiento);
  }, [infoBloqueActivo.fechaTopeVencimiento]);

  const { anio: anioColocacion, mesNum: mesColocacionNum } = useMemo(() => {
    return parseMesColocacion(mesColocacion);
  }, [mesColocacion]);

  const fechaMinColocacionISO = useMemo(() => {
    return `${anioColocacion}-${String(mesColocacionNum).padStart(2, '0')}-01`;
  }, [anioColocacion, mesColocacionNum]);

  const ultimaFechaCuotaISO = useMemo(() => {
    return fechasCuotas.length > 0 ? fechasCuotas[fechasCuotas.length - 1] : '';
  }, [fechasCuotas]);

  // Plazo detectado 100% automático basado en la última cuota
  const plazoDetectadoMeses = useMemo(() => {
    if (!ultimaFechaCuotaISO) return 1;
    return calcularMesesDesdeColocacion(ultimaFechaCuotaISO, anioColocacion, mesColocacionNum);
  }, [ultimaFechaCuotaISO, anioColocacion, mesColocacionNum]);

  // Ajuste automático de la tasa (0.60% vs 0.80%)
  const tasaMensualCalculada = useMemo(() => {
    return getTasaMensualCotripar(plazoDetectadoMeses);
  }, [plazoDetectadoMeses]);

  const handleMesColocacionChange = (newMes: string) => {
    setMesColocacion(newMes);
    // Regenerar atajo inteligente de fechas para el nuevo mes seleccionado
    const nuevasFechas = generarFechasAtajo('semestral', newMes);
    setFechasCuotas(nuevasFechas);
  };

  const handleUpdateFechaCuota = (index: number, newDate: string) => {
    setFechasCuotas((prev) => {
      const next = [...prev];
      next[index] = newDate;
      return next;
    });
  };

  const handleAddCuota = () => {
    setFechasCuotas((prev) => {
      if (prev.length === 0) {
        return [fechaTopeISO];
      }
      const last = prev[prev.length - 1];
      if (last >= fechaTopeISO) {
        showToast(`La última cuota ya está fijada en la Fecha Tope (${infoBloqueActivo.fechaTopeVencimiento}).`);
        return prev;
      }
      const parts = last.split('-').map(Number);
      let y = parts[0];
      let m = parts[1] + 1;
      if (m > 12) {
        y += Math.floor((m - 1) / 12);
        m = ((m - 1) % 12) + 1;
      }
      let nextDate = `${y}-${String(m).padStart(2, '0')}-20`;
      if (nextDate > fechaTopeISO) {
        nextDate = fechaTopeISO;
      }
      return [...prev, nextDate];
    });
  };

  const handleRemoveCuota = (index: number) => {
    if (fechasCuotas.length <= 1) {
      showToast('Debe haber al menos 1 cuota en el cronograma.');
      return;
    }
    setFechasCuotas((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleApplyAtajo = (tipo: 'tope' | 'semestral' | 'zafra' | 'mensual') => {
    const atajoFechas = generarFechasAtajo(tipo, mesColocacion);
    setFechasCuotas(atajoFechas);
    if (tipo === 'tope') {
      setPeriodicidadCotripar('pago_unico');
    } else if (tipo === 'mensual') {
      setPeriodicidadCotripar('mensual');
    } else {
      setPeriodicidadCotripar('semestral_zafra');
    }
  };

  // Validación de cronograma y límites
  const errorFechasCuotas = useMemo((): string | null => {
    if (tipoFinanciacion !== 'F_COTRIPAR') return null;
    if (!fechasCuotas || fechasCuotas.length === 0) {
      return 'Debe ingresar al menos una cuota de pago.';
    }
    for (let i = 0; i < fechasCuotas.length; i++) {
      if (!fechasCuotas[i]) {
        return `La Cuota #${i + 1} no tiene una fecha seleccionada.`;
      }
      if (fechasCuotas[i] < fechaMinColocacionISO) {
        return `La Cuota #${i + 1} (${fechaISOToDDMMYYYY(fechasCuotas[i])}) no puede ser anterior al mes de colocación (${mesColocacion}).`;
      }
      if (i > 0 && fechasCuotas[i] <= fechasCuotas[i - 1]) {
        return `Error en cronograma: La Cuota #${i + 1} (${fechaISOToDDMMYYYY(fechasCuotas[i])}) debe ser posterior a la Cuota #${i} (${fechaISOToDDMMYYYY(fechasCuotas[i - 1])}). Las fechas deben estar en orden cronológico creciente.`;
      }
    }
    const last = fechasCuotas[fechasCuotas.length - 1];
    if (last > fechaTopeISO) {
      return `La última cuota (${fechaISOToDDMMYYYY(last)}) supera la Fecha Tope de Vencimiento permitida (${infoBloqueActivo.fechaTopeVencimiento}) del ${infoBloqueActivo.bloque}.`;
    }
    if (plazoDetectadoMeses > 18) {
      return `El plazo detectado (${plazoDetectadoMeses} meses) supera el límite máximo de 18 meses.`;
    }
    if (plazoDetectadoMeses > infoBloqueActivo.plazoMaximo) {
      return `El plazo detectado (${plazoDetectadoMeses} meses) supera el plazo máximo permitido (${infoBloqueActivo.plazoMaximo} meses) para colocaciones en ${mesColocacion}.`;
    }
    return null;
  }, [tipoFinanciacion, fechasCuotas, fechaTopeISO, fechaMinColocacionISO, infoBloqueActivo, plazoDetectadoMeses, mesColocacion]);

  // Handle re-loading simulation from history
  useEffect(() => {
    if (initialSimulation) {
      if (initialSimulation.tipo_financiacion === 'F_COTRIPAR') {
        setTipoFinanciacion('F_COTRIPAR');
        if (initialSimulation.mes_colocacion) {
          setMesColocacion(initialSimulation.mes_colocacion);
        }
        if (initialSimulation.fechas_cuotas && Array.isArray(initialSimulation.fechas_cuotas) && initialSimulation.fechas_cuotas.length > 0) {
          setFechasCuotas(initialSimulation.fechas_cuotas);
        } else if (initialSimulation.cronograma_json && Array.isArray(initialSimulation.cronograma_json)) {
          const extracted: string[] = [];
          initialSimulation.cronograma_json.forEach((c) => {
            const m = c.label.match(/\((\d{2}\/\d{2}\/\d{4})\)/);
            if (m && m[1]) {
              extracted.push(fechaDDMMYYYYToISO(m[1]));
            }
          });
          if (extracted.length > 0) {
            setFechasCuotas(extracted);
          } else {
            setFechasCuotas(generarFechasAtajo('semestral', initialSimulation.mes_colocacion || 'Octubre 2026'));
          }
        } else {
          setFechasCuotas(generarFechasAtajo('semestral', initialSimulation.mes_colocacion || 'Octubre 2026'));
        }
        if (initialSimulation.periodicidad) {
          setPeriodicidadCotripar(initialSimulation.periodicidad as PeriodicidadCotripar);
        }
        if (initialSimulation.modalidad_semestral) {
          setEsquemaSemestralCotripar(initialSimulation.modalidad_semestral as EsquemaSemestralCotripar);
        }
      } else {
        setTipoFinanciacion('BANCARIA');
        setTasaAnual(initialSimulation.tasa_anual);
        setPlazoAnios(initialSimulation.plazo_anios);
        setFrecuencia(initialSimulation.periodicidad === 'semestral' ? 'semestral' : 'anual');
        if (initialSimulation.modalidad_semestral) {
          setModalidadSemestral(initialSimulation.modalidad_semestral as ModalidadSemestral);
        }
        const bFound = bancos.find(b => b.entidad.toLowerCase() === initialSimulation.banco_entidad.toLowerCase());
        if (bFound) setSelectedBancoId(bFound.id);
      }

      setCapital(initialSimulation.capital_usd);
      setClienteNombre(initialSimulation.cliente_nombre || '');
      setClienteRuc(initialSimulation.cliente_ruc || '');
      if (initialSimulation.items_json && Array.isArray(initialSimulation.items_json) && initialSimulation.items_json.length > 0) {
        setItems(initialSimulation.items_json);
      } else {
        setItems([
          {
            id: '1',
            marca: initialSimulation.marca_producto || 'Valtra',
            descripcion: initialSimulation.maquina_implemento || '',
            cantidad: 1,
            precioUnitarioUSD: Number(initialSimulation.capital_usd) + (Number(initialSimulation.anticipo_usd) || 0)
          }
        ]);
      }
      setAnticipoUSD(Number(initialSimulation.anticipo_usd) || 0);
      showToast(`Simulación de "${initialSimulation.cliente_nombre}" cargada.`);
    }
  }, [initialSimulation]);

  const handleBankChange = (bancoId: string) => {
    setSelectedBancoId(bancoId);
    const banco = bancos.find(b => b.id === bancoId);
    if (!banco) return;

    const rate = getTasaPorPlazo(banco, plazoAnios);
    if (rate != null && rate > 0) {
      setTasaAnual(Number(rate));
    } else if (banco.tasa_anual != null) {
      setTasaAnual(Number(banco.tasa_anual));
    }
  };

  const handlePlazoChange = (newPlazo: number) => {
    setPlazoAnios(newPlazo);
    if (newPlazo === 1.5) {
      setFrecuencia('semestral');
    }
    const banco = bancos.find(b => b.id === selectedBancoId);
    if (banco) {
      const rate = getTasaPorPlazo(banco, newPlazo);
      if (rate != null && rate > 0) {
        setTasaAnual(Number(rate));
      } else if (banco.tasa_anual != null) {
        setTasaAnual(Number(banco.tasa_anual));
      }
    }
  };

  // Sincronización automática de tasa bancaria según entidad y plazo seleccionados
  useEffect(() => {
    if (tipoFinanciacion === 'BANCARIA' && selectedBancoId && bancos.length > 0) {
      const banco = bancos.find(b => b.id === selectedBancoId);
      if (banco) {
        const rate = getTasaPorPlazo(banco, plazoAnios);
        if (rate != null && rate > 0) {
          setTasaAnual(Number(rate));
        } else if (banco.tasa_anual != null) {
          setTasaAnual(Number(banco.tasa_anual));
        }
      }
    }
  }, [selectedBancoId, plazoAnios, bancos, tipoFinanciacion]);

  const selectedBancoNombre = useMemo(() => {
    const b = bancos.find(item => item.id === selectedBancoId);
    return b ? b.entidad : 'Banco Comercial';
  }, [bancos, selectedBancoId]);

  // Automatic capital calculation from items and anticipo
  const subtotalEquipos = useMemo(() => {
    return items.reduce((sum, it) => sum + (Number(it.cantidad) || 0) * (Number(it.precioUnitarioUSD) || 0), 0);
  }, [items]);

  useEffect(() => {
    const totalCalculado = Math.max(0, subtotalEquipos - (Number(anticipoUSD) || 0));
    setCapital(totalCalculado);
  }, [subtotalEquipos, anticipoUSD]);

  const handleApplyPreset = (val: number) => {
    if (items.length === 1) {
      handleItemChange(items[0].id, 'precioUnitarioUSD', val + (Number(anticipoUSD) || 0));
    } else {
      setCapital(val);
    }
  };

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        marca: marcas[0]?.nombre || 'Valtra',
        descripcion: '',
        cantidad: 1,
        precioUnitarioUSD: 0
      }
    ]);
  };

  const handleRemoveItem = (id: string) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const handleItemChange = (id: string, field: keyof ItemMaquinaria, val: any) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id === id) {
          return { ...it, [field]: val };
        }
        return it;
      })
    );
  };

  // Real-time calculation
  const resultado: ResultadoAleman = useMemo(() => {
    if (tipoFinanciacion === 'F_COTRIPAR') {
      return calcularFCotripar(
        capital,
        mesColocacion,
        plazoDetectadoMeses,
        periodicidadCotripar,
        esquemaSemestralCotripar,
        undefined,
        items,
        anticipoUSD,
        fechasCuotas
      );
    }
    return calcularSistemaAleman(
      capital,
      tasaAnual,
      plazoAnios,
      frecuencia,
      modalidadSemestral,
      selectedBancoNombre
    );
  }, [
    tipoFinanciacion,
    capital,
    tasaAnual,
    plazoAnios,
    frecuencia,
    modalidadSemestral,
    selectedBancoNombre,
    mesColocacion,
    plazoDetectadoMeses,
    periodicidadCotripar,
    esquemaSemestralCotripar,
    items,
    anticipoUSD,
    fechasCuotas
  ]);

  const capitalPresets = [25000, 50000, 75000, 110000, 150000, 200000];

  const handleReset = () => {
    setClienteNombre('');
    setClienteRuc('');
    setItems([
      {
        id: '1',
        marca: marcas[0]?.nombre || 'Valtra',
        descripcion: '',
        cantidad: 1,
        precioUnitarioUSD: 110000
      }
    ]);
    setAnticipoUSD(0);
    setValidationTriggered(false);
    setCapital(110000);
    setPlazoAnios(5);
    setFrecuencia('anual');
    setModalidadSemestral('zafra_interes_primero');
    setTipoFinanciacion('BANCARIA');
    setMesColocacion('Octubre 2026');
    setFechasCuotas(generarFechasAtajo('semestral', 'Octubre 2026'));
    setPeriodicidadCotripar('semestral_zafra');
    setEsquemaSemestralCotripar('amortizacion_constante');
    if (bancos.length > 0) {
      setSelectedBancoId(bancos[0].id);
      const defaultRate = getTasaPorPlazo(bancos[0], 5) ?? Number(bancos[0].tasa_anual);
      setTasaAnual(Number(defaultRate));
    }
    showToast('Parámetros restablecidos.');
  };

  // Single Action Flow: Calculate, Generate PDF, and Save to Supabase
  const handleCalcularYGenerarPDF = async () => {
    const hasValidItems =
      items.length > 0 &&
      items.every(
        (it) =>
          it.descripcion.trim() !== '' &&
          Number(it.precioUnitarioUSD) > 0 &&
          it.marca &&
          it.marca.trim() !== ''
      );

    if (!clienteNombre.trim() || !clienteRuc.trim() || !hasValidItems) {
      setValidationTriggered(true);
      if (!clienteNombre.trim() || !clienteRuc.trim()) {
        showToast('Es obligatorio ingresar el Nombre del Cliente y RUC / C.I.');
      } else {
        showToast('Debe ingresar Marca, Descripción y Precio Unitario válido para cada equipo cotizado.');
      }
      return;
    }

    if (capital < 1000) {
      showToast('El Capital Solicitado a financiar debe ser de al menos 1.000 USD (verifique precios y entrega inicial).');
      return;
    }

    if (tipoFinanciacion === 'F_COTRIPAR' && errorFechasCuotas) {
      setValidationTriggered(true);
      showToast(errorFechasCuotas);
      return;
    }

    setIsProcessing(true);
    const clienteFinal = clienteNombre.trim();
    const rucFinal = clienteRuc.trim();

    const marcasList = Array.from(new Set(items.map((it) => it.marca?.trim()).filter(Boolean)));
    const marcaProductoPrincipal = marcasList.join(', ') || (marcas[0]?.nombre || 'Cotripar');

    const maquinaFinal =
      items
        .filter((it) => it.descripcion.trim())
        .map(
          (it) =>
            `${it.marca ? `[${it.marca}] ` : ''}${it.cantidad > 1 ? `${it.cantidad}x ` : ''}${it.descripcion.trim()}`
        )
        .join(' + ') || 'Equipamiento Agrícola Cotripar';

    const simulacionPayload: SimulacionPDF = {
      usuario_id: currentUser?.id || null,
      vendedor_nombre: currentUser?.nombre || 'Asesor Cotripar',
      cliente_nombre: clienteFinal,
      cliente_ruc: rucFinal,
      maquina_implemento: maquinaFinal,
      capital_usd: resultado.capital,
      gasto_admin_usd: resultado.gastoAdmin,
      banco_entidad: tipoFinanciacion === 'F_COTRIPAR' ? 'Financiación Cotripar' : selectedBancoNombre,
      tasa_anual: resultado.tasaAnual,
      plazo_anios: resultado.plazoAnios,
      periodicidad: tipoFinanciacion === 'F_COTRIPAR' ? periodicidadCotripar : resultado.frecuencia,
      modalidad_semestral: tipoFinanciacion === 'F_COTRIPAR' ? esquemaSemestralCotripar : (resultado.modalidadSemestral || null),
      total_intereses_usd: resultado.totalIntereses,
      total_iva_usd: resultado.totalIva,
      costo_financiero_total_usd: resultado.costoFinancieroTotal,
      total_pagado_usd: resultado.totalPagado,
      mayor_cuota_anio1_usd: resultado.cuotaMayorAnio1,
      cronograma_json: resultado.cronograma,
      items_json: items,
      anticipo_usd: anticipoUSD,
      tipo_financiacion: tipoFinanciacion,
      marca_producto: marcaProductoPrincipal,
      mes_colocacion: tipoFinanciacion === 'F_COTRIPAR' ? infoBloqueActivo.mesNombre : '',
      fecha_tope_vencimiento: tipoFinanciacion === 'F_COTRIPAR' ? infoBloqueActivo.fechaTopeVencimiento : '',
      plazo_meses: tipoFinanciacion === 'F_COTRIPAR' ? plazoDetectadoMeses : Math.round(plazoAnios * 12),
      fechas_cuotas: tipoFinanciacion === 'F_COTRIPAR' ? fechasCuotas : undefined,
      fecha_ultima_cuota: tipoFinanciacion === 'F_COTRIPAR' ? fechaISOToDDMMYYYY(ultimaFechaCuotaISO) : undefined,
      cantidad_cuotas: tipoFinanciacion === 'F_COTRIPAR' ? fechasCuotas.length : (resultado.frecuencia === 'semestral' ? Math.round(resultado.plazoAnios * 2) : resultado.plazoAnios)
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
      const safeName = clienteFinal.replace(/\s+/g, '_');
      const safeRuc = rucFinal.replace(/\s+/g, '');
      const prefix = tipoFinanciacion === 'F_COTRIPAR' ? 'Cotripar_Financiacion_Cotripar' : 'Cotripar_Simulacion';
      const filename = `${prefix}_${safeName}_${safeRuc}.pdf`;
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
        ruc: rucFinal,
        maquina: maquinaFinal,
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
        {/* Mode Selector: Financiación Bancaria vs Financiación Cotripar */}
        <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-100 rounded-2xl border border-slate-200">
          <button
            type="button"
            onClick={() => setTipoFinanciacion('BANCARIA')}
            className={`py-3 px-3 rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 transition-all ${
              tipoFinanciacion === 'BANCARIA'
                ? 'bg-white text-slate-900 shadow-md border border-slate-200/80 scale-[1.01]'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'
            }`}
          >
            <Building2 className={`w-4 h-4 ${tipoFinanciacion === 'BANCARIA' ? 'text-cotripar-700' : 'text-slate-400'}`} />
            <span>Financiación Bancaria</span>
          </button>

          <button
            type="button"
            onClick={() => setTipoFinanciacion('F_COTRIPAR')}
            className={`py-3 px-3 rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 transition-all ${
              tipoFinanciacion === 'F_COTRIPAR'
                ? 'bg-cotripar-700 text-white shadow-md shadow-cotripar-700/20 scale-[1.01]'
                : 'text-slate-500 hover:text-cotripar-700 hover:bg-slate-200/50'
            }`}
          >
            <Sparkles className={`w-4 h-4 ${tipoFinanciacion === 'F_COTRIPAR' ? 'text-white' : 'text-cotripar-700'}`} />
            <span>Financiación Cotripar</span>
          </button>
        </div>

        {/* Card Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-cotripar-50 text-cotripar-700 flex items-center justify-center font-bold">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight">
                {tipoFinanciacion === 'F_COTRIPAR' ? 'Financiación Cotripar' : 'Parámetros del Crédito'}
              </h2>
              <p className="text-[11px] text-slate-400 font-medium">
                {tipoFinanciacion === 'F_COTRIPAR'
                  ? 'Matriz Oficial de Bloques y Plazos (Ciclo 2026 - 2028)'
                  : 'Sistema Alemán de Amortización • Cotripar S.A.'}
              </p>
            </div>
          </div>
          <span className="text-[11px] font-bold text-cotripar-700 bg-cotripar-50 px-2.5 py-1 rounded-full border border-cotripar-100">
            USD ($)
          </span>
        </div>

        {/* Form Fields */}
        <div className="space-y-4">
          {/* 1. Nombre del Cliente y RUC / C.I. (Obligatorios y lado a lado) */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-7 space-y-1">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span>Nombre del Cliente / Razón Social *</span>
              </label>
              <input
                type="text"
                required
                value={clienteNombre}
                onChange={(e) => setClienteNombre(e.target.value)}
                placeholder="Ej: Agropecuaria El Palmar S.A."
                className={`w-full px-3.5 py-2.5 text-sm font-medium text-slate-900 bg-slate-50 border rounded-xl focus:bg-white focus:ring-2 focus:ring-cotripar-700 focus:outline-none transition-all ${
                  validationTriggered && !clienteNombre.trim()
                    ? 'border-red-500 bg-red-50/40 ring-1 ring-red-400'
                    : 'border-slate-200'
                }`}
              />
            </div>

            <div className="sm:col-span-5 space-y-1">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                <span>RUC / C.I. *</span>
              </label>
              <input
                type="text"
                required
                value={clienteRuc}
                onChange={(e) => setClienteRuc(e.target.value)}
                placeholder="Ej: 80019076-9"
                className={`w-full px-3.5 py-2.5 text-sm font-medium text-slate-900 bg-slate-50 border rounded-xl focus:bg-white focus:ring-2 focus:ring-cotripar-700 focus:outline-none transition-all ${
                  validationTriggered && !clienteRuc.trim()
                    ? 'border-red-500 bg-red-50/40 ring-1 ring-red-400'
                    : 'border-slate-200'
                }`}
              />
            </div>
          </div>

          {/* Campo: Lista Dinámica de Equipos / Ítems Cotizados con Marca Configurable */}
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Tractor className="w-3.5 h-3.5 text-cotripar-700" />
                <span>Equipos o Implementos Cotizados *</span>
              </label>
              <div className="flex items-center gap-2">
                {isCoordinatorOrAdmin && (
                  <button
                    type="button"
                    onClick={onOpenBrandManager}
                    className="text-[11px] font-bold text-cotripar-700 hover:underline flex items-center gap-1 bg-cotripar-50 px-2 py-0.5 rounded-lg border border-cotripar-200 transition-colors"
                    title="Gestionar Marcas de Productos"
                  >
                    <Tag className="w-3 h-3 text-cotripar-700" />
                    <span>🏷️ Gestionar Marcas</span>
                  </button>
                )}
                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                  {items.length} {items.length === 1 ? 'equipo' : 'equipos'}
                </span>
              </div>
            </div>

            {/* List of equipment items */}
            <div className="space-y-2.5">
              {items.map((item, index) => {
                const itemTotal = (Number(item.cantidad) || 0) * (Number(item.precioUnitarioUSD) || 0);
                return (
                  <div
                    key={item.id}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5 relative transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-extrabold text-cotripar-700 uppercase tracking-wider flex items-center gap-1">
                        Ítem #{String(index + 1).padStart(2, '0')}
                      </span>
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-semibold"
                          title="Eliminar este equipo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Eliminar</span>
                        </button>
                      )}
                    </div>

                    {/* Coluna 1: Marca * y Coluna 2: Descripción * */}
                    <div className="grid grid-cols-12 gap-2">
                      <div className="col-span-12 sm:col-span-4 space-y-0.5">
                        <label className="text-[10px] font-bold text-slate-500 block">Marca *</label>
                        <select
                          value={item.marca || ''}
                          onChange={(e) => handleItemChange(item.id, 'marca', e.target.value)}
                          disabled={isLoadingMarcas}
                          className={`w-full px-2.5 py-2 text-xs font-bold text-slate-900 bg-white border rounded-xl focus:ring-2 focus:ring-cotripar-700 focus:outline-none transition-all ${
                            validationTriggered && (!item.marca || !item.marca.trim())
                              ? 'border-red-500 bg-red-50/40 ring-1 ring-red-400'
                              : 'border-slate-200'
                          }`}
                        >
                          <option value="">-- Seleccionar Marca --</option>
                          {marcas.map((m) => (
                            <option key={m.id} value={m.nombre}>
                              {m.nombre}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="col-span-12 sm:col-span-8 space-y-0.5">
                        <label className="text-[10px] font-bold text-slate-500 block">
                          Descripción del Equipo / Implemento *
                        </label>
                        <input
                          type="text"
                          required
                          value={item.descripcion}
                          onChange={(e) => handleItemChange(item.id, 'descripcion', e.target.value)}
                          placeholder="Ej: Tractor BH224 / Sembradora / Cosechadora"
                          className={`w-full px-3 py-2 text-xs font-medium text-slate-900 bg-white border rounded-xl focus:ring-2 focus:ring-cotripar-700 focus:outline-none transition-all ${
                            validationTriggered && !item.descripcion.trim()
                              ? 'border-red-500 bg-red-50/40 ring-1 ring-red-400'
                              : 'border-slate-200'
                          }`}
                        />
                      </div>
                    </div>

                    {/* Cantidad y Precio Unitario */}
                    <div className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-4 sm:col-span-3 space-y-0.5">
                        <label className="text-[10px] font-bold text-slate-500 block">Cant.</label>
                        <input
                          type="number"
                          min="1"
                          value={item.cantidad || ''}
                          onChange={(e) =>
                            handleItemChange(
                              item.id,
                              'cantidad',
                              Math.max(1, parseInt(e.target.value) || 1)
                            )
                          }
                          className="w-full px-2.5 py-1.5 text-xs font-bold text-slate-900 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-cotripar-700 outline-none text-center"
                        />
                      </div>

                      <div className="col-span-8 sm:col-span-5 space-y-0.5">
                        <label className="text-[10px] font-bold text-slate-500 block">
                          Precio Unit. (USD) *
                        </label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                            $
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="500"
                            value={item.precioUnitarioUSD || ''}
                            onChange={(e) =>
                              handleItemChange(
                                item.id,
                                'precioUnitarioUSD',
                                Math.max(0, parseFloat(e.target.value) || 0)
                              )
                            }
                            placeholder="110,000"
                            className={`w-full pl-6 pr-2.5 py-1.5 text-xs font-bold text-slate-900 bg-white border rounded-xl focus:ring-2 focus:ring-cotripar-700 outline-none ${
                              validationTriggered && (!item.precioUnitarioUSD || item.precioUnitarioUSD <= 0)
                                ? 'border-red-500 bg-red-50/40 ring-1 ring-red-400'
                                : 'border-slate-200'
                            }`}
                          />
                        </div>
                      </div>

                      <div className="col-span-12 sm:col-span-4 sm:text-right pt-1 sm:pt-4">
                        <span className="text-[10px] text-slate-400 font-bold sm:block">Subtotal Ítem:</span>
                        <span className="text-xs font-extrabold text-slate-800">
                          {formatUSD(itemTotal)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Botón Agregar otro equipo / ítem */}
            <button
              type="button"
              onClick={handleAddItem}
              className="w-full py-2 px-3 border border-dashed border-cotripar-300 bg-cotripar-50/60 hover:bg-cotripar-100 text-cotripar-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>+ Agregar otro equipo / ítem</span>
            </button>

            {/* Opcional: Entrega Inicial / Anticipo (USD) y Resumen de Equipos */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Subtotal Maquinarias
                  </span>
                  <span className="text-xs font-extrabold text-slate-800">
                    {formatUSD(subtotalEquipos)}
                  </span>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-600 block">
                    Entrega Inicial / Anticipo (USD)
                  </label>
                  {anticipoUSD > 0 && (
                    <span className="text-[10px] font-bold text-cotripar-700">
                      -{formatUSD(anticipoUSD)}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    $
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    value={anticipoUSD || ''}
                    onChange={(e) => setAnticipoUSD(Math.max(0, parseFloat(e.target.value) || 0))}
                    placeholder="0"
                    className="w-full pl-6 pr-2.5 py-1 text-xs font-bold text-slate-900 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-cotripar-700 outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 2. Capital Solicitado (USD) — Calculado automáticamente */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                <span>Capital a Financiar (USD)</span>
              </label>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  Suma Automática
                </span>
                <span className="text-cotripar-700 font-black text-sm">
                  {formatUSD(capital)}
                </span>
              </div>
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
                  onClick={() => handleApplyPreset(val)}
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

          {tipoFinanciacion === 'F_COTRIPAR' ? (
            <>
              {/* A. Mes de Colocación y Badge de Matriz Operativa de Plazos y Bloques */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-cotripar-700" />
                    <span>Mes de Colocación (Matriz 2026 - 2028) *</span>
                  </label>
                  <span className="text-[11px] font-bold text-cotripar-700 bg-cotripar-50 px-2 py-0.5 rounded-full border border-cotripar-200">
                    {infoBloqueActivo.bloque}
                  </span>
                </div>

                <select
                  value={mesColocacion}
                  onChange={(e) => handleMesColocacionChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm font-semibold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-cotripar-700 focus:outline-none transition-all"
                >
                  {MESES_MATRIZ_COTRIPAR.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>

                {/* Badge Informativo de Destaque */}
                <div className="p-3 bg-red-50/70 border border-red-200 rounded-2xl space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-cotripar-900 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-cotripar-600 animate-pulse" />
                      <span>Bloque Activo: <strong>{infoBloqueActivo.bloque}</strong></span>
                    </span>
                    <span className="bg-cotripar-700 text-white px-2.5 py-0.5 rounded-full text-[10px] font-black">
                      Plazo Máx: {infoBloqueActivo.plazoMaximo} Meses
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-red-100/80">
                    <span className="text-slate-600 text-[11px] font-medium">Fecha Tope de Vencimiento:</span>
                    <span className="font-extrabold text-cotripar-800 font-mono text-xs bg-white px-2.5 py-0.5 rounded-lg border border-red-200 shadow-xs">
                      📅 {infoBloqueActivo.fechaTopeVencimiento}
                    </span>
                  </div>
                </div>
              </div>

              {/* B. Plazo Otorgado y Fechas de Pago de las Cuotas */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <CalendarClock className="w-3.5 h-3.5 text-cotripar-700" />
                    <span>Plazo Otorgado y Fechas de Pago de las Cuotas *</span>
                  </label>
                  <span className="text-[11px] font-black text-cotripar-700 bg-cotripar-50 px-2.5 py-0.5 rounded-full border border-cotripar-200">
                    {fechasCuotas.length} {fechasCuotas.length === 1 ? 'Cuota' : 'Cuotas'}
                  </span>
                </div>

                {/* Banner de Destaque do Plazo Detectado Automaticamente */}
                <div className="p-3 bg-red-50/80 border border-red-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-cotripar-700 shrink-0" />
                    <div>
                      <span className="text-xs font-black text-cotripar-900 block">
                        Plazo Detectado Automáticamente: {plazoDetectadoMeses} {plazoDetectadoMeses === 1 ? 'Mes' : 'Meses'} (según última cuota: {fechaISOToDDMMYYYY(ultimaFechaCuotaISO) || 'N/A'})
                      </span>
                      <span className="text-[10px] text-slate-600 font-medium">
                        Fecha Tope de Vencimiento: <strong>{infoBloqueActivo.fechaTopeVencimiento}</strong> (Tope Máx: {infoBloqueActivo.plazoMaximo} meses)
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 self-start sm:self-auto">
                    <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-cotripar-700 text-white shadow-xs">
                      {plazoDetectadoMeses <= 12 ? 'Tasa: 0.60% mes' : 'Tasa: 0.80% mes'}
                    </span>
                  </div>
                </div>

                {/* Atajos Rápidos de Preenchimento Inteligente e Botão Agregar Cuota */}
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span className="text-[10px] font-bold text-slate-400 mr-0.5">Atajos:</span>
                  <button
                    type="button"
                    onClick={() => handleApplyAtajo('tope')}
                    className="px-2 py-1 text-[10px] font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg shadow-xs transition-all"
                  >
                    1 Cuota
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyAtajo('semestral')}
                    className="px-2 py-1 text-[10px] font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg shadow-xs transition-all"
                  >
                    2 Cuotas
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyAtajo('zafra')}
                    className="px-2 py-1 text-[10px] font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg shadow-xs transition-all"
                  >
                    3 Cuotas
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyAtajo('mensual')}
                    className="px-2 py-1 text-[10px] font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg shadow-xs transition-all"
                  >
                    Mensual
                  </button>
                  <button
                    type="button"
                    onClick={handleAddCuota}
                    className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-extrabold bg-cotripar-50 hover:bg-cotripar-100 text-cotripar-800 border border-cotripar-200 rounded-lg transition-all shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Agregar Cuota</span>
                  </button>
                </div>

                {/* Lista Dinâmica de Datas de Quotas */}
                <div className="space-y-1.5 max-h-72 overflow-y-auto pr-0.5">
                  {fechasCuotas.map((fecha, idx) => {
                    const mesAcum = calcularMesesDesdeColocacion(fecha, anioColocacion, mesColocacionNum);
                    const prevMesAcum = idx > 0
                      ? calcularMesesDesdeColocacion(fechasCuotas[idx - 1], anioColocacion, mesColocacionNum)
                      : 0;
                    const mesesPeriodo = idx === 0 ? Math.max(1, mesAcum) : Math.max(1, mesAcum - prevMesAcum);

                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between gap-2 p-2 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-xl transition-all"
                      >
                        <span className="text-[11px] font-black text-cotripar-800 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-xs shrink-0">
                          Cuota {idx + 1}
                        </span>

                        <input
                          type="date"
                          min={fechaMinColocacionISO}
                          max={fechaTopeISO}
                          value={fecha}
                          onChange={(e) => handleUpdateFechaCuota(idx, e.target.value)}
                          className="flex-1 min-w-[125px] px-2.5 py-1 text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-cotripar-700 focus:outline-none"
                        />

                        <span className="text-[10px] font-extrabold text-cotripar-700 bg-cotripar-50 px-2 py-0.5 rounded-md border border-cotripar-200 shrink-0">
                          Mes {mesAcum} (+{mesesPeriodo}m)
                        </span>

                        {fechasCuotas.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveCuota(idx)}
                            className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all shrink-0"
                            title="Eliminar cuota"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Banner de Aviso de Error / Bloqueo en Cronograma */}
                {errorFechasCuotas && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-xs font-bold text-red-700 animate-in fade-in">
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <span className="leading-tight">{errorFechasCuotas}</span>
                  </div>
                )}
              </div>

              {/* C. Tasa de Interés Mensual 100% Bloqueada / Readonly */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-cotripar-700" />
                    <span>Tasa de Interés Mensual (100% Bloqueada / Readonly)</span>
                  </label>
                  <span className="text-xs font-black text-cotripar-700 bg-cotripar-50 px-2.5 py-1 rounded-lg border border-cotripar-200">
                    {tasaMensualCalculada.toFixed(2)}% mensual
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    readOnly
                    disabled
                    value={`${tasaMensualCalculada.toFixed(2)}% mensual (${plazoDetectadoMeses <= 12 ? '0.60% mensual — Plazo ≤ 12 meses' : '0.80% mensual — Plazo 13 a 18 meses'})`}
                    className="w-full pl-3.5 pr-10 py-2.5 text-xs font-bold text-slate-600 bg-slate-100 border border-slate-200 rounded-xl cursor-not-allowed select-none"
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-3 pointer-events-none" />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium px-1">
                  <span>🔒 Determinada automáticamente por el plazo de la última cuota (Inalterable)</span>
                  <span>Eq. {plazoDetectadoMeses <= 12 ? '7.20%' : '9.60%'} nom. anual</span>
                </div>
              </div>

              {/* D. Esquema de Amortización */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-cotripar-700" />
                  <span>Esquema de Amortización por Cuota</span>
                </label>
                <select
                  value={esquemaSemestralCotripar}
                  onChange={(e) => setEsquemaSemestralCotripar(e.target.value as EsquemaSemestralCotripar)}
                  className="w-full px-3 py-2 text-xs font-bold text-slate-900 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-cotripar-700 focus:outline-none"
                >
                  <option value="amortizacion_constante">
                    Amortización Constante por Cuota (Capital dividido uniformemente)
                  </option>
                  <option value="interes_primero">
                    Zafra: Interés Primero en intermedias + 100% Capital al Vencimiento Final
                  </option>
                </select>
                <p className="text-[10px] text-slate-500 px-0.5">
                  {esquemaSemestralCotripar === 'interes_primero'
                    ? '🌾 Cuotas intermedias cubren únicamente intereses del período; amortización completa de capital en la última cuota.'
                    : '⚖️ Amortización uniforme de capital (Capital / N) en cada una de las fechas programadas.'}
                </p>
              </div>

              {/* E. Gasto Administrativo: 0% Exento */}
              <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl flex items-center justify-between text-xs">
                <div>
                  <span className="font-extrabold text-emerald-900 block">Gasto Administrativo:</span>
                  <span className="text-[10px] text-emerald-700">0% Exento en Financiación Cotripar</span>
                </div>
                <span className="font-black text-emerald-800 text-sm">
                  $ 0 (Exento)
                </span>
              </div>
            </>
          ) : (
            <>
              {/* 3. Entidad Bancaria (Paraguay) - Sin tasa en la etiqueta de la opción */}
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
                      {b.entidad}
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

              {/* 5. Plazo del Financiamiento (18 meses / 1 a 6 años) con tasas automáticas por banco */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>Plazo del Financiamiento</span>
                  </label>
                  <span className="text-cotripar-700 font-black text-xs">
                    {plazoAnios === 1.5 ? '18 Meses' : `${plazoAnios} ${plazoAnios === 1 ? 'Año' : 'Años'}`}
                  </span>
                </div>
                <div className="grid grid-cols-7 gap-1.5">
                  {[1, 1.5, 2, 3, 4, 5, 6].map((p) => {
                    const currentBank = bancos.find((b) => b.id === selectedBancoId);
                    const rateForP = getTasaPorPlazo(currentBank, p);
                    const isConfigured = rateForP != null;
                    const isSelected = plazoAnios === p;

                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => handlePlazoChange(p)}
                        className={`py-2 px-1 text-xs font-extrabold rounded-xl border transition-all flex flex-col items-center justify-center ${
                          isSelected
                            ? 'bg-cotripar-700 text-white border-cotripar-700 shadow-sm'
                            : isConfigured
                            ? 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                            : 'bg-slate-100/50 text-slate-400 border-dashed border-slate-200 hover:bg-slate-100/80'
                        }`}
                        title={isConfigured ? `Tasa según tabla: ${rateForP}%` : 'Plazo sin tasa de tabla en este banco'}
                      >
                        <span>{p === 1.5 ? '18m' : `${p}a`}</span>
                        {rateForP != null ? (
                          <span
                            className={`text-[9px] font-semibold mt-0.5 ${
                              isSelected ? 'text-cotripar-100' : 'text-slate-500'
                            }`}
                          >
                            {Number(rateForP).toFixed(2)}%
                          </span>
                        ) : (
                          currentBank?.tasas_por_plazo && (
                            <span
                              className={`text-[9px] font-normal mt-0.5 ${
                                isSelected ? 'text-cotripar-200' : 'text-slate-300'
                              }`}
                            >
                              s/tasa
                            </span>
                          )
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Advertencia o indicador de ajuste automático según tabla del banco */}
                {(() => {
                  const currentBank = bancos.find((b) => b.id === selectedBancoId);
                  const rateForCurrent = getTasaPorPlazo(currentBank, plazoAnios);
                  if (currentBank?.tasas_por_plazo && rateForCurrent == null) {
                    return (
                      <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2 font-medium">
                        ⚠️ Plazo sin tasa de tabla en este banco — ingrese tasa manual si aplica
                      </p>
                    );
                  }
                  if (rateForCurrent != null) {
                    const termTxt = plazoAnios === 1.5 ? '18 Meses' : `${plazoAnios} ${plazoAnios === 1 ? 'Año' : 'Años'}`;
                    return (
                      <p className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-2 flex items-center gap-1.5 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>
                          ✓ Tasa ajustada automáticamente a <strong>{Number(rateForCurrent).toFixed(2)}%</strong> para{' '}
                          {termTxt} ({currentBank?.entidad}).
                        </span>
                      </p>
                    );
                  }
                  return null;
                })()}
              </div>

              {/* 6. Periodicidad de Amortización */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Periodicidad de Amortización
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={plazoAnios === 1.5}
                    onClick={() => setFrecuencia('anual')}
                    className={`py-2.5 px-3 text-xs font-bold rounded-xl border transition-all text-center ${
                      plazoAnios === 1.5
                        ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                        : frecuencia === 'anual'
                        ? 'bg-cotripar-700 text-white border-cotripar-700 shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                    title={plazoAnios === 1.5 ? 'El plazo de 18 meses opera exclusivamente en modalidad semestral (3 semestres)' : undefined}
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
                    Semestral {plazoAnios === 1.5 ? '(3 cuotas)' : '(2 cuotas/año)'}
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
            </>
          )}

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
            disabled={isProcessing || (tipoFinanciacion === 'F_COTRIPAR' && Boolean(errorFechasCuotas))}
            onClick={handleCalcularYGenerarPDF}
            className="w-full py-3.5 bg-cotripar-700 hover:bg-cotripar-800 active:bg-cotripar-900 text-white font-extrabold rounded-xl shadow-md hover:shadow-lg flex items-center justify-center gap-2 text-base transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
                <span className="text-slate-500">RUC / C.I.:</span>
                <span className="font-bold text-slate-900">{successModalData.ruc}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Máquina / Implemento:</span>
                <span className="font-bold text-cotripar-700">{successModalData.maquina}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Capital Solicitado:</span>
                <span className="font-extrabold text-slate-900">{formatUSD(successModalData.resultado.capital)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Modalidad / Tasa:</span>
                <span className="font-semibold text-slate-800">
                  {successModalData.resultado.tipoFinanciacion === 'F_COTRIPAR'
                    ? `Financiación Cotripar (${successModalData.resultado.plazoMeses}m • ${successModalData.resultado.tasaMensual?.toFixed(2)}% mes)`
                    : `${successModalData.banco} (${successModalData.resultado.tasaAnual}%)`}
                </span>
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
                    const safeName = successModalData.cliente.replace(/\s+/g, '_');
                    const safeRuc = successModalData.ruc.replace(/\s+/g, '');
                    successModalData.docInstance.save(`Cotripar_Simulacion_${safeName}_${safeRuc}.pdf`);
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
