import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ResultadoAleman, SimulacionPDF } from '../types';
import { formatUSD, formatPercent } from './calculatorEngine';

export function generarPDFSimulacion(
  simulacion: SimulacionPDF,
  resultado: ResultadoAleman
) {
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

  // Header Background Bar (Cotripar Green)
  doc.setFillColor(21, 128, 61); // #15803d
  doc.rect(0, 0, pageWidth, 28, 'F');

  // Accent Gold Line
  doc.setFillColor(234, 179, 8); // #eab308
  doc.rect(0, 28, pageWidth, 2, 'F');

  // Header Title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('COTRIPAR S.A. — DIVISIÓN FINANCIERA', 14, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text('SIMULACIÓN DE AMORTIZACIÓN BANCARIA | SISTEMA ALEMÁN', 14, 18);
  doc.text('Moneda Oficial: USD ($) • Régimen Tributario de la República del Paraguay (IVA 10%)', 14, 23);

  // Top Right Protocol & Date
  doc.setFontSize(7.5);
  doc.text(`Protocolo: ${codProtocolo}`, pageWidth - 14, 12, { align: 'right' });
  doc.text(`Fecha: ${fechaStr}`, pageWidth - 14, 17, { align: 'right' });
  doc.text(`Asesor: ${simulacion.vendedor_nombre || 'Asesor Comercial'}`, pageWidth - 14, 22, { align: 'right' });

  // Reset text color
  doc.setTextColor(30, 41, 59);

  let currentY = 36;

  // Box: Client and Financing Details
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, currentY, pageWidth - 28, 30, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(21, 128, 61);
  doc.text('1. PARÁMETROS DEL CLIENTE Y OPERACIÓN CREDITICIA', 18, currentY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);

  const col1X = 18;
  const col2X = 80;
  const col3X = 142;

  // Row 1
  doc.text('Cliente / Razón Social:', col1X, currentY + 12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(simulacion.cliente_nombre || 'Cliente General', col1X + 32, currentY + 12);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Entidad Bancaria:', col2X, currentY + 12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(simulacion.banco_entidad || 'Banco Comercial', col2X + 26, currentY + 12);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Capital Solicitado:', col3X, currentY + 12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(21, 128, 61);
  doc.text(formatUSD(simulacion.capital_usd), col3X + 26, currentY + 12);

  // Row 2
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('RUC / Documento:', col1X, currentY + 18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(simulacion.cliente_ruc || 'S/D', col1X + 32, currentY + 18);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Tasa Anual:', col2X, currentY + 18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(formatPercent(simulacion.tasa_anual), col2X + 26, currentY + 18);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Gasto Admin. (1%):', col3X, currentY + 18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(formatUSD(simulacion.gasto_admin_usd), col3X + 26, currentY + 18);

  // Row 3
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Plazo del Crédito:', col1X, currentY + 24);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`${simulacion.plazo_anios} años`, col1X + 32, currentY + 24);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Modalidad:', col2X, currentY + 24);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  const freqDesc = simulacion.periodicidad === 'semestral'
    ? (simulacion.modalidad_semestral === 'zafra_interes_primero' ? 'Semestral (Zafra)' : 'Semestral (Constante)')
    : 'Anual Estándar';
  doc.text(freqDesc, col2X + 26, currentY + 24);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Mayor Cuota Año 1:', col3X, currentY + 24);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(180, 83, 9); // amber 700
  doc.text(formatUSD(simulacion.mayor_cuota_anio1_usd), col3X + 26, currentY + 24);

  currentY += 34;

  // Section 2: Amortization Schedule Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(21, 128, 61);
  doc.text('2. CRONOGRAMA DE PAGOS (SISTEMA ALEMÁN - CUOTAS DECRECIENTES)', 14, currentY);

  const tableData = resultado.cronograma.map(c => [
    c.label,
    formatUSD(c.saldoInicial),
    formatUSD(c.amortizacion),
    formatUSD(c.interes),
    formatUSD(c.iva),
    formatUSD(c.cuota),
    formatUSD(c.saldoFinal)
  ]);

  autoTable(doc, {
    startY: currentY + 3,
    head: [['Período', 'Saldo Inicial', 'Amortización', 'Interés', 'IVA (10%)', 'Cuota Total', 'Saldo Final']],
    body: tableData,
    theme: 'grid',
    styles: {
      fontSize: 7.2,
      cellPadding: 1.8,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.15,
      halign: 'right'
    },
    columnStyles: {
      0: { halign: 'left', fontStyle: 'bold', cellWidth: 32 },
      5: { fontStyle: 'bold', textColor: [21, 128, 61] } // Cuota column
    },
    headStyles: {
      fillColor: [22, 101, 52], // dark green #166534
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center'
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    didParseCell: (data) => {
      // Highlight the row with cuotaMayorAnio1
      if (data.section === 'body') {
        const rowPeriodo = resultado.cronograma[data.row.index];
        if (rowPeriodo && rowPeriodo.anio === 1 && Math.abs(rowPeriodo.cuota - resultado.cuotaMayorAnio1) < 0.5) {
          data.cell.styles.fillColor = [254, 249, 195]; // soft yellow
          if (data.column.index === 5) {
            data.cell.styles.textColor = [180, 83, 9];
          }
        }
      }
    },
    margin: { left: 14, right: 14 }
  });

  // Position after table
  const finalY = (doc as any).lastAutoTable.finalY + 4;

  // Section 3: Financial Summary Cards
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(21, 128, 61);
  doc.text('3. CONSOLIDADO FINANCIERO DE LA OPERACIÓN', 14, finalY);

  const kpiBoxY = finalY + 3;
  const kpiBoxHeight = 22;
  const kpiBoxWidth = (pageWidth - 28 - 12) / 4; // 4 boxes

  const kpis = [
    { label: 'TOTAL INTERESES', val: formatUSD(resultado.totalIntereses), color: [15, 23, 42] },
    { label: 'TOTAL IVA (10%)', val: formatUSD(resultado.totalIva), color: [15, 23, 42] },
    { label: 'COSTO FINANCIERO TOTAL', val: formatUSD(resultado.costoFinancieroTotal), color: [180, 83, 9] },
    { label: 'TOTAL A PAGAR', val: formatUSD(resultado.totalPagado), color: [21, 128, 61] }
  ];

  kpis.forEach((kpi, idx) => {
    const boxX = 14 + idx * (kpiBoxWidth + 4);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(boxX, kpiBoxY, kpiBoxWidth, kpiBoxHeight, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.label, boxX + kpiBoxWidth / 2, kpiBoxY + 7, { align: 'center' });

    doc.setFontSize(9.5);
    doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    doc.text(kpi.val, boxX + kpiBoxWidth / 2, kpiBoxY + 16, { align: 'center' });
  });

  // Section 4: Observations and Signatures
  let signY = kpiBoxY + kpiBoxHeight + 8;
  if (signY > pageHeight - 45) {
    doc.addPage();
    signY = 25;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(
    'Nota: Esta simulación es referencial y está sujeta a aprobación crediticia del Comité de Riesgo de Cotripar S.A. y de la entidad bancaria interviniente.',
    14,
    signY
  );
  doc.text(
    'El cálculo de amortización se efectúa conforme al Sistema Alemán con cuotas decrecientes e IVA sobre intereses conforme a la Ley Tributaria de Paraguay.',
    14,
    signY + 4
  );

  // Signature lines
  const signLineY = signY + 22;
  const signLineWidth = 50;

  // Asesor Comercial
  doc.setDrawColor(148, 163, 184);
  doc.line(22, signLineY, 22 + signLineWidth, signLineY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);
  doc.text('Asesor Comercial / Cotripar', 22 + signLineWidth / 2, signLineY + 4, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text(simulacion.vendedor_nombre || 'Firma y Sello', 22 + signLineWidth / 2, signLineY + 8, { align: 'center' });

  // Cliente
  const signClientX = 80;
  doc.line(signClientX, signLineY, signClientX + signLineWidth, signLineY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);
  doc.text('Conformidad del Cliente', signClientX + signLineWidth / 2, signLineY + 4, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text(simulacion.cliente_nombre || 'Firma y Aclaración', signClientX + signLineWidth / 2, signLineY + 8, { align: 'center' });

  // Comité de Crédito
  const signComiteX = 138;
  doc.line(signComiteX, signLineY, signComiteX + signLineWidth, signLineY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);
  doc.text('Comité de Crédito / Riesgo', signComiteX + signLineWidth / 2, signLineY + 4, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Aprobación Formal', signComiteX + signLineWidth / 2, signLineY + 8, { align: 'center' });

  // Footer Disclaimer
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    'Cotripar S.A. — Maquinarias, Repuestos y Servicios Agrícolas • Casa Central: Santa Rita, Alto Paraná, Paraguay • www.cotripar.com',
    pageWidth / 2,
    pageHeight - 8,
    { align: 'center' }
  );

  return doc;
}
