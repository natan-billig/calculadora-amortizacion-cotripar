export const APP_VERSION = 'V.1.2';

export type UserRole = 'admin' | 'vendedor';

export interface AppUser {
  id: string;
  nombre: string;
  username: string;
  password_hash?: string;
  rol: UserRole;
  activo: boolean;
  created_at?: string;
}

export interface BancoTasa {
  id: string;
  entidad: string;
  tasa_anual: number;
  activo: boolean;
  updated_at?: string;
}

export type FrecuenciaPago = 'anual' | 'semestral';
export type ModalidadSemestral = 'zafra_interes_primero' | 'constante';

export interface CronogramaPeriodo {
  periodo: number;
  label: string;
  anio: number;
  saldoInicial: number;
  amortizacion: number;
  interes: number;
  iva: number; // 10% s/ interés según régimen tributario PY
  cuota: number;
  saldoFinal: number;
}

export interface ResultadoAleman {
  capital: number;
  tasaAnual: number;
  plazoAnios: number;
  frecuencia: FrecuenciaPago;
  modalidadSemestral?: ModalidadSemestral;
  gastoAdmin: number; // 1% s/ capital
  cronograma: CronogramaPeriodo[];
  totalIntereses: number;
  totalIva: number;
  totalCuotas: number;
  costoFinancieroTotal: number;
  totalPagado: number;
  cuotaAnio1: number;
  cuotaMayorAnio1: number;
  totalCuotasAnio1: number;
  bancoEntidad?: string;
}

export interface SimulacionPDF {
  id?: string;
  usuario_id?: string | null;
  vendedor_nombre: string;
  cliente_nombre: string;
  cliente_ruc: string;
  capital_usd: number;
  gasto_admin_usd: number;
  banco_entidad: string;
  tasa_anual: number;
  plazo_anios: number;
  periodicidad: string;
  modalidad_semestral?: string | null;
  total_intereses_usd: number;
  total_iva_usd: number;
  costo_financiero_total_usd: number;
  total_pagado_usd: number;
  mayor_cuota_anio1_usd: number;
  cronograma_json: CronogramaPeriodo[];
  notas?: string;
  created_at?: string;
}
