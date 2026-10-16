# Calculadora Cotripar S.A. — Sistema Alemán de Amortización

Aplicación web integral para la simulación financiera, proyección de cuotas decrecientes bajo el **Sistema Alemán** de amortización y emisión automatizada de reportes ejecutivos en PDF para operaciones comerciales y crediticias de **Cotripar S.A.** en la **República del Paraguay (USD $)**.

---

## 🌾 Características Principales

1. **Calculadora Financiera - Sistema Alemán de Amortización**:
   - Proyección de cuotas decrecientes bajo el Sistema Alemán.
   - Amortización **Anual** (1 cuota/año) o **Semestral** (2 cuotas/año).
   - **Modalidad Semestral Zafra**: primer semestre pago exclusivo de intereses (siembra/entresafra) y segundo semestre amortización de capital e intereses (cosecha/zafra).
   - **Modalidad Semestral Constante**: amortización uniforme y equitativa en todos los semestres.
   - Plazo parametrizable de 1 a 6 años (estándar normativo Cotripar S.A.).
   - Cómputo automático del **1% de gasto administrativo** sobre el capital solicitado.
   - Cómputo oficial del **IVA del 10%** sobre intereses bancarios según el régimen tributario de la República del Paraguay.
   - Detección y destaque automático de la **Mayor Cuota del Año 1** como parámetro clave de exigibilidad y capacidad de repago.

2. **Integración en Tiempo Real con Supabase**:
   - **Tasa Bancarias (`bancos_tasas`)**: Sincronización automática de las entidades financieras activas en Paraguay (Interfisa Banco 7.40%, Banco Sudameris 7.50%, Banco Atlas 7.50%, Banco Continental 7.65%, Banco Basa 7.60%, Banco Itaú 7.75%).
   - **CRUD de Tasas Bancarias**: Panel para agregar, editar, activar/desactivar y restablecer tasas preferenciales.
   - **Historial de Simulaciones (`simulaciones_pdf`)**: Almacenamiento persistente de simulaciones con datos del cliente (Nombre, RUC), asesor responsable, desglose financiero completo y cronograma en formato JSONB.
   - **Autenticación y Control de Accesos (`app_usuarios`)**: Soporte multiusuario con roles diferenciados (`admin` y `vendedor`).

3. **Generador de Reportes Ejecutivos en PDF (A4 One-Pager)**:
   - Emisión directa en el navegador de reportes ejecutivos con membrete corporativo de Cotripar S.A.
   - Cuadro completo de parámetros crediticios, cronograma detallado de vencimientos y consolidado financiero.
   - Espacio formal para firmas y sellos: Asesor Comercial, Conformidad del Cliente y Aprobación del Comité de Crédito / Riesgo.
   - Cláusula institucional de confidencialidad y validez fiscal.

---

## 🛠️ Stack Tecnológico

- **Frontend**: React 19 + TypeScript + Vite
- **Estilos**: Tailwind CSS v3 + Lucide React Icons
- **Base de Datos & Backend**: Supabase (PostgreSQL + Row Level Security + REST API)
- **Generación de PDF**: jsPDF + jsPDF-AutoTable
- **Hosting / Deploy**: Vercel (`vercel.json` SPA rewrite configurado)

---

## 🔐 Configuración de Variables de Entorno

Crear un archivo `.env` en la raíz del proyecto (este archivo está protegido e ignorado por Git):

```env
VITE_SUPABASE_URL=https://xyzcompany.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbG...
```

---

## 🚀 Instalación y Ejecución Local

```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev

# Compilar para producción
npm run build

# Previsualizar build de producción
npm run preview
```
