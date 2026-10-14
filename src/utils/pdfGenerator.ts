import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ResultadoAleman, SimulacionPDF } from '../types';
import { APP_VERSION } from '../types';
import { formatUSD, formatPercent } from './calculatorEngine';

interface LogoData {
  base64: string;
  ratio: number;
}

async function getLogoBase64(): Promise<LogoData | null> {
  const candidates = ['/logo_branco.png', '/logo.png'];
  for (const path of candidates) {
    try {
      const res = await fetch(path);
      if (!res.ok) continue;
      const blob = await res.blob();
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string) || '');
        reader.onerror = () => resolve('');
        reader.readAsDataURL(blob);
      });
      if (!base64) continue;

      const ratio = await new Promise<number>((resolve) => {
        const img = new Image();
        img.onload = () => {
          const r = img.width > 0 && img.height > 0 ? img.width / img.height : 2.754;
          resolve(r);
        };
        img.onerror = () => resolve(2.754);
        img.src = base64;
      });

      return { base64, ratio };
    } catch {
      continue;
    }
  }
  return null;
}

export async function generarPDFSimulacion(
  simulacion: SimulacionPDF,
  resultado: ResultadoAleman
): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const now = new Date();
  const fechaStr = now.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }) + ' ' + now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

  const codProtocolo = `COT-SIM-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;

  // Header Background Bar (Cotripar Red: #C8102E -> RGB: 200, 16, 46)
  doc.setFillColor(200, 16, 46);
  doc.rect(0, 0, pageWidth, 28, 'F');

  // Thin Dark Red Line Accent
  doc.setFillColor(153, 27, 27);
  doc.rect(0, 28, pageWidth, 1.5, 'F');

  // Load logo with proper aspect ratio
  const logoData = await getLogoBase64();
  let textStartX = 14;
  if (logoData) {
    try {
      const targetHeight = 12; // 12mm
      const targetWidth = Math.min(36, targetHeight * (logoData.ratio || 2.754));
      doc.addImage(logoData.base64, 'PNG', 14, 8, targetWidth, targetHeight);
      textStartX = 14 + targetWidth + 5; // Clean breathing room after logo (e.g. ~52-55mm)
      if (textStartX < 54) textStartX = 54;
    } catch {
      textStartX = 14;
    }
  }

  // Header Title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('COTRIPAR S.A. | RUC: 80019076-9', textStartX, 11.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('PROYECCIÓN FINANCIERA DE AMORTIZACIÓN — SISTEMA ALEMÁN (USD)', textStartX, 16.5);
  doc.text('Régimen Fiscal de la República del Paraguay (IVA 10% s/ intereses bancarios)', textStartX, 21.5);

  // Top Right Protocol & Metadata
  doc.setFontSize(7.5);
  doc.text(`Protocolo: ${codProtocolo}`, pageWidth - 14, 10, { align: 'right' });
  doc.text(`Fecha y Hora: ${fechaStr}`, pageWidth - 14, 15, { align: 'right' });
  doc.text(`Asesor Comercial: ${simulacion.vendedor_nombre || 'Asesor Cotripar'}`, pageWidth - 14, 20, { align: 'right' });

  // Reset text color to dark slate
  doc.setTextColor(30, 41, 59);

  let currentY = 34;

  // Box 1: Client and Parameters Grid
  doc.setFillColor(254, 252, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, currentY, pageWidth - 28, 35, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(200, 16, 46); // Cotripar Red
  doc.text('1. PARÁMETROS DEL CRÉDITO Y DEL CLIENTE', 18, currentY + 5.5);

  const colLeftLabelX = 18;
  const colLeftValX = 50;
  const colRightLabelX = 108;
  const colRightValX = 144;

  const freqDesc = simulacion.periodicidad === 'semestral'
    ? (simulacion.modalidad_semestral === 'zafra_interes_primero' ? 'Semestral (Zafra)' : 'Semestral (Constante)')
    : 'Anual Estándar';

  // Row 1: Y = currentY + 11.5
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Cliente / Solicitante:', colLeftLabelX, currentY + 11.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  const clienteTxt = (simulacion.cliente_nombre || 'Cliente General').length > 32
    ? (simulacion.cliente_nombre || '').substring(0, 30) + '...'
    : simulacion.cliente_nombre || 'Cliente General';
  doc.text(clienteTxt, colLeftValX, currentY + 11.5);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Entidad Bancaria:', colRightLabelX, currentY + 11.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(simulacion.banco_entidad || 'Banco Comercial', colRightValX, currentY + 11.5);

  // Row 2: Y = currentY + 17
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('RUC / C.I.:', colLeftLabelX, currentY + 17);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(simulacion.cliente_ruc || 'N/A', colLeftValX, currentY + 17);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Tasa Nominal Anual:', colRightLabelX, currentY + 17);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(formatPercent(simulacion.tasa_anual), colRightValX, currentY + 17);

  // Row 3: Y = currentY + 22.5
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Máquina / Implemento:', colLeftLabelX, currentY + 22.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(200, 16, 46); // Cotripar Red for highlight
  const maquinaTxt = (simulacion.maquina_implemento || 'Equipo Cotizado').length > 32
    ? (simulacion.maquina_implemento || '').substring(0, 30) + '...'
    : simulacion.maquina_implemento || 'Equipo Cotizado';
  doc.text(maquinaTxt, colLeftValX, currentY + 22.5);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Plazo / Periodicidad:', colRightLabelX, currentY + 22.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`${simulacion.plazo_anios} años • ${freqDesc}`, colRightValX, currentY + 22.5);

  // Row 4: Y = currentY + 28
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Capital Solicitado:', colLeftLabelX, currentY + 28);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`${formatUSD(simulacion.capital_usd)} (Adm: ${formatUSD(simulacion.gasto_admin_usd)})`, colLeftValX, currentY + 28);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Mayor Cuota Año 1:', colRightLabelX, currentY + 28);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(200, 16, 46);
  doc.text(formatUSD(simulacion.mayor_cuota_anio1_usd), colRightValX, currentY + 28);

  currentY += 39;

  // Box 2: Financial Summary KPI Cards (4 columns)
  const kpiBoxHeight = 16;
  const kpiBoxWidth = (pageWidth - 28 - 9) / 4;

  const kpis = [
    { label: 'TOTAL INTERESES', val: formatUSD(resultado.totalIntereses), color: [15, 23, 42] },
    { label: 'TOTAL IVA (10%)', val: formatUSD(resultado.totalIva), color: [15, 23, 42] },
    { label: 'COSTO FINANCIERO (CFT)', val: formatUSD(resultado.costoFinancieroTotal), color: [180, 83, 9] },
    { label: 'TOTAL A PAGAR', val: formatUSD(resultado.totalPagado), color: [200, 16, 46] }
  ];

  kpis.forEach((kpi, idx) => {
    const boxX = 14 + idx * (kpiBoxWidth + 3);
    doc.setFillColor(250, 250, 250);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(boxX, currentY, kpiBoxWidth, kpiBoxHeight, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.label, boxX + kpiBoxWidth / 2, currentY + 5.5, { align: 'center' });

    doc.setFontSize(8.5);
    doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    doc.text(kpi.val, boxX + kpiBoxWidth / 2, currentY + 12, { align: 'center' });
  });

  currentY += kpiBoxHeight + 5;

  // Section 3: Detailed Schedule Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(200, 16, 46); // Cotripar Red
  doc.text('2. CRONOGRAMA DE CUOTAS DECRECIENTES (SISTEMA ALEMÁN)', 14, currentY);

  const tableData = resultado.cronograma.map(c => [
    c.label,
    formatUSD(c.saldoInicial),
    formatUSD(c.amortizacion),
    formatUSD(c.interes),
    formatUSD(c.iva),
    formatUSD(c.cuota),
    formatUSD(c.saldoFinal)
  ]);

  // Add TOTALES row at the end of the table
  tableData.push([
    'TOTALES',
    '-',
    formatUSD(resultado.capital),
    formatUSD(resultado.totalIntereses),
    formatUSD(resultado.totalIva),
    formatUSD(resultado.totalCuotas),
    '$ 0'
  ]);

  autoTable(doc, {
    startY: currentY + 2.5,
    head: [['Período', 'Saldo Inicial', 'Amortización', 'Interés', 'IVA (10%)', 'Cuota Total', 'Saldo Final']],
    body: tableData,
    theme: 'grid',
    styles: {
      fontSize: 7,
      cellPadding: 1.6,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.15,
      halign: 'right'
    },
    columnStyles: {
      0: { halign: 'left', fontStyle: 'bold', cellWidth: 32 },
      5: { fontStyle: 'bold', textColor: [200, 16, 46] }
    },
    headStyles: {
      fillColor: [200, 16, 46], // Cotripar Red
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 7.2
    },
    alternateRowStyles: {
      fillColor: [252, 252, 252]
    },
    didParseCell: (data) => {
      // Style the TOTALES row
      if (data.section === 'body' && data.row.index === tableData.length - 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [241, 245, 249];
        if (data.column.index === 5) {
          data.cell.styles.textColor = [200, 16, 46];
        }
      }
      // Highlight row with mayor cuota ano 1
      if (data.section === 'body' && data.row.index < resultado.cronograma.length) {
        const rowPeriodo = resultado.cronograma[data.row.index];
        if (rowPeriodo && rowPeriodo.anio === 1 && Math.abs(rowPeriodo.cuota - resultado.cuotaMayorAnio1) < 0.5) {
          data.cell.styles.fillColor = [254, 242, 242]; // soft red tint
          if (data.column.index === 5) {
            data.cell.styles.textColor = [200, 16, 46];
          }
        }
      }
    },
    margin: { left: 14, right: 14 }
  });

  let postTableY = (doc as any).lastAutoTable.finalY + 4;

  // Check page overflow
  if (postTableY > pageHeight - 48) {
    doc.addPage();
    postTableY = 20;
  }

  // Section 4: Mandatory Legal Disclaimer Box
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(200, 16, 46);
  doc.setLineWidth(0.3);
  doc.roundedRect(14, postTableY, pageWidth - 28, 22, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(200, 16, 46);
  doc.text('AVISO LEGAL IMPORTANTE:', 17, postTableY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(71, 85, 105);

  const avisoLegalTexto =
    'Los cálculos, tasas y valores de cuotas expuestos en este documento son únicamente referenciales y aproximados, teniendo en cuenta un promedio estimado de gastos administrativos del sistema financiero e impuestos vigentes (IVA 10% sobre intereses). Esta proyección no constituye una oferta de crédito vinculante y está sujeta a evaluación y aprobación crediticia por parte de la entidad financiera correspondiente.';

  const splitTexto = doc.splitTextToSize(avisoLegalTexto, pageWidth - 34);
  doc.text(splitTexto, 17, postTableY + 9.5);

  // Footer of A4 page with APP_VERSION
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Cotripar S.A. • RUC: 80019076-9 • Valores expresados en Dólares Americanos (USD) • Sistema SAC ${APP_VERSION}`,
    pageWidth / 2,
    pageHeight - 7,
    { align: 'center' }
  );

  return doc;
}
