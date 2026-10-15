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

  // Bloque 1: Marzo a Agosto -> Vence 31/08 del año subsiguiente (anio + 1)
  // Bloque 2: Septiembre a Febrero -> Vence 20/03 de dos años posteriores
  // Nota: si colocación es Ene/Feb del año Y, pertenece a la ventana de Septiembre Y-1, por lo que vence 20/03/(anio + 1).

  let bloque: 'Bloque 1' | 'Bloque 2' = 'Bloque 2';
  let fechaTopeVencimiento = `20/03/${anio + 2}`;
  let plazoMaximo = 17;

  if (mesName.startsWith('mar')) {
    bloque = 'Bloque 1';
    plazoMaximo = 18;
    fechaTopeVencimiento = `31/08/${anio + 1}`;
  } else if (mesName.startsWith('abr')) {
    bloque = 'Bloque 1';
    plazoMaximo = 17;
    fechaTopeVencimiento = `31/08/${anio + 1}`;
  } else if (mesName.startsWith('may')) {
    bloque = 'Bloque 1';
    plazoMaximo = 16;
    fechaTopeVencimiento = `31/08/${anio + 1}`;
  } else if (mesName.startsWith('jun')) {
    bloque = 'Bloque 1';
    plazoMaximo = 15;
    fechaTopeVencimiento = `31/08/${anio + 1}`;
  } else if (mesName.startsWith('jul')) {
    bloque = 'Bloque 1';
    plazoMaximo = 14;
    fechaTopeVencimiento = `31/08/${anio + 1}`;
  } else if (mesName.startsWith('ago')) {
    bloque = 'Bloque 1';
    plazoMaximo = 12; // Plazo Mínimo del Bloque 1
    fechaTopeVencimiento = `31/08/${anio + 1}`;
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
 * Calculadora Oficial F COTRIPAR (Financiación Propia Directa hasta 18 meses).
 * - Sin gasto administrativo (0% - Exento).
 * - Tasa mensual automática: 0.60% mensual si plazo <= 12 meses; 0.80% mensual si 13 a 18 meses.
 * - IVA de 10% exclusivamente sobre los intereses.
 * - Periodicidades: Mensual, Semestral / Zafra (hasta Fecha Tope) o Pago Único al Vencimiento.
 */
export function calcularFCotripar(
  capital: number,
  mesColocacion: string,
  plazoMeses: number,
  periodicidad: 'mensual' | 'semestral_zafra' | 'pago_unico' = 'mensual',
  esquemaSemestral: 'amortizacion_constante' | 'interes_primero' = 'amortizacion_constante',
  maquinaImplemento?: string,
  items?: ItemMaquinaria[],
  anticipoUSD?: number
): ResultadoAleman {
  const cap = Math.max(0, Number(capital) || 0);
  const infoBloque = getMatrizBloqueInfo(mesColocacion);
  const plazo = Math.max(1, Math.min(infoBloque.plazoMaximo, Math.round(Number(plazoMeses) || infoBloque.plazoMaximo)));

  // Regla estricta: 0.60% mensual si <= 12 meses; 0.80% mensual si 13 a 18 meses
  const tasaMensual = getTasaMensualCotripar(plazo);
  const tasaAnual = tasaMensual * 12; // Equivalente nominal anual (7.20% o 9.60%)

  // 0% Gasto Administrativo en F COTRIPAR
  const gastoAdmin = 0;

  const cronograma: CronogramaPeriodo[] = [];
  let totalIntereses = 0;
  let totalIva = 0;
  let totalCuotas = 0;

  if (periodicidad === 'mensual') {
    // 1. Mensual: N = plazo cuotas mensuales (Sistema Alemán)
    const N = plazo;
    const amortizacionBase = N > 0 ? cap / N : 0;
    let saldoActual = cap;

    for (let m = 1; m <= N; m++) {
      const saldoInicial = saldoActual;
      const anio = Math.ceil(m / 12);
      const interes = saldoInicial * (tasaMensual / 100);
      const iva = interes * 0.10;
      const amortizacion = m === N ? saldoInicial : amortizacionBase;
      const cuota = amortizacion + interes + iva;
      const saldoFinal = Math.max(0, saldoInicial - amortizacion);

      totalIntereses += interes;
      totalIva += iva;
      totalCuotas += cuota;

      cronograma.push({
        periodo: m,
        label: `Mes ${m}`,
        anio,
        saldoInicial,
        amortizacion,
        interes,
        iva,
        cuota,
        saldoFinal: m === N ? 0 : saldoFinal
      });

      saldoActual = saldoFinal;
    }
  } else if (periodicidad === 'semestral_zafra') {
    // 2. Semestral / Zafra: cuotas semestrales ajustadas a los meses exactos hasta la Fecha Tope
    interface QuotaTarget {
      periodo: number;
      mesFin: number;
      mesesDelPeriodo: number;
    }
    const quotas: QuotaTarget[] = [];

    if (plazo <= 6) {
      quotas.push({ periodo: 1, mesFin: plazo, mesesDelPeriodo: plazo });
    } else if (plazo <= 12) {
      quotas.push({ periodo: 1, mesFin: 6, mesesDelPeriodo: 6 });
      quotas.push({ periodo: 2, mesFin: plazo, mesesDelPeriodo: plazo - 6 });
    } else {
      quotas.push({ periodo: 1, mesFin: 6, mesesDelPeriodo: 6 });
      quotas.push({ periodo: 2, mesFin: 12, mesesDelPeriodo: 6 });
      quotas.push({ periodo: 3, mesFin: plazo, mesesDelPeriodo: plazo - 12 });
    }

    const numCuotas = quotas.length;
    const amortizacionConstante = numCuotas > 0 ? cap / numCuotas : 0;
    let saldoActual = cap;

    for (let i = 0; i < numCuotas; i++) {
      const q = quotas[i];
      const isLast = i === numCuotas - 1;
      const saldoInicial = saldoActual;
      const anio = Math.ceil(q.mesFin / 12);
      const interes = saldoInicial * (tasaMensual / 100) * q.mesesDelPeriodo;
      const iva = interes * 0.10;

      let amortizacion = 0;
      let label = '';

      if (esquemaSemestral === 'interes_primero') {
        if (!isLast) {
          amortizacion = 0;
          label = `Cuota ${i + 1} (Mes ${q.mesFin} - Solo Interés)`;
        } else {
          amortizacion = saldoInicial;
          label = `Cuota ${i + 1} (Mes ${q.mesFin} - Cap + Int)`;
        }
      } else {
        amortizacion = isLast ? saldoInicial : amortizacionConstante;
        label = isLast
          ? `Cuota ${i + 1} (Mes ${q.mesFin} - Vencimiento Final)`
          : `Cuota ${i + 1} (Mes ${q.mesFin} - Semestral)`;
      }

      const cuota = amortizacion + interes + iva;
      const saldoFinal = Math.max(0, saldoInicial - amortizacion);

      totalIntereses += interes;
      totalIva += iva;
      totalCuotas += cuota;

      cronograma.push({
        periodo: q.periodo,
        label,
        anio,
        saldoInicial,
        amortizacion,
        interes,
        iva,
        cuota,
        saldoFinal: isLast ? 0 : saldoFinal
      });

      saldoActual = saldoFinal;
    }
  } else {
    // 3. Pago Único al Vencimiento (1 sola cuota al final del plazo)
    const saldoInicial = cap;
    const interes = cap * (tasaMensual / 100) * plazo;
    const iva = interes * 0.10;
    const amortizacion = cap;
    const cuota = amortizacion + interes + iva;
    const anio = Math.ceil(plazo / 12);

    totalIntereses = interes;
    totalIva = iva;
    totalCuotas = cuota;

    cronograma.push({
      periodo: 1,
      label: `Pago Único (Mes ${plazo} - Vencimiento)`,
      anio,
      saldoInicial,
      amortizacion,
      interes,
      iva,
      cuota,
      saldoFinal: 0
    });
  }

  const costoFinancieroTotal = totalIntereses + totalIva + gastoAdmin;
  const totalPagado = cap + costoFinancieroTotal;

  // Mayor cuota año 1
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
    plazoAnios: Math.ceil(plazo / 12),
    frecuencia: (periodicidad === 'semestral_zafra' ? 'semestral' : (periodicidad === 'mensual' ? 'mensual' : 'anual')) as any,
    modalidadSemestral: periodicidad === 'semestral_zafra'
      ? (esquemaSemestral === 'interes_primero' ? 'zafra_interes_primero' : 'constante')
      : undefined,
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
    bancoEntidad: 'F COTRIPAR (Financiación Propia)',
    maquinaImplemento,
    items,
    anticipoUSD,
    tipoFinanciacion: 'F_COTRIPAR',
    mesColocacion: infoBloque.mesNombre,
    fechaTopeVencimiento: infoBloque.fechaTopeVencimiento,
    plazoMeses: plazo,
    tasaMensual,
    bloqueActivo: infoBloque.bloque,
    periodicidadCotripar: periodicidad
  };
}

