export const APP_VERSION = 'V.1.8';

export interface ItemMaquinaria {
  id: string;
  descripcion: string;
  cantidad: number;
  precioUnitarioUSD: number;
}

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
  tasas_por_plazo?: Record<string, number | null>;
  tiene_convenio?: boolean;
  modalidad_permitida?: string;
  updated_at?: string;
}

export interface BancoOficialData {
  entidad: string;
  tasa_anual: number;
  tiene_convenio: boolean;
  modalidad_permitida: string;
  tasas_por_plazo: Record<string, number | null>;
}

export const BANCOS_OFICIALES_COTRIPAR: BancoOficialData[] = [
  {
    entidad: "Banco Atlas",
    tasa_anual: 7.50,
    tiene_convenio: true,
    modalidad_permitida: 'Semestral y Anual',
    tasas_por_plazo: { "1": null, "2": 6.90, "3": 6.95, "4": 7.00, "5": 7.50, "6": 7.50 }
  },
  {
    entidad: "Financiera Paraguayo Japonesa",
    tasa_anual: 6.90,
    tiene_convenio: true,
    modalidad_permitida: 'Semestral',
    tasas_por_plazo: { "1": null, "2": 5.75, "3": 6.25, "4": 6.50, "5": 6.90, "6": 7.00 }
  },
  {
    entidad: "Banco GNB",
    tasa_anual: 7.20,
    tiene_convenio: true,
    modalidad_permitida: 'Semestral',
    tasas_por_plazo: { "1": null, "2": 6.50, "3": 7.00, "4": 7.10, "5": 7.20, "6": 7.30 }
  },
  {
    entidad: "Banco Basa",
    tasa_anual: 7.10,
    tiene_convenio: true,
    modalidad_permitida: 'Semestral',
    tasas_por_plazo: { "1": null, "2": null, "3": 6.75, "4": 7.00, "5": 7.10, "6": 7.40 }
  },
  {
    entidad: "Banco Continental",
    tasa_anual: 8.00,
    tiene_convenio: true,
    modalidad_permitida: 'Semestral y Anual',
    tasas_por_plazo: { "1": 7.00, "2": 7.30, "3": 7.50, "4": 7.80, "5": 8.00, "6": null }
  },
  {
    entidad: "Bancop",
    tasa_anual: 7.60,
    tiene_convenio: false,
    modalidad_permitida: 'Semestral y Anual',
    tasas_por_plazo: { "1": null, "2": 6.90, "3": 7.10, "4": 7.40, "5": 7.60, "6": 7.90 }
  },
  {
    entidad: "Banco Sudameris",
    tasa_anual: 7.50,
    tiene_convenio: false,
    modalidad_permitida: 'Semestral y Anual',
    tasas_por_plazo: { "1": null, "2": 7.50, "3": 7.50, "4": 7.50, "5": 7.50, "6": 7.50 }
  },
  {
    entidad: "Interfisa Banco",
    tasa_anual: 7.40,
    tiene_convenio: false,
    modalidad_permitida: 'Semestral',
    tasas_por_plazo: { "1": null, "2": 7.40, "3": 7.40, "4": 7.40, "5": 7.40, "6": 7.40 }
  },
  {
    entidad: "Banco Familiar",
    tasa_anual: 8.75,
    tiene_convenio: false,
    modalidad_permitida: 'Semestral',
    tasas_por_plazo: { "1": null, "2": null, "3": 8.00, "4": 8.50, "5": 8.75, "6": 9.00 }
  },
  {
    entidad: "Banco Itaú",
    tasa_anual: 7.00,
    tiene_convenio: false,
    modalidad_permitida: 'Semestral y Anual',
    tasas_por_plazo: { "1": null, "2": 6.25, "3": 6.50, "4": 6.90, "5": 7.00, "6": null }
  }
];

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
  maquinaImplemento?: string;
  items?: ItemMaquinaria[];
  anticipoUSD?: number;
}

export interface SimulacionPDF {
  id?: string;
  usuario_id?: string | null;
  vendedor_nombre: string;
  cliente_nombre: string;
  cliente_ruc: string;
  maquina_implemento?: string;
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
  items_json?: ItemMaquinaria[];
  anticipo_usd?: number;
  notas?: string;
  created_at?: string;
}
