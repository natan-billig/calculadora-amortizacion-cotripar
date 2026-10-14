import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { APP_VERSION } from '../types';
import { formatUSD } from './calculatorEngine';

export interface CartaOfertaPayload {
  numeroOferta: string; // Ej: OF-2026-1042
  fechaEmision: string; // Ej: 14 de Octubre de 2026
  validezOferta: string; // Ej: 15 días calendario
  clienteNombre: string;
  clienteRuc: string;
  vendedorNombre: string;
  bancoEntidad: string;
  maquinaImplemento: string;
  especificacionTecnica?: string;
  cantidad: number;
  precioTotalUSD: number;
  anticipoUSD?: number;
  descuentoUSD?: number;
  ubicacion?: string;
  telefono?: string;
  atencionContacto?: string;
  // Parámetros del crédito / simulación
  plazoAnios: number;
  periodicidad: string;
  modalidadSemestral?: string | null;
  tasaAnual: number;
  gastoAdminUSD: number;
  mayorCuotaAnio1USD: number;
  totalPagadoUSD: number;
}

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

export async function generarPDFCartaOferta(data: CartaOfertaPayload): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const marginX = 14;
  const contentWidth = pageWidth - marginX * 2; // 182mm

  // 1. CABEÇALHO INSTITUCIONAL SUPERIOR (TOPO DA PÁGINA A4)
  // Faixa Superior Vermelha Cotripar (#C8102E -> RGB: 200, 16, 46)
  doc.setFillColor(200, 16, 46);
  doc.rect(0, 0, pageWidth, 26, 'F');

  // Faixa de Acento Vermelho Escuro (#991B1B -> RGB: 153, 27, 27)
  doc.setFillColor(153, 27, 27);
  doc.rect(0, 26, pageWidth, 1.5, 'F');

  // Logotipo Oficial
  const logoData = await getLogoBase64();
  let textStartX = marginX;
  if (logoData) {
    try {
      const targetHeight = 11;
      const targetWidth = Math.min(34, targetHeight * (logoData.ratio || 2.754));
      doc.addImage(logoData.base64, 'PNG', marginX, 7.5, targetWidth, targetHeight);
      textStartX = marginX + targetWidth + 5;
      if (textStartX < 52) textStartX = 52;
    } catch {
      textStartX = marginX;
    }
  }

  // Título e Subtítulo Institucional (Esquerda)
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.5);
  doc.text('COTRIPAR S.A.', textStartX, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('División de Maquinarias e Implementos Agrícolas', textStartX, 16);
  doc.text('RUC: 80019076-9 • Paraguay', textStartX, 20.5);

  // Quadro de Identificação da Oferta (Direita)
  const rightColX = pageWidth - marginX;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('CARTA DE OFERTA COMERCIAL', rightColX, 9.5, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(`OFERTA Nº: ${data.numeroOferta}`, rightColX, 14, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(`Fecha: ${data.fechaEmision}`, rightColX, 18, { align: 'right' });
  doc.text(`Validez: ${data.validezOferta || '15 días calendario'}`, rightColX, 22, { align: 'right' });

  let currentY = 32;

  // 2. QUADRO DE DADOS DO CLIENTE E BANCO DESTINATÁRIO
  const clientBoxHeight = 24;
  doc.setFillColor(248, 250, 252); // Slate-50
  doc.setDrawColor(226, 232, 240); // Slate-200
  doc.roundedRect(marginX, currentY, contentWidth, clientBoxHeight, 1.5, 1.5, 'FD');

  // Borda lateral esquerda destacada em Vermelho Cotripar
  doc.setFillColor(200, 16, 46);
  doc.rect(marginX, currentY, 2, clientBoxHeight, 'F');

  // Coluna Esquerda: Dados do Cliente
  const cLeftX = marginX + 6;
  const cLeftValX = cLeftX + 32;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('CLIENTE / SOLICITANTE:', cLeftX, currentY + 6);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  const clienteTxt = data.clienteNombre.length > 30 ? data.clienteNombre.substring(0, 28) + '...' : data.clienteNombre;
  doc.text(clienteTxt, cLeftValX, currentY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('RUC / C.I.:', cLeftX, currentY + 11.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(data.clienteRuc || 'N/A', cLeftValX, currentY + 11.5);

  // Linha opcional de Contato ou Localização
  if (data.atencionContacto?.trim() || data.ubicacion?.trim()) {
    const extraLabel = data.atencionContacto?.trim() ? 'ATENCIÓN / CONTACTO:' : 'UBICACIÓN / CIUDAD:';
    const extraVal = data.atencionContacto?.trim() || data.ubicacion?.trim() || '';
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(extraLabel, cLeftX, currentY + 17);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    const extraTxt = extraVal.length > 30 ? extraVal.substring(0, 28) + '...' : extraVal;
    doc.text(extraTxt, cLeftValX, currentY + 17);
  }

  // Coluna Direita: Dados da Entidade Financeira
  const cRightX = marginX + 96;
  const cRightValX = cRightX + 34;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('ENTIDAD FINANCIERA:', cRightX, currentY + 6);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(data.bancoEntidad || 'Banco Comercial', cRightValX, currentY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('MODALIDAD CRÉDITO:', cRightX, currentY + 11.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('Financiación Bancaria (SAC)', cRightValX, currentY + 11.5);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('ASESOR COMERCIAL:', cRightX, currentY + 17);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(200, 16, 46);
  doc.text(data.vendedorNombre || 'Cotripar S.A.', cRightValX, currentY + 17);

  currentY += clientBoxHeight + 5;

  // 3. TEXTO DE APRESENTAÇÃO FORMAL
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('Estimado(a) Cliente / Entidad Financiera:', marginX, currentY);

  currentY += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(71, 85, 105);
  const textoPresentacion =
    'De nuestra mayor consideración, por medio de la presente tenemos el agrado de someter a su consideración la siguiente Oferta Comercial para la provisión de maquinaria / implemento agrícola de alta eficiencia operativa, conforme a las especificaciones técnicas y condiciones de financiación bancaria detalladas a continuación:';
  const splitPresentacion = doc.splitTextToSize(textoPresentacion, contentWidth);
  doc.text(splitPresentacion, marginX, currentY);

  currentY += splitPresentacion.length * 3.4 + 3;

  // 4. SEÇÃO 1 — ESPECIFICAÇÃO DE EQUIPAMENTOS E PREÇOS
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(200, 16, 46);
  doc.text('1. ESPECIFICACIÓN DE EQUIPAMIENTO Y PRECIOS (USD)', marginX, currentY);

  currentY += 2;

  const cantidad = data.cantidad > 0 ? data.cantidad : 1;
  const precioUnitario = data.precioTotalUSD / cantidad;
  const subtotal = data.precioTotalUSD;
  const anticipo = data.anticipoUSD && data.anticipoUSD > 0 ? data.anticipoUSD : 0;
  const totalAFinanciar = Math.max(0, subtotal - anticipo);

  const descCompleta = data.especificacionTecnica?.trim()
    ? `${data.maquinaImplemento}\n${data.especificacionTecnica.trim()}`
    : `${data.maquinaImplemento}\nEquipamiento agrícola oficial con garantía y soporte integral de Cotripar S.A.`;

  autoTable(doc, {
    startY: currentY,
    margin: { left: marginX, right: marginX },
    head: [['Ítem', 'Descripción del Equipo / Máquina o Implemento', 'Cant.', 'Precio Unit. (USD)', 'Precio Total (USD)']],
    body: [
      [
        '01',
        descCompleta,
        cantidad.toString(),
        formatUSD(precioUnitario),
        formatUSD(subtotal)
      ]
    ],
    theme: 'plain',
    headStyles: {
      fillColor: [200, 16, 46],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.2,
      halign: 'left',
      cellPadding: 2.2
    },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 96 },
      2: { cellWidth: 14, halign: 'center' },
      3: { cellWidth: 30, halign: 'right' },
      4: { cellWidth: 30, halign: 'right' }
    },
    styles: {
      fontSize: 7.2,
      textColor: [30, 41, 59],
      cellPadding: 2.5,
      lineColor: [226, 232, 240],
      lineWidth: 0.2
    }
  });

  const tableEndPos = (doc as any).lastAutoTable;
  currentY = tableEndPos ? tableEndPos.finalY + 3 : currentY + 22;

  // Quadro de Totais
  const totalsBoxWidth = 84;
  const totalsBoxX = pageWidth - marginX - totalsBoxWidth;

  if (anticipo > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(100, 116, 139);
    doc.text('Subtotal Equipamiento (USD):', totalsBoxX, currentY);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(formatUSD(subtotal), pageWidth - marginX, currentY, { align: 'right' });

    currentY += 4;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Entrega Inicial / Anticipo (USD):', totalsBoxX, currentY);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(200, 16, 46);
    doc.text(`- ${formatUSD(anticipo)}`, pageWidth - marginX, currentY, { align: 'right' });

    currentY += 4.5;
  }

  // Barra de Destaque Total a Financiar (Vermelho Cotripar)
  const barHeight = 7;
  doc.setFillColor(200, 16, 46);
  doc.roundedRect(totalsBoxX - 4, currentY, totalsBoxWidth + 4, barHeight, 1, 1, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text('VALOR A FINANCIAR (IVA Inc.):', totalsBoxX, currentY + 4.5);
  doc.setFontSize(8.5);
  doc.text(formatUSD(totalAFinanciar), pageWidth - marginX - 2, currentY + 4.8, { align: 'right' });

  currentY += barHeight + 6;

  // 5. SEÇÃO 2 — CONDICIONES COMERCIALES, FINANCIACIÓN Y GARANTÍA (Grid 2x2)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(200, 16, 46);
  doc.text('2. CONDICIONES COMERCIALES, FINANCIACIÓN Y GARANTÍA', marginX, currentY);

  currentY += 3.5;

  const gridGap = 4;
  const boxW = (contentWidth - gridGap) / 2; // ~89mm

  // Box A (Financiación) & Box B (Entrega)
  const boxAHeight = 31;
  const boxAX = marginX;
  const boxBX = marginX + boxW + gridGap;

  // Desenhar Box A
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(boxAX, currentY, boxW, boxAHeight, 1.5, 1.5, 'FD');
  doc.setFillColor(200, 16, 46);
  doc.rect(boxAX, currentY, 1.5, boxAHeight, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(200, 16, 46);
  doc.text('Condiciones de Financiación Bancaria (Ref.)', boxAX + 3.5, currentY + 4.5);

  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  const freqTexto =
    data.periodicidad === 'semestral'
      ? data.modalidadSemestral === 'zafra_interes_primero'
        ? 'Semestral (Zafra)'
        : 'Semestral (Constante)'
      : 'Anual Estándar';

  const finLines = [
    `• Entidad: ${data.bancoEntidad || 'Banco Comercial'}`,
    `• Plazo: ${data.plazoAnios} años (${freqTexto})`,
    `• Tasa Nominal Ref.: ${Number(data.tasaAnual).toFixed(2)}% anual (+ IVA 10% s/ int.)`,
    `• Gasto Admin. (1%): ${formatUSD(data.gastoAdminUSD)} | Mayor Cuota Año 1: ${formatUSD(data.mayorCuotaAnio1USD)}`,
    `• Total Proyectado c/ Financiación: ${formatUSD(data.totalPagadoUSD)}`
  ];
  finLines.forEach((l, idx) => {
    doc.text(l, boxAX + 3.5, currentY + 9 + idx * 4.2);
  });

  // Desenhar Box B
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(boxBX, currentY, boxW, boxAHeight, 1.5, 1.5, 'FD');
  doc.setFillColor(200, 16, 46);
  doc.rect(boxBX, currentY, 1.5, boxAHeight, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(200, 16, 46);
  doc.text('Plazo y Condiciones de Entrega', boxBX + 3.5, currentY + 4.5);

  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  const entLines = [
    `• Entrega sujeta a aprobación crediticia y desembolso por parte de la entidad bancaria (${data.bancoEntidad || 'el Banco'}).`,
    '• Lugar de entrega: Puesto en estancia / establecimiento del cliente según acuerdo comercial.',
    '• Disponibilidad: Inmediata según inventario en casa central o sucursales de Cotripar S.A.'
  ];
  let entY = currentY + 9;
  entLines.forEach((l) => {
    const split = doc.splitTextToSize(l, boxW - 6);
    doc.text(split, boxBX + 3.5, entY);
    entY += split.length * 3.4 + 1.2;
  });

  currentY += boxAHeight + 3.5;

  // Box C (Garantía) & Box D (Capacitación)
  const boxCHeight = 25;
  const boxCX = marginX;
  const boxDX = marginX + boxW + gridGap;

  // Desenhar Box C
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(boxCX, currentY, boxW, boxCHeight, 1.5, 1.5, 'FD');
  doc.setFillColor(200, 16, 46);
  doc.rect(boxCX, currentY, 1.5, boxCHeight, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(200, 16, 46);
  doc.text('Garantía y Servicio Técnico Oficial', boxCX + 3.5, currentY + 4.5);

  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  const garLines = [
    '• Garantía oficial de fábrica con respaldo técnico integral de Cotripar S.A. en todo el territorio nacional.',
    '• Stock permanente de repuestos originales y talleres móviles de asistencia en campo.'
  ];
  let garY = currentY + 9;
  garLines.forEach((l) => {
    const split = doc.splitTextToSize(l, boxW - 6);
    doc.text(split, boxCX + 3.5, garY);
    garY += split.length * 3.4 + 1.2;
  });

  // Desenhar Box D
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(boxDX, currentY, boxW, boxCHeight, 1.5, 1.5, 'FD');
  doc.setFillColor(200, 16, 46);
  doc.rect(boxDX, currentY, 1.5, boxCHeight, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(200, 16, 46);
  doc.text('Capacitación y Puesta en Marcha', boxDX + 3.5, currentY + 4.5);

  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  const capLines = [
    '• Incluye entrega técnica e instrucción operativa para operadores y personal del cliente sin costo adicional.',
    '• Calibración y verificación funcional inicial del equipo en campo.'
  ];
  let capY = currentY + 9;
  capLines.forEach((l) => {
    const split = doc.splitTextToSize(l, boxW - 6);
    doc.text(split, boxDX + 3.5, capY);
    capY += split.length * 3.4 + 1.2;
  });

  currentY += boxCHeight + 6;

  // 6. TEXTO DE FECHAMENTO E ASSINATURA
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(71, 85, 105);
  doc.text(
    'Sin otro particular, y a la espera de una respuesta favorable para dar curso a la operación, saludamos muy atentamente.',
    pageWidth / 2,
    currentY,
    { align: 'center' }
  );

  currentY += 14;

  // Linha de Assinatura Centralizada
  const sigLineWidth = 75;
  const sigLineX = (pageWidth - sigLineWidth) / 2;
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.3);
  doc.line(sigLineX, currentY, sigLineX + sigLineWidth, currentY);

  currentY += 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(data.vendedorNombre || 'Asesor Comercial Cotripar', pageWidth / 2, currentY, { align: 'center' });

  currentY += 3.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(100, 116, 139);
  doc.text('División Comercial • Cotripar S.A.', pageWidth / 2, currentY, { align: 'center' });
  doc.text('RUC: 80019076-9 • Paraguay', pageWidth / 2, currentY + 3.2, { align: 'center' });

  // 7. AVISO LEGAL DE RODAPÉ (UMA ÚNICA PÁGINA PERFEITA)
  const footerY = pageHeight - 8;
  doc.setFontSize(6);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Nota: Los valores de financiación bancaria son referenciales y sujetos a la liquidación definitiva de la entidad bancaria. • Sistema Cotripar SAC ${APP_VERSION}`,
    pageWidth / 2,
    footerY,
    { align: 'center' }
  );

  return doc;
}
