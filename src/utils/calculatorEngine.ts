import type { FrecuenciaPago, ModalidadSemestral, ResultadoAleman, CronogramaPeriodo } from '../types';

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
