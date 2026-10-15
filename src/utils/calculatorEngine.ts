import type { FrecuenciaPago, ModalidadSemestral, ResultadoAleman, CronogramaPeriodo, ItemMaquinaria } from '../types';

export const formatUSD = (val: number | string | null | undefined): string => {
  const num = Math.round(Number(val) || 0);
  return '$ ' + num.toLocaleString('en-US');
};

export const formatPercent = (val: number | null | undefined): string => {
  const num = Number(val) || 0;
  return `${num.toFixed(2)}%`;
};

/**
 * Calculadora de Amortización bajo el Sistema Alemán (Cuotas Decrecientes)
 * con cómputo oficial de IVA (10%) sobre intereses bancarios según régimen fiscal de Paraguay
 * y 1% de gasto administrativo sobre el capital solicitado.
 * Estándar normativo de Cotripar S.A. (plazo de 1 a 6 años).
 */
export function calcularSistemaAleman(
  capital: number,
  tasaAnual: number,
  plazoAnios: number,
  frecuencia: FrecuenciaPago = 'anual',
  esquemaSemestral: ModalidadSemestral = 'zafra_interes_primero',
  bancoEntidad?: string
): ResultadoAleman {
  const cap = Math.max(0, Number(capital) || 0);
  const tasa = Math.max(0, Number(tasaAnual) || 0);
  const plazo = Math.max(1, Math.min(6, Math.round(Number(plazoAnios) || 1)));
  const freq: FrecuenciaPago = frecuencia === 'semestral' ? 'semestral' : 'anual';
  const esquema: ModalidadSemestral = esquemaSemestral === 'constante' ? 'constante' : 'zafra_interes_primero';

  // 1% de Gasto Administrativo sobre el capital solicitado
  const gastoAdmin = cap * 0.01;
  const cronograma: CronogramaPeriodo[] = [];
  let saldoActual = cap;
  let totalIntereses = 0;
  let totalIva = 0;
  let totalCuotas = 0;

  if (freq === 'semestral') {
    const totalSemestres = plazo * 2;
    const tasaSemestral = (tasa / 100) / 2;
    const amortizacionAnual = plazo > 0 ? cap / plazo : 0;
    const amortizacionSemestralConstante = totalSemestres > 0 ? cap / totalSemestres : 0;

    for (let s = 1; s <= totalSemestres; s++) {
      const saldoInicial = saldoActual;
      const anio = Math.ceil(s / 2);
      const interes = saldoInicial * tasaSemestral;
      const iva = interes * 0.10; // IVA bancario PY al 10%
      let amortizacion = 0;
      let label = '';

      if (esquema === 'zafra_interes_primero') {
        if (s % 2 !== 0) {
          // Semestre impar: solo interés (período de siembra / entresafra)
          amortizacion = 0;
          label = `Semestre ${s} (Interés)`;
        } else {
          // Semestre par: capital + interés (período de cosecha / zafra)
          amortizacion = amortizacionAnual;
          label = `Semestre ${s} (Cap + Int)`;
        }
      } else {
        // Amortización constante semestral
        amortizacion = amortizacionSemestralConstante;
        label = `Semestre ${s}`;
      }

      const cuota = amortizacion + interes + iva;
      const saldoFinal = Math.max(0, saldoInicial - amortizacion);

      totalIntereses += interes;
      totalIva += iva;
      totalCuotas += cuota;

      cronograma.push({
        periodo: s,
        label,
        anio,
        saldoInicial,
        amortizacion,
        interes,
        iva,
        cuota,
        saldoFinal: s === totalSemestres ? 0 : saldoFinal
      });

      saldoActual = saldoFinal;
    }
  } else {
    // Modalidad anual estándar
    const tasaDecimal = tasa / 100;
    const amortizacionAnual = plazo > 0 ? cap / plazo : 0;

    for (let i = 1; i <= plazo; i++) {
      const saldoInicial = saldoActual;
      const interes = saldoInicial * tasaDecimal;
      const iva = interes * 0.10; // IVA bancario PY al 10%
      const cuota = amortizacionAnual + interes + iva;
      const saldoFinal = Math.max(0, saldoInicial - amortizacionAnual);

      totalIntereses += interes;
      totalIva += iva;
      totalCuotas += cuota;

      cronograma.push({
        periodo: i,
        label: `Año ${i}`,
        anio: i,
        saldoInicial,
        amortizacion: amortizacionAnual,
        interes,
        iva,
        cuota,
        saldoFinal: i === plazo ? 0 : saldoFinal
      });

      saldoActual = saldoFinal;
    }
  }

  const costoFinancieroTotal = totalIntereses + totalIva + gastoAdmin;
  const totalPagado = cap + costoFinancieroTotal;

  const cronogramaAnio1 = cronograma.filter(c => c.anio === 1);
  const cuotaMayorAnio1 = cronogramaAnio1.length > 0
    ? Math.max(...cronogramaAnio1.map(c => c.cuota))
    : 0;
  const totalCuotasAnio1 = cronogramaAnio1.length > 0
    ? cronogramaAnio1.reduce((sum, c) => sum + c.cuota, 0)
    : 0;

  return {
    capital: cap,
    tasaAnual: tasa,
    plazoAnios: plazo,
    frecuencia: freq,
    modalidadSemestral: freq === 'semestral' ? esquema : undefined,
    gastoAdmin,
    cronograma,
    totalIntereses,
    totalIva,
    totalCuotas,
    costoFinancieroTotal,
    totalPagado,
    cuotaAnio1: cuotaMayorAnio1,
    cuotaMayorAnio1,
    totalCuotasAnio1,
    bancoEntidad
  };
}

export interface MatrizBloqueInfo {
  mesNombre: string;
  anio: number;
  bloque: 'Bloque 1' | 'Bloque 2';
  fechaTopeVencimiento: string;
  plazoMaximo: number;
  tasaSugerida: number;
}

export const MESES_MATRIZ_COTRIPAR: string[] = [
  'Marzo 2026', 'Abril 2026', 'Mayo 2026', 'Junio 2026', 'Julio 2026', 'Agosto 2026',
  'Septiembre 2026', 'Octubre 2026', 'Noviembre 2026', 'Diciembre 2026',
  'Enero 2027', 'Febrero 2027', 'Marzo 2027', 'Abril 2027', 'Mayo 2027', 'Junio 2027',
  'Julio 2027', 'Agosto 2027', 'Septiembre 2027', 'Octubre 2027', 'Noviembre 2027', 'Diciembre 2027',
  'Enero 2028', 'Febrero 2028', 'Marzo 2028', 'Abril 2028', 'Mayo 2028', 'Junio 2028',
  'Julio 2028', 'Agosto 2028', 'Septiembre 2028', 'Octubre 2028', 'Noviembre 2028', 'Diciembre 2028'
];

/**
 * Determina el Bloque Operativo, la Fecha Tope de Vencimiento y el Plazo Máximo Permitido
 * según la Matriz Operativa de Plazos y Bloques de Cotripar S.A. (Ciclo 2026 - 2028).
 */
export function getMatrizBloqueInfo(mesColocacionStr?: string): MatrizBloqueInfo {
  const defaultMonthStr = 'Octubre 2026';
  const raw = (mesColocacionStr || defaultMonthStr).trim();
  const parts = raw.split(/\s+/);
  const mesName = (parts[0] || 'Octubre').toLowerCase();
  const anio = parseInt(parts[1], 10) || 2026;

  // Bloque 1: Marzo a Agosto -> Vence 20/08 del año subsiguiente (anio + 1)
  // Bloque 2: Septiembre a Febrero -> Vence 20/03 de dos años posteriores
  // Nota: si colocación es Ene/Feb del año Y, pertenece a la ventana de Septiembre Y-1, por lo que vence 20/03/(anio + 1).

  let bloque: 'Bloque 1' | 'Bloque 2' = 'Bloque 2';
  let fechaTopeVencimiento = `20/03/${anio + 2}`;
  let plazoMaximo = 17;

  if (mesName.startsWith('mar')) {
    bloque = 'Bloque 1';
    plazoMaximo = 18;
    fechaTopeVencimiento = `20/08/${anio + 1}`;
  } else if (mesName.startsWith('abr')) {
    bloque = 'Bloque 1';
    plazoMaximo = 17;
    fechaTopeVencimiento = `20/08/${anio + 1}`;
  } else if (mesName.startsWith('may')) {
    bloque = 'Bloque 1';
    plazoMaximo = 16;
    fechaTopeVencimiento = `20/08/${anio + 1}`;
  } else if (mesName.startsWith('jun')) {
    bloque = 'Bloque 1';
    plazoMaximo = 15;
    fechaTopeVencimiento = `20/08/${anio + 1}`;
  } else if (mesName.startsWith('jul')) {
    bloque = 'Bloque 1';
    plazoMaximo = 14;
    fechaTopeVencimiento = `20/08/${anio + 1}`;
  } else if (mesName.startsWith('ago')) {
    bloque = 'Bloque 1';
    plazoMaximo = 12; // Plazo Mínimo del Bloque 1
    fechaTopeVencimiento = `20/08/${anio + 1}`;
  } else if (mesName.startsWith('sep') || mesName.startsWith('set')) {
    bloque = 'Bloque 2';
    plazoMaximo = 18;
    fechaTopeVencimiento = `20/03/${anio + 2}`;
  } else if (mesName.startsWith('oct')) {
    bloque = 'Bloque 2';
    plazoMaximo = 17;
    fechaTopeVencimiento = `20/03/${anio + 2}`;
  } else if (mesName.startsWith('nov')) {
    bloque = 'Bloque 2';
    plazoMaximo = 16;
    fechaTopeVencimiento = `20/03/${anio + 2}`;
  } else if (mesName.startsWith('dic')) {
    bloque = 'Bloque 2';
    plazoMaximo = 15;
    fechaTopeVencimiento = `20/03/${anio + 2}`;
  } else if (mesName.startsWith('ene')) {
    bloque = 'Bloque 2';
    plazoMaximo = 14;
    fechaTopeVencimiento = `20/03/${anio + 1}`;
  } else if (mesName.startsWith('feb')) {
    bloque = 'Bloque 2';
    plazoMaximo = 12; // Plazo Mínimo del Bloque 2
    fechaTopeVencimiento = `20/03/${anio + 1}`;
  }

  const tasaSugerida = plazoMaximo <= 12 ? 0.60 : 0.80;

  // Normalizar nombre de mes con mayúscula inicial
  const capitalMes = mesName.charAt(0).toUpperCase() + mesName.slice(1);
  const normalizedMes = `${capitalMes} ${anio}`;

  return {
    mesNombre: normalizedMes,
    anio,
    bloque,
    fechaTopeVencimiento,
    plazoMaximo,
    tasaSugerida
  };
}

export const getTasaMensualCotripar = (plazoMeses: number): number => {
  return plazoMeses <= 12 ? 0.60 : 0.80;
};

/**
 * Convierte una fecha ISO (YYYY-MM-DD) al formato paraguayo / comercial (DD/MM/YYYY).
 */
export function fechaISOToDDMMYYYY(fechaISO?: string): string {
  if (!fechaISO) return '';
  const parts = fechaISO.split('-');
  if (parts.length === 3) {
    return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
  }
  return fechaISO;
}

/**
 * Convierte una fecha DD/MM/YYYY al formato ISO (YYYY-MM-DD).
 */
export function fechaDDMMYYYYToISO(fechaDDMMYYYY?: string): string {
  if (!fechaDDMMYYYY) return '';
  const parts = fechaDDMMYYYY.split('/');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  return fechaDDMMYYYY;
}

/**
 * Extrae el número de mes (1 a 12) y el año de colocación de un texto como "Octubre 2026".
 */
export function parseMesColocacion(mesColocacionStr?: string): { mesNum: number; anio: number } {
  const defaultMonthStr = 'Octubre 2026';
  const raw = (mesColocacionStr || defaultMonthStr).trim();
  const parts = raw.split(/\s+/);
  const mesName = (parts[0] || 'Octubre').toLowerCase();
  const anio = parseInt(parts[1], 10) || 2026;

  let mesNum = 10;
  if (mesName.startsWith('ene')) mesNum = 1;
  else if (mesName.startsWith('feb')) mesNum = 2;
  else if (mesName.startsWith('mar')) mesNum = 3;
  else if (mesName.startsWith('abr')) mesNum = 4;
  else if (mesName.startsWith('may')) mesNum = 5;
  else if (mesName.startsWith('jun')) mesNum = 6;
  else if (mesName.startsWith('jul')) mesNum = 7;
  else if (mesName.startsWith('ago')) mesNum = 8;
  else if (mesName.startsWith('sep') || mesName.startsWith('set')) mesNum = 9;
  else if (mesName.startsWith('oct')) mesNum = 10;
  else if (mesName.startsWith('nov')) mesNum = 11;
  else if (mesName.startsWith('dic')) mesNum = 12;

  return { mesNum, anio };
}

/**
 * Fórmula comercial para calcular los meses transcurridos desde el mes de colocación hasta una fecha ISO:
 * (ultimaFecha.getFullYear() - anioColocacion) * 12 + (ultimaFecha.getMonth() + 1 - mesColocacion)
 * Garantiza un mínimo de 1 mes.
 */
export function calcularMesesDesdeColocacion(
  fechaISO: string,
  anioColocacion: number,
  mesColocacionNum: number
): number {
  if (!fechaISO) return 1;
  const parts = fechaISO.split('-');
  if (parts.length !== 3) return 1;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const diff = (y - anioColocacion) * 12 + (m - mesColocacionNum);
  return Math.max(1, diff);
}

/**
 * Genera atajos rápidos de fechas según la política de Financiación Cotripar.
 */
export function generarFechasAtajo(
  tipo: 'tope' | 'semestral' | 'zafra' | 'mensual',
  mesColocacionStr?: string
): string[] {
  const info = getMatrizBloqueInfo(mesColocacionStr);
  const { mesNum, anio } = parseMesColocacion(mesColocacionStr);
  const fechaTopeISO = fechaDDMMYYYYToISO(info.fechaTopeVencimiento);

  if (tipo === 'tope') {
    return [fechaTopeISO];
  }

  if (tipo === 'semestral') {
    // 1ª en +6 meses (día 20) y 2ª en Fecha Tope
    const m1 = mesNum + 6;
    const y1 = anio + Math.floor((m1 - 1) / 12);
    const monthVal1 = ((m1 - 1) % 12) + 1;
    const cuota1 = `${y1}-${String(monthVal1).padStart(2, '0')}-20`;

    if (cuota1 >= fechaTopeISO) {
      return [fechaTopeISO];
    }
    return [cuota1, fechaTopeISO];
  }

  if (tipo === 'zafra') {
    // 3 cuotas distribuidas hasta la Fecha Tope
    if (info.plazoMaximo <= 12) {
      const step1 = Math.max(1, Math.round(info.plazoMaximo / 3));
      const step2 = Math.max(step1 + 1, Math.round((info.plazoMaximo * 2) / 3));

      const m1 = mesNum + step1;
      const y1 = anio + Math.floor((m1 - 1) / 12);
      const cuota1 = `${y1}-${String(((m1 - 1) % 12) + 1).padStart(2, '0')}-20`;

      const m2 = mesNum + step2;
      const y2 = anio + Math.floor((m2 - 1) / 12);
      const cuota2 = `${y2}-${String(((m2 - 1) % 12) + 1).padStart(2, '0')}-20`;

      return [cuota1, cuota2, fechaTopeISO];
    } else {
      // +6m, +12m y Fecha Tope
      const m1 = mesNum + 6;
      const y1 = anio + Math.floor((m1 - 1) / 12);
      const cuota1 = `${y1}-${String(((m1 - 1) % 12) + 1).padStart(2, '0')}-20`;

      const m2 = mesNum + 12;
      const y2 = anio + Math.floor((m2 - 1) / 12);
      const cuota2 = `${y2}-${String(((m2 - 1) % 12) + 1).padStart(2, '0')}-20`;

      return [cuota1, cuota2, fechaTopeISO];
    }
  }

  if (tipo === 'mensual') {
    // Cuotas mensuales el día 20 de cada mes hasta la Fecha Tope
    const dates: string[] = [];
    for (let step = 1; step <= info.plazoMaximo; step++) {
      const curM = mesNum + step;
      const curY = anio + Math.floor((curM - 1) / 12);
      const mVal = ((curM - 1) % 12) + 1;
      const dStr = `${curY}-${String(mVal).padStart(2, '0')}-20`;
      if (dStr <= fechaTopeISO) {
        dates.push(dStr);
        if (dStr === fechaTopeISO) break;
      } else {
        break;
      }
    }
    if (dates.length === 0 || dates[dates.length - 1] !== fechaTopeISO) {
      if (!dates.includes(fechaTopeISO)) {
        dates.push(fechaTopeISO);
      }
    }
    return dates;
  }

  return [fechaTopeISO];
}

/**
 * Calculadora Oficial Financiación Cotripar V.2.3:
 * - Fechas de pago exactas por cuota ingresadas por el asesor (`fechasCuotas`).
 * - Detección 100% automática del plazo financiado según la fecha de la ÚLTIMA cuota.
 * - Tasa mensual automática: 0.60% mensual si plazo <= 12 meses; 0.80% mensual si 13 a 18 meses.
 * - Amortización bajo Sistema Alemán con cómputo proporcional de intereses por período.
 * - Sin gasto administrativo (0% - Exento).
 * - IVA del 10% exclusivamente sobre los intereses.
 */
export function calcularFCotripar(
  capital: number,
  mesColocacion: string,
  _plazoMesesParam?: number,
  periodicidad: 'mensual' | 'semestral_zafra' | 'pago_unico' = 'mensual',
  esquemaSemestral: 'amortizacion_constante' | 'interes_primero' = 'amortizacion_constante',
  maquinaImplemento?: string,
  items?: ItemMaquinaria[],
  anticipoUSD?: number,
  fechasCuotasParam?: string[]
): ResultadoAleman {
  const cap = Math.max(0, Number(capital) || 0);
  const infoBloque = getMatrizBloqueInfo(mesColocacion);
  const { mesNum, anio: anioColocacion } = parseMesColocacion(mesColocacion);

  // Determinar la lista de fechas de cuotas a procesar
  let fechasCuotas: string[] = [];
  if (fechasCuotasParam && fechasCuotasParam.length > 0) {
    fechasCuotas = [...fechasCuotasParam];
  } else {
    // Si no se pasaron fechas, generar atajo predeterminado según la periodicidad
    const atajoTipo = periodicidad === 'pago_unico'
      ? 'tope'
      : (periodicidad === 'semestral_zafra' ? 'zafra' : 'mensual');
    fechasCuotas = generarFechasAtajo(atajoTipo, mesColocacion);
  }

  const N = Math.max(1, fechasCuotas.length);
  const ultimaFechaISO = fechasCuotas[fechasCuotas.length - 1];

  // Detección 100% Automática del Plazo en Meses basada en la ÚLTIMA CUOTA
  const plazoDetectado = calcularMesesDesdeColocacion(ultimaFechaISO, anioColocacion, mesNum);
  const plazoFinal = Math.max(1, Math.min(18, plazoDetectado));

  // Ajuste Automático de la Tasa Mensual (0.60% vs 0.80%)
  const tasaMensual = getTasaMensualCotripar(plazoFinal);
  const tasaAnual = tasaMensual * 12;

  // 0% Gasto Administrativo en Financiación Cotripar
  const gastoAdmin = 0;

  const cronograma: CronogramaPeriodo[] = [];
  let saldoActual = cap;
  let totalIntereses = 0;
  let totalIva = 0;
  let totalCuotas = 0;
  let mesAcumuladoAnterior = 0;

  const amortizacionBase = N > 0 ? cap / N : 0;

  for (let i = 0; i < N; i++) {
    const fechaISO = fechasCuotas[i];
    const isLast = i === N - 1;
    const saldoInicial = saldoActual;

    // Mes acumulado desde la colocación hasta esta cuota
    const mesAcumulado = calcularMesesDesdeColocacion(fechaISO, anioColocacion, mesNum);

    // Meses transcurridos en este período específico
    const mesesPeriodo = i === 0
      ? Math.max(1, mesAcumulado)
      : Math.max(1, mesAcumulado - mesAcumuladoAnterior);

    // Cálculo de Amortización según esquema
    let amortizacion = 0;
    if (esquemaSemestral === 'interes_primero') {
      amortizacion = isLast ? saldoInicial : 0;
    } else {
      amortizacion = isLast ? saldoInicial : amortizacionBase;
    }

    // Interés y IVA proporcional a los meses transcurridos en este período
    const interes = saldoInicial * (tasaMensual / 100) * mesesPeriodo;
    const iva = interes * 0.10;
    const cuota = amortizacion + interes + iva;
    const saldoFinal = Math.max(0, saldoInicial - amortizacion);

    totalIntereses += interes;
    totalIva += iva;
    totalCuotas += cuota;

    const fechaDDMMYYYY = fechaISOToDDMMYYYY(fechaISO);
    const label = `Cuota ${i + 1} (${fechaDDMMYYYY})`;

    cronograma.push({
      periodo: i + 1,
      label,
      anio: Math.ceil(mesAcumulado / 12),
      saldoInicial,
      amortizacion,
      interes,
      iva,
      cuota,
      saldoFinal: isLast ? 0 : saldoFinal
    });

    saldoActual = saldoFinal;
    mesAcumuladoAnterior = mesAcumulado;
  }

  const costoFinancieroTotal = totalIntereses + totalIva + gastoAdmin;
  const totalPagado = cap + costoFinancieroTotal;

  // Mayor cuota y totales del primer año (primeros 12 meses)
  const cuotasAnio1 = cronograma.filter(c => c.anio === 1);
  const cuotaMayorAnio1 = cuotasAnio1.length > 0
    ? Math.max(...cuotasAnio1.map(c => c.cuota))
    : (cronograma.length > 0 ? cronograma[0].cuota : 0);
  const totalCuotasAnio1 = cuotasAnio1.length > 0
    ? cuotasAnio1.reduce((sum, c) => sum + c.cuota, 0)
    : 0;

  return {
    capital: cap,
    tasaAnual,
    plazoAnios: Math.ceil(plazoFinal / 12),
    frecuencia: (N <= 2 ? 'semestral' : (N > 6 ? 'mensual' : 'semestral')) as any,
    modalidadSemestral: esquemaSemestral === 'interes_primero' ? 'zafra_interes_primero' : 'constante',
    gastoAdmin: 0,
    cronograma,
    totalIntereses,
    totalIva,
    totalCuotas,
    costoFinancieroTotal,
    totalPagado,
    cuotaAnio1: cuotaMayorAnio1,
    cuotaMayorAnio1,
    totalCuotasAnio1,
    bancoEntidad: 'Financiación Cotripar',
    maquinaImplemento,
    items,
    anticipoUSD,
    tipoFinanciacion: 'F_COTRIPAR',
    mesColocacion: infoBloque.mesNombre,
    fechaTopeVencimiento: infoBloque.fechaTopeVencimiento,
    plazoMeses: plazoFinal,
    tasaMensual,
    bloqueActivo: infoBloque.bloque,
    periodicidadCotripar: periodicidad,
    fechasCuotas,
    fechaUltimaCuota: fechaISOToDDMMYYYY(ultimaFechaISO),
    cantidadCuotas: N
  };
}

