import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ResultadoAleman, SimulacionPDF, ItemMaquinaria } from '../types';
import { APP_VERSION } from '../types';
import { formatUSD, formatPercent } from './calculatorEngine';

interface LogoData {
  base64: string;
  ratio: number;
}

async function getImageBase64(paths: string[], defaultRatio: number = 3.455): Promise<LogoData | null> {
  for (const path of paths) {
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
          const r = img.width > 0 && img.height > 0 ? img.width / img.height : defaultRatio;
          resolve(r);
        };
        img.onerror = () => resolve(defaultRatio);
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
  doc.rect(0, 0, pageWidth, 35, 'F');

  // Thin Dark Red Line Accent (#991B1B)
  doc.setFillColor(153, 27, 27);
  doc.rect(0, 35, pageWidth, 1.5, 'F');

  // Load logos in parallel
  const [logoTopo, logoMarcas] = await Promise.all([
    getImageBase64(['/logo_branco_topo.png', '/logo_topo.png', '/logo_branco.png'], 3.455),
    getImageBase64(['/logo_branco_marcas.png', '/logo_marcas.png'], 18.688)
  ]);

  // ZONA SUPERIOR DO CABEÇALHO (y = 4.5mm a 23mm)
  const leftX = 14;
  if (logoTopo) {
    try {
      const targetWidth = 48;
      const targetHeight = targetWidth / (logoTopo.ratio || 3.455);
      doc.addImage(logoTopo.base64, 'PNG', leftX, 4.5, targetWidth, targetHeight);
    } catch {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(255, 255, 255);
      doc.text('GRUPO COTRIPAR', leftX, 12);
    }
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(255, 255, 255);
    doc.text('GRUPO COTRIPAR', leftX, 12);
  }

  // Subtítulo Institucional limpo abaixo da logo
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(255, 255, 255); // Branco suave / destacado
  doc.text('COMERCIO DE TRACTORES E IMPLEMENTOS DEL PARAGUAY (COTRIPAR) S.A. • RUC: 80019076-9', leftX, 22.5);

  // Top Right Protocol & Metadata
  const isCotripar = simulacion.tipo_financiacion === 'F_COTRIPAR' || resultado.tipoFinanciacion === 'F_COTRIPAR' || (simulacion.banco_entidad || '').toUpperCase().includes('COTRIPAR');
  const rightX = pageWidth - 14;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.0);
  doc.setTextColor(255, 255, 255);
  const headerTitle = isCotripar
    ? 'PROFORMA DE CRÉDITO — FINANCIACIÓN COTRIPAR (USD)'
    : 'PROYECCIÓN FINANCIERA — SISTEMA ALEMÁN (USD)';
  doc.text(headerTitle, rightX, 8.5, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(255, 255, 255);
  doc.text(`Protocolo: ${codProtocolo}`, rightX, 12.8, { align: 'right' });
  doc.text(`Fecha y Hora: ${fechaStr}`, rightX, 16.8, { align: 'right' });
  doc.text(`Asesor Comercial: ${simulacion.vendedor_nombre || 'Asesor Cotripar'}`, rightX, 20.8, { align: 'right' });

  // ZONA INFERIOR DO CABEÇALHO — FAIXA DE MARCAS OFICIAIS (y = 24.5mm a 34.5mm)
  doc.setDrawColor(220, 38, 38);
  doc.setLineWidth(0.2);
  doc.line(14, 24.5, pageWidth - 14, 24.5);

  if (logoMarcas) {
    try {
      const marcasWidth = 160;
      const marcasHeight = marcasWidth / (logoMarcas.ratio || 18.688);
      const marcasX = (pageWidth - marcasWidth) / 2;
      doc.addImage(logoMarcas.base64, 'PNG', marcasX, 25.5, marcasWidth, marcasHeight);
    } catch {
      // Ignore
    }
  }

  // Reset text color to dark slate
  doc.setTextColor(30, 41, 59);

  let currentY = 40;

  // Box 1: Client and Parameters Grid (4 rows cleanly aligned in 2 columns)
  const box1Height = 28;
  doc.setFillColor(254, 252, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, currentY, pageWidth - 28, box1Height, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(200, 16, 46); // Cotripar Red
  const box1Title = isCotripar
    ? '1. PARÁMETROS DE FINANCIACIÓN COTRIPAR'
    : '1. PARÁMETROS DEL CRÉDITO Y DEL CLIENTE';
  doc.text(box1Title, 18, currentY + 5.5);

  const colLeftLabelX = 18;
  const colLeftValX = 50;
  const colRightLabelX = 104;
  const colRightValX = 138;

  let fechaUltimaCuota = resultado.fechaUltimaCuota || simulacion.fecha_ultima_cuota;
  if (!fechaUltimaCuota && resultado.cronograma && resultado.cronograma.length > 0) {
    const lastLabel = resultado.cronograma[resultado.cronograma.length - 1].label;
    const match = lastLabel.match(/\(([^)]+)\)/);
    if (match) fechaUltimaCuota = match[1];
  }
  if (!fechaUltimaCuota) {
    fechaUltimaCuota = simulacion.fecha_tope_vencimiento || '20/03/2028';
  }

  const cantidadCuotas = resultado.cantidadCuotas || simulacion.cantidad_cuotas || resultado.cronograma.length;

  const freqDesc = isCotripar
    ? (simulacion.periodicidad === 'semestral_zafra' || simulacion.periodicidad === 'semestral'
        ? 'Semestral / Zafra'
        : (simulacion.periodicidad === 'pago_unico' ? 'Pago Único' : 'Mensual'))
    : (simulacion.periodicidad === 'semestral'
        ? (simulacion.modalidad_semestral === 'zafra_interes_primero' ? 'Semestral (Zafra)' : 'Semestral (Constante)')
        : 'Anual Estándar');

  // Row 1: Y = currentY + 11
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(71, 85, 105);
  doc.text('Cliente / Solicitante:', colLeftLabelX, currentY + 11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  const clienteTxt = (simulacion.cliente_nombre || 'Cliente General').length > 32
    ? (simulacion.cliente_nombre || '').substring(0, 30) + '...'
    : simulacion.cliente_nombre || 'Cliente General';
  doc.text(clienteTxt, colLeftValX, currentY + 11);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(isCotripar ? 'Modalidad / Entidad:' : 'Entidad Bancaria:', colRightLabelX, currentY + 11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(isCotripar ? 'Financiación Cotripar' : (simulacion.banco_entidad || 'Banco Comercial'), colRightValX, currentY + 11);

  // Row 2: Y = currentY + 16
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('RUC / C.I.:', colLeftLabelX, currentY + 16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(simulacion.cliente_ruc || 'N/A', colLeftValX, currentY + 16);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(isCotripar ? 'Tasa de Interés:' : 'Tasa Nominal Anual:', colRightLabelX, currentY + 16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  const tasaDisplay = isCotripar
    ? `${resultado.tasaMensual ? resultado.tasaMensual.toFixed(2) : (simulacion.tasa_anual > 2 ? (simulacion.tasa_anual / 12).toFixed(2) : simulacion.tasa_anual.toFixed(2))}% mensual (+ IVA 10%)`
    : formatPercent(simulacion.tasa_anual);
  doc.text(tasaDisplay, colRightValX, currentY + 16);

  // Row 3: Y = currentY + 21
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Capital Solicitado:', colLeftLabelX, currentY + 21);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(formatUSD(simulacion.capital_usd), colLeftValX, currentY + 21);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(isCotripar ? 'Plazo Total Detectado:' : 'Plazo / Periodicidad:', colRightLabelX, currentY + 21);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  const plazoAniosNum = Number(simulacion.plazo_anios);
  const plazoTexto = Math.abs(plazoAniosNum - 1.5) < 0.05
    ? '18 meses'
    : `${plazoAniosNum} ${plazoAniosNum === 1 ? 'año' : 'años'}`;
  const plazoDesc = isCotripar
    ? `${simulacion.plazo_meses || resultado.plazoMeses || 17} Meses (Según última cuota: ${fechaUltimaCuota})`
    : `${plazoTexto} • ${freqDesc}`;
  doc.text(plazoDesc, colRightValX, currentY + 21);

  // Row 4: Y = currentY + 26
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Gasto Administrativo:', colLeftLabelX, currentY + 26);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  const gastoTxt = isCotripar
    ? '$ 0 (Exento — Financiación Cotripar)'
    : `${formatUSD(simulacion.gasto_admin_usd)} (1% sobre capital)`;
  doc.text(gastoTxt, colLeftValX, currentY + 26);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(isCotripar ? 'Mayor Cuota del Plan:' : 'Mayor Cuota Año 1:', colRightLabelX, currentY + 26);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(200, 16, 46);
  const cuotasDesc = isCotripar
    ? `${formatUSD(simulacion.mayor_cuota_anio1_usd)} (${cantidadCuotas} ${cantidadCuotas === 1 ? 'cuota' : 'cuotas'})`
    : formatUSD(simulacion.mayor_cuota_anio1_usd);
  doc.text(cuotasDesc, colRightValX, currentY + 26);

  currentY += box1Height + 3.5;

  // Box 1.1: EQUIPAMIENTO / MAQUINARIAS COTIZADAS (Sub-tabela completa sem cortes)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.0);
  doc.setTextColor(200, 16, 46);
  doc.text('EQUIPAMIENTO / MAQUINARIAS COTIZADAS', 14, currentY);

  const itemsList: ItemMaquinaria[] =
    simulacion.items_json && simulacion.items_json.length > 0
      ? simulacion.items_json
      : (resultado.items && resultado.items.length > 0
          ? resultado.items
          : [
              {
                id: '1',
                marca: simulacion.marca_producto || '',
                descripcion: simulacion.maquina_implemento || 'Equipamiento Agrícola Cotripar',
                cantidad: 1,
                precioUnitarioUSD: simulacion.capital_usd + (simulacion.anticipo_usd || resultado.anticipoUSD || 0)
              }
            ]);

  const anticipo = (simulacion.anticipo_usd && simulacion.anticipo_usd > 0)
    ? simulacion.anticipo_usd
    : ((resultado.anticipoUSD && resultado.anticipoUSD > 0) ? resultado.anticipoUSD : 0);

  const subtotalEquipos = itemsList.reduce(
    (sum, it) => sum + (Number(it.cantidad) || 1) * (Number(it.precioUnitarioUSD) || 0),
    0
  );
  const capitalNeto = Math.max(0, subtotalEquipos - anticipo);

  const equipTableBody = itemsList.map((it, idx) => {
    const itemNum = String(idx + 1).padStart(2, '0');
    const marca = it.marca?.trim() || simulacion.marca_producto?.trim() || '-';
    const desc = it.descripcion?.trim() || 'Equipamiento Agrícola Cotripar';
    const cant = Number(it.cantidad) > 0 ? Number(it.cantidad) : 1;
    const precioUnit = Number(it.precioUnitarioUSD) || 0;
    const itemSubtotal = cant * precioUnit;
    return [
      itemNum,
      marca,
      desc,
      cant.toString(),
      formatUSD(precioUnit),
      formatUSD(itemSubtotal)
    ];
  });

  autoTable(doc, {
    startY: currentY + 1.8,
    margin: { left: 14, right: 14 },
    head: [['Ítem', 'Marca', 'Descripción del Equipo / Implemento', 'Cant.', 'Precio Unit. (USD)', 'Subtotal (USD)']],
    body: equipTableBody,
    theme: 'grid',
    styles: {
      fontSize: 6.8,
      cellPadding: 1.2,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.15,
      halign: 'right'
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10, fontStyle: 'bold' },
      1: { halign: 'left', cellWidth: 26, fontStyle: 'bold' },
      2: { halign: 'left' },
      3: { halign: 'center', cellWidth: 12 },
      4: { halign: 'right', cellWidth: 26 },
      5: { halign: 'right', cellWidth: 28, fontStyle: 'bold' }
    },
    headStyles: {
      fillColor: [200, 16, 46],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 7.0,
      cellPadding: 1.4
    },
    alternateRowStyles: {
      fillColor: [252, 252, 252]
    }
  });

  currentY = (doc as any).lastAutoTable.finalY + 1.5;

  if (anticipo > 0) {
    doc.setFillColor(254, 242, 242);
    doc.setDrawColor(254, 202, 202);
    doc.roundedRect(14, currentY, pageWidth - 28, 5.2, 1, 1, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(200, 16, 46);
    doc.text(
      `Subtotal Equipos: ${formatUSD(subtotalEquipos)}   |   Entrega Inicial: -${formatUSD(anticipo)}   |   Capital Neto a Financiar: ${formatUSD(capitalNeto)}`,
      pageWidth / 2,
      currentY + 3.6,
      { align: 'center' }
    );
    currentY += 7.2;
  } else {
    currentY += 2;
  }

  // Box 2: Financial Summary KPI Cards (4 columns)
  const kpiBoxHeight = 14;
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
    doc.setFontSize(5.8);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.label, boxX + kpiBoxWidth / 2, currentY + 4.5, { align: 'center' });

    doc.setFontSize(8.0);
    doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    doc.text(kpi.val, boxX + kpiBoxWidth / 2, currentY + 10.5, { align: 'center' });
  });

  currentY += kpiBoxHeight + 4;

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

  const avisoLegalTexto = isCotripar
    ? 'Los cálculos, tasas y valores de cuotas expuestos en esta proforma corresponden al programa oficial de Financiación Cotripar (Ciclo 2026-2028), sujeto a evaluación crediticia por parte de Cotripar S.A. Operación sin gasto administrativo (0% exento) e IVA del 10% aplicado exclusivamente sobre los intereses devengados.'
    : 'Los cálculos, tasas y valores de cuotas expuestos en este documento son únicamente referenciales y aproximados, teniendo en cuenta un promedio estimado de gastos administrativos del sistema financiero e impuestos vigentes (IVA 10% sobre intereses). Esta proyección no constituye una oferta de crédito vinculante y está sujeta a evaluación y aprobación crediticia por parte de la entidad financiera correspondiente.';

  const splitTexto = doc.splitTextToSize(avisoLegalTexto, pageWidth - 34);
  doc.text(splitTexto, 17, postTableY + 9.5);

  // Footer of A4 page with APP_VERSION
  doc.setFontSize(6.2);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `COMERCIO DE TRACTORES E IMPLEMENTOS DEL PARAGUAY (COTRIPAR) S.A. • RUC: 80019076-9 • Valores expresados en Dólares Americanos (USD) • Sistema SAC ${APP_VERSION}`,
    pageWidth / 2,
    pageHeight - 7,
    { align: 'center' }
  );

  return doc;
}

export interface DatosReporteComparativo {
  vendedorNombre: string;
  clienteNombre: string;
  clienteRuc: string;
  maquinaDescripcion: string;
  items: ItemMaquinaria[];
  subtotalEquiposUSD?: number;
  anticipoUSD: number;
  anticipoBancarioUSD?: number;
  anticipoCotriparUSD?: number;
  capitalUSD: number;
  capitalBancarioUSD?: number;
  capitalCotriparUSD?: number;
  bancoNombre: string;
  resultadoBanco: ResultadoAleman;
  resultadoCotripar: ResultadoAleman;
  conclusionTexto: string;
}

export async function generarPDFComparativo(datos: DatosReporteComparativo): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const now = new Date();
  const fechaStr =
    now.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }) +
    ' ' +
    now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

  const codProtocolo = `COT-CMP-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
    now.getDate()
  ).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;

  // Header Background Bar (Cotripar Red: #C8102E -> RGB: 200, 16, 46)
  doc.setFillColor(200, 16, 46);
  doc.rect(0, 0, pageWidth, 35, 'F');

  // Thin Dark Red Line Accent
  doc.setFillColor(153, 27, 27);
  doc.rect(0, 35, pageWidth, 1.5, 'F');

  const [logoTopo, logoMarcas] = await Promise.all([
    getImageBase64(['/logo_branco_topo.png', '/logo_topo.png', '/logo_branco.png'], 3.455),
    getImageBase64(['/logo_branco_marcas.png', '/logo_marcas.png'], 18.688)
  ]);

  const leftX = 14;
  if (logoTopo) {
    try {
      const targetWidth = 48;
      const targetHeight = targetWidth / (logoTopo.ratio || 3.455);
      doc.addImage(logoTopo.base64, 'PNG', leftX, 4.5, targetWidth, targetHeight);
    } catch {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(255, 255, 255);
      doc.text('GRUPO COTRIPAR', leftX, 12);
    }
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(255, 255, 255);
    doc.text('GRUPO COTRIPAR', leftX, 12);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(255, 255, 255);
  doc.text('COMERCIO DE TRACTORES E IMPLEMENTOS DEL PARAGUAY (COTRIPAR) S.A. • RUC: 80019076-9', leftX, 22.5);

  const rightX = pageWidth - 14;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.0);
  doc.setTextColor(255, 255, 255);
  doc.text('COMPARATIVO FINANCIERO — BANCO VS. COTRIPAR (USD)', rightX, 8.5, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.text(`Protocolo: ${codProtocolo}`, rightX, 12.8, { align: 'right' });
  doc.text(`Fecha y Hora: ${fechaStr}`, rightX, 16.8, { align: 'right' });
  doc.text(`Asesor Comercial: ${datos.vendedorNombre || 'Asesor Cotripar'}`, rightX, 20.8, { align: 'right' });

  doc.setDrawColor(220, 38, 38);
  doc.setLineWidth(0.2);
  doc.line(14, 24.5, pageWidth - 14, 24.5);

  if (logoMarcas) {
    try {
      const marcasWidth = 160;
      const marcasHeight = marcasWidth / (logoMarcas.ratio || 18.688);
      const marcasX = (pageWidth - marcasWidth) / 2;
      doc.addImage(logoMarcas.base64, 'PNG', marcasX, 25.5, marcasWidth, marcasHeight);
    } catch {
      // Ignore
    }
  }

  doc.setTextColor(30, 41, 59);
  let currentY = 40;

  const rb = datos.resultadoBanco;
  const rc = datos.resultadoCotripar;

  const subtotalEquiposCalc =
    datos.subtotalEquiposUSD ??
    datos.items.reduce((sum, it) => sum + (Number(it.cantidad) || 1) * (Number(it.precioUnitarioUSD) || 0), 0);

  const anticipoBanco = datos.anticipoBancarioUSD ?? datos.anticipoUSD ?? 0;
  const anticipoCotripar = datos.anticipoCotriparUSD ?? datos.anticipoUSD ?? 0;

  // Box 1: Client and Quote Summary
  const box1Height = 23;
  doc.setFillColor(254, 252, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, currentY, pageWidth - 28, box1Height, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(200, 16, 46);
  doc.text('1. DATOS DEL PRODUCTOR Y OPERACIÓN COTIZADA', 18, currentY + 5.2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.0);
  doc.setTextColor(71, 85, 105);
  doc.text('Cliente / Razón Social:', 18, currentY + 10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text((datos.clienteNombre || 'Cliente General').substring(0, 36), 48, currentY + 10.5);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('RUC / C.I.:', 18, currentY + 15.2);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(datos.clienteRuc || 'N/A', 48, currentY + 15.2);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Valor Total Máquinas:', 18, currentY + 19.8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(formatUSD(subtotalEquiposCalc), 48, currentY + 19.8);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Escenario Banco:', 106, currentY + 10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 118, 110);
  doc.text(`Anticipo: ${formatUSD(anticipoBanco)}  |  Cap. Neto: ${formatUSD(rb.capital)}`, 134, currentY + 10.5);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Escenario Cotripar:', 106, currentY + 15.2);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(200, 16, 46);
  doc.text(`Anticipo: ${formatUSD(anticipoCotripar)}  |  Cap. Neto: ${formatUSD(rc.capital)}`, 134, currentY + 15.2);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Entidad Comparada:', 106, currentY + 19.8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`${datos.bancoNombre} vs. Financiación Cotripar`, 134, currentY + 19.8);

  currentY += box1Height + 3.5;

  // Equipment Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.0);
  doc.setTextColor(200, 16, 46);
  doc.text('EQUIPAMIENTO / MAQUINARIAS COTIZADAS', 14, currentY);

  const equipBody = datos.items.map((it, idx) => {
    const cant = Number(it.cantidad) || 1;
    const unit = Number(it.precioUnitarioUSD) || 0;
    return [
      String(idx + 1).padStart(2, '0'),
      it.marca || 'Cotripar',
      it.descripcion || 'Equipamiento Agrícola',
      String(cant),
      formatUSD(unit),
      formatUSD(cant * unit)
    ];
  });

  autoTable(doc, {
    startY: currentY + 1.8,
    margin: { left: 14, right: 14 },
    head: [['Ítem', 'Marca', 'Descripción del Equipo / Implemento', 'Cant.', 'Precio Unit. (USD)', 'Subtotal (USD)']],
    body: equipBody,
    theme: 'grid',
    styles: {
      fontSize: 6.8,
      cellPadding: 1.2,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.15,
      halign: 'right'
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10, fontStyle: 'bold' },
      1: { halign: 'left', cellWidth: 26, fontStyle: 'bold' },
      2: { halign: 'left' },
      3: { halign: 'center', cellWidth: 12 },
      4: { halign: 'right', cellWidth: 26 },
      5: { halign: 'right', cellWidth: 28, fontStyle: 'bold' }
    },
    headStyles: {
      fillColor: [200, 16, 46],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 7.0
    }
  });

  currentY = (doc as any).lastAutoTable.finalY + 4;

  // Section 2: Side-by-Side Comparison Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(200, 16, 46);
  doc.text('2. COMPARATIVA EJECUTIVA LADO A LADO (BANCO VS. FINANCIACIÓN COTRIPAR)', 14, currentY);

  const plazoBancoTxt =
    Math.abs(rb.plazoAnios - 1.5) < 0.05
      ? '18 Meses (1.5 Años)'
      : `${rb.plazoAnios} ${rb.plazoAnios === 1 ? 'Año (12 Meses)' : `Años (${rb.plazoAnios * 12} Meses)`}`;
  const plazoCotriparTxt = `${rc.plazoMeses || 17} Meses (${rc.cantidadCuotas || rc.cronograma.length} cuotas)`;

  const cuotaPromedioCotripar =
    rc.cronograma.length > 0 ? rc.totalCuotas / rc.cronograma.length : rc.cuotaMayorAnio1;

  const desembolsoTotalBanco = anticipoBanco + rb.totalPagado;
  const desembolsoTotalCotripar = anticipoCotripar + rc.totalPagado;

  const esPlazoExtendido = rb.plazoAnios >= 2;
  const alivioCuota = rc.cuotaMayorAnio1 - rb.cuotaMayorAnio1;
  const porcentajeAlivio = rc.cuotaMayorAnio1 > 0 ? Math.round((alivioCuota / rc.cuotaMayorAnio1) * 100) : 0;

  const diffIntereses = rc.totalIntereses - rb.totalIntereses;
  const diffIva = rc.totalIva - rb.totalIva;
  const diffCFT = rc.costoFinancieroTotal - rb.costoFinancieroTotal;
  const diffTotalFinanciado = rc.totalPagado - rb.totalPagado;
  const diffDesembolsoTotal = desembolsoTotalCotripar - desembolsoTotalBanco;

  const formatDiff = (val: number) => {
    if (Math.abs(val) < 1) return '$ 0 (Igual)';
    if (val > 0) return `Ahorro Banco: ${formatUSD(val)}`;
    return `Menor en Cotripar: ${formatUSD(Math.abs(val))}`;
  };

  const compareRows = [
    ['Valor Total de las Máquinas', formatUSD(subtotalEquiposCalc), formatUSD(subtotalEquiposCalc), 'Mismo Valor Equipos'],
    [
      'Entrega Inicial / Anticipo',
      anticipoBanco > 0 ? `-${formatUSD(anticipoBanco)}` : '$ 0 (Sin anticipo)',
      anticipoCotripar > 0 ? `-${formatUSD(anticipoCotripar)}` : '$ 0 (Sin anticipo)',
      anticipoBanco === anticipoCotripar
        ? 'Mismo Anticipo'
        : `Dif. Anticipo: ${formatUSD(Math.abs(anticipoBanco - anticipoCotripar))}`
    ],
    [
      'Capital Financiado (Saldo Neto)',
      formatUSD(rb.capital),
      formatUSD(rc.capital),
      rb.capital === rc.capital
        ? 'Mismo Capital'
        : `Dif. Capital: ${formatUSD(Math.abs(rb.capital - rc.capital))}`
    ],
    ['Plazo y Estructura', `${plazoBancoTxt} • ${rb.frecuencia === 'semestral' ? 'Semestral' : 'Anual'}`, plazoCotriparTxt, 'Plazo Comparado'],
    [
      'Tasa de Interés Aplicada',
      `${formatPercent(rb.tasaAnual)} Anual`,
      `${(rc.tasaMensual || 0.80).toFixed(2)}% Mensual (${formatPercent(rc.tasaAnual)} Anual)`,
      `${formatPercent(Math.max(0, rc.tasaAnual - rb.tasaAnual))} menor en Banco`
    ],
    [
      'Gasto Administrativo',
      `${formatUSD(rb.gastoAdmin)} (1% s/ capital)`,
      '$ 0 (0% Exento)',
      rb.gastoAdmin > 0 ? `+${formatUSD(rb.gastoAdmin)} en Banco` : '$ 0'
    ],
    ['Total Intereses Proyectados', formatUSD(rb.totalIntereses), formatUSD(rc.totalIntereses), esPlazoExtendido ? 'Plazo Extendido (Banco)' : formatDiff(diffIntereses)],
    ['Total IVA s/ Intereses (10%)', formatUSD(rb.totalIva), formatUSD(rc.totalIva), esPlazoExtendido ? 'Plazo Extendido (Banco)' : formatDiff(diffIva)],
    ['Encargos Financieros (CFT)', formatUSD(rb.costoFinancieroTotal), formatUSD(rc.costoFinancieroTotal), esPlazoExtendido ? 'Plazo Extendido (Banco)' : formatDiff(diffCFT)],
    [
      'Cuota Año 1 / Cuota Máxima',
      `${formatUSD(rb.cuotaMayorAnio1)} (Mayor Año 1)`,
      `${formatUSD(rc.cuotaMayorAnio1)} (Prom: ${formatUSD(cuotaPromedioCotripar)})`,
      alivioCuota > 0
        ? `Alivio Banco: ${formatUSD(alivioCuota)} (-${porcentajeAlivio}%)`
        : '-'
    ],
    ['Total Financiado (Capital + CFT)', formatUSD(rb.totalPagado), formatUSD(rc.totalPagado), esPlazoExtendido ? 'Plazo Extendido (Banco)' : formatDiff(diffTotalFinanciado)],
    esPlazoExtendido
      ? [
          'IMPACTO EN FLUJO DE CAJA',
          `Cuota ${formatUSD(rb.cuotaMayorAnio1)} (${rb.plazoAnios} años)`,
          `Cuota ${formatUSD(rc.cuotaMayorAnio1)} (18 meses)`,
          `Alivio de ${formatUSD(alivioCuota)}/cuota (-${porcentajeAlivio}%)`
        ]
      : [
          'DESEMBOLSO TOTAL (Entrega + Financiado)',
          formatUSD(desembolsoTotalBanco),
          formatUSD(desembolsoTotalCotripar),
          formatDiff(diffDesembolsoTotal)
        ]
  ];

  autoTable(doc, {
    startY: currentY + 2,
    margin: { left: 14, right: 14 },
    head: [
      [
        'Indicador Financiero',
        `Financiación Bancaria (${datos.bancoNombre})`,
        'Financiación Cotripar (Crédito Directo)',
        'Comparativa / Ventaja'
      ]
    ],
    body: compareRows,
    theme: 'grid',
    styles: {
      fontSize: 6.9,
      cellPadding: 1.45,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.15,
      halign: 'right'
    },
    columnStyles: {
      0: { halign: 'left', fontStyle: 'bold', cellWidth: 46 },
      1: { halign: 'right', cellWidth: 45 },
      2: { halign: 'right', cellWidth: 45 },
      3: { halign: 'center', fontStyle: 'bold', cellWidth: 46 }
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 7.2
    },
    didParseCell: (data) => {
      if (
        data.section === 'body' &&
        (data.row.index === 2 || data.row.index === 8 || data.row.index === 10 || data.row.index === 11)
      ) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = data.row.index === 11 ? [254, 242, 242] : [241, 245, 249];
        if (data.column.index === 1) {
          data.cell.styles.textColor = [15, 118, 110];
        } else if (data.column.index === 2) {
          data.cell.styles.textColor = [200, 16, 46];
        }
      }
    }
  });

  currentY = (doc as any).lastAutoTable.finalY + 4.5;

  // Section 3: Recommendation / Commercial Advantage Box
  const splitConclusion = doc.splitTextToSize(datos.conclusionTexto, pageWidth - 36);
  const conclusionBoxH = Math.max(18, splitConclusion.length * 4 + 9);

  doc.setFillColor(236, 253, 245); // emerald-50
  doc.setDrawColor(16, 185, 129); // emerald-500
  doc.setLineWidth(0.35);
  doc.roundedRect(14, currentY, pageWidth - 28, conclusionBoxH, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.0);
  doc.setTextColor(6, 95, 70);
  doc.text('3. CONCLUSIÓN Y RECOMENDACIÓN COMERCIAL AL PRODUCTOR', 18, currentY + 5.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(15, 23, 42);
  doc.text(splitConclusion, 18, currentY + 10.5);

  currentY += conclusionBoxH + 5;

  // Legal Disclaimer Box
  if (currentY > pageHeight - 32) {
    doc.addPage();
    currentY = 20;
  }

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(200, 16, 46);
  doc.setLineWidth(0.3);
  doc.roundedRect(14, currentY, pageWidth - 28, 18, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(200, 16, 46);
  doc.text('AVISO LEGAL IMPORTANTE:', 17, currentY + 4.8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.4);
  doc.setTextColor(71, 85, 105);
  const disclaimer =
    'Este reporte comparativo tiene carácter estrictamente informativo y referencial para análisis financiero del productor. Los montos incluyen IVA del 10% sobre intereses devengados y 1% de gasto administrativo en la modalidad bancaria (0% exento en Financiación Cotripar). Sujeto a evaluación y aprobación crediticia.';
  doc.text(doc.splitTextToSize(disclaimer, pageWidth - 34), 17, currentY + 9);

  // Footer
  doc.setFontSize(6.2);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `COMERCIO DE TRACTORES E IMPLEMENTOS DEL PARAGUAY (COTRIPAR) S.A. • RUC: 80019076-9 • Valores expresados en Dólares Americanos (USD) • Sistema SAC ${APP_VERSION}`,
    pageWidth / 2,
    pageHeight - 7,
    { align: 'center' }
  );

  return doc;
}

