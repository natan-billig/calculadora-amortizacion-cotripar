import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { APP_VERSION, type ItemMaquinaria } from '../types';
import { formatUSD } from './calculatorEngine';

export interface CartaOfertaPayload {
  numeroOferta: string; // Ej: OF-2026-1042
  fechaEmision: string; // Ej: 14 de Octubre de 2026
  validezOferta: string; // Ej: 20 días calendario
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
  // Lista detallada de equipos (V.1.7)
  items?: ItemMaquinaria[];
  // Parámetros del crédito / simulación
  plazoAnios: number;
  periodicidad: string;
  modalidadSemestral?: string | null;
  tasaAnual: number;
  gastoAdminUSD: number;
  mayorCuotaAnio1USD: number;
  totalPagadoUSD: number;
  // Financiación Cotripar & Marcas (V.1.9 & V.2.3)
  tipoFinanciacion?: string;
  mesColocacion?: string;
  fechaTopeVencimiento?: string;
  plazoMeses?: number;
  tasaMensual?: number;
  fechasCuotas?: string[];
  fechaUltimaCuota?: string;
  cantidadCuotas?: number;
}

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

export function calculateExpirationDate(fechaEmisionStr?: string, daysToAdd: number = 20): string {
  let baseDate = new Date();
  if (fechaEmisionStr) {
    const match = fechaEmisionStr.match(/(\d{1,2})\s+de\s+([A-Za-z]+)\s+de\s+(\d{4})/i);
    if (match) {
      const day = parseInt(match[1], 10);
      const monthName = match[2].toLowerCase();
      const year = parseInt(match[3], 10);
      const mesesMap: Record<string, number> = {
        enero: 0,
        febrero: 1,
        marzo: 2,
        abril: 3,
        mayo: 4,
        junio: 5,
        julio: 6,
        agosto: 7,
        setiembre: 8,
        septiembre: 8,
        octubre: 9,
        noviembre: 10,
        diciembre: 11
      };
      if (mesesMap[monthName] !== undefined) {
        baseDate = new Date(year, mesesMap[monthName], day);
      }
    } else {
      const parsed = new Date(fechaEmisionStr);
      if (!isNaN(parsed.getTime())) {
        baseDate = parsed;
      }
    }
  }

  const expDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + daysToAdd);
  const dd = String(expDate.getDate()).padStart(2, '0');
  const mm = String(expDate.getMonth() + 1).padStart(2, '0');
  const yyyy = expDate.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
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

  const bancoEntidadLimpio = (data.bancoEntidad || '').trim();
  if (!bancoEntidadLimpio || bancoEntidadLimpio.toUpperCase().includes('COTRIPAR')) {
    throw new Error('La Carta de Oferta Comercial solo puede ser emitida para una entidad bancaria válida (no aplicable a Cotripar).');
  }

  // 1. CABEÇALHO INSTITUCIONAL SUPERIOR (TOPO DA PÁGINA A4)
  // Faixa Superior Vermelha Cotripar (#C8102E -> RGB: 200, 16, 46)
  doc.setFillColor(200, 16, 46);
  doc.rect(0, 0, pageWidth, 35, 'F');

  // Faixa de Acento Vermelho Escuro (#991B1B -> RGB: 153, 27, 27)
  doc.setFillColor(153, 27, 27);
  doc.rect(0, 35, pageWidth, 1.5, 'F');

  // Carregar logotipos em paralelo
  const [logoTopo, logoMarcas] = await Promise.all([
    getImageBase64(['/logo_branco_topo.png', '/logo_topo.png', '/logo_branco.png'], 3.455),
    getImageBase64(['/logo_branco_marcas.png', '/logo_marcas.png'], 18.688)
  ]);

  // ZONA SUPERIOR DO CABEÇALHO (y = 4.5mm a 23mm)
  const leftX = marginX;
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

  // Cálculo de Fecha de Vencimiento (+20 días)
  const fechaVencimiento = calculateExpirationDate(data.fechaEmision, 20);

  // Quadro de Identificação da Oferta (Direita)
  const rightColX = pageWidth - marginX;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text('CARTA DE OFERTA COMERCIAL', rightColX, 8.5, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.0);
  doc.text(`OFERTA Nº: ${data.numeroOferta}`, rightColX, 13.0, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.text(`FECHA: ${data.fechaEmision}`, rightColX, 17.0, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.text(`VALIDEZ: 20 días calendario (Vence: ${fechaVencimiento})`, rightColX, 21.0, { align: 'right' });

  // ZONA INFERIOR DO CABEÇALHO — FAIXA DE MARCAS OFICIAIS (y = 24.5mm a 34.5mm)
  doc.setDrawColor(220, 38, 38);
  doc.setLineWidth(0.2);
  doc.line(marginX, 24.5, pageWidth - marginX, 24.5);

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

  // 2. QUADRO DE DADOS DO CLIENTE E BANCO DESTINATÁRIO
  const clientBoxHeight = 25;
  doc.setFillColor(248, 250, 252); // Slate-50
  doc.setDrawColor(226, 232, 240); // Slate-200
  doc.roundedRect(marginX, currentY, contentWidth, clientBoxHeight, 1.5, 1.5, 'FD');

  // Borda lateral esquerda destacada em Vermelho Cotripar
  doc.setFillColor(200, 16, 46);
  doc.rect(marginX, currentY, 2, clientBoxHeight, 'F');

  // Coluna Esquerda: Dados do Cliente
  const cLeftX = marginX + 6;
  const cLeftValX = cLeftX + 32;
  const maxLeftValW = 54; // Largura máxima segura para que o texto da esquerda NUNCA encoste na coluna direita (cRightX = marginX + 96 = 110)

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('CLIENTE / SOLICITANTE:', cLeftX, currentY + 6);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  const clienteLines = doc.splitTextToSize(data.clienteNombre || 'Cliente General', maxLeftValW);
  doc.text(clienteLines[0], cLeftValX, currentY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('RUC / C.I.:', cLeftX, currentY + 11.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(data.clienteRuc || 'N/A', cLeftValX, currentY + 11.5);

  // Linha opcional de Contato ou Localização com quebra automática segura
  if (data.atencionContacto?.trim() || data.ubicacion?.trim()) {
    const extraLabel = data.atencionContacto?.trim() ? 'ATENCIÓN / CONTACTO:' : 'UBICACIÓN / CIUDAD:';
    const extraVal = data.atencionContacto?.trim() || data.ubicacion?.trim() || '';
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(extraLabel, cLeftX, currentY + 17);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    // Limite de largura máxima segura com splitTextToSize para NUNCA encostar na coluna da direita
    const extraLines = doc.splitTextToSize(extraVal, maxLeftValW);
    doc.text(extraLines, cLeftValX, currentY + 17);
  }

  // Coluna Direita: Dados da Entidade Financeira
  const cRightX = marginX + 96;
  const cRightValX = cRightX + 34;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('ENTIDAD FINANCIERA:', cRightX, currentY + 6);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  const entidadTxt = (data.bancoEntidad && !data.bancoEntidad.toUpperCase().includes('COTRIPAR'))
    ? data.bancoEntidad
    : 'Banco Comercial (Oficial)';
  doc.text(entidadTxt, cRightValX, currentY + 6);

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

  const hasItemsList = Boolean(data.items && data.items.length > 0);

  let subtotal = 0;
  let tableBody: string[][] = [];

  if (hasItemsList) {
    subtotal = data.items!.reduce(
      (sum, it) => sum + (Number(it.cantidad) || 1) * (Number(it.precioUnitarioUSD) || 0),
      0
    );

    tableBody = data.items!.map((it, idx) => {
      const itemNum = String(idx + 1).padStart(2, '0');
      const itemCant = Number(it.cantidad) > 0 ? Number(it.cantidad) : 1;
      const unitPrice = Number(it.precioUnitarioUSD) || 0;
      const itemTotal = itemCant * unitPrice;

      let itemDesc = `${it.marca ? `[${it.marca}] ` : ''}${it.descripcion.trim() || 'Equipamiento Agrícola Cotripar'}`;
      if (data.items!.length === 1 && data.especificacionTecnica?.trim()) {
        itemDesc += `\n${data.especificacionTecnica.trim()}`;
      }

      return [
        itemNum,
        itemDesc,
        itemCant.toString(),
        formatUSD(unitPrice),
        formatUSD(itemTotal)
      ];
    });
  } else {
    const cantidad = data.cantidad > 0 ? data.cantidad : 1;
    const precioUnitario = data.precioTotalUSD / cantidad;
    subtotal = data.precioTotalUSD;

    const descCompleta = data.especificacionTecnica?.trim()
      ? `${data.maquinaImplemento}\n${data.especificacionTecnica.trim()}`
      : `${data.maquinaImplemento}\nEquipamiento agrícola oficial con garantía y soporte integral de Cotripar S.A.`;

    tableBody = [
      [
        '01',
        descCompleta,
        cantidad.toString(),
        formatUSD(precioUnitario),
        formatUSD(subtotal)
      ]
    ];
  }

  const anticipo = data.anticipoUSD && data.anticipoUSD > 0 ? data.anticipoUSD : 0;
  const totalAFinanciar = Math.max(0, subtotal - anticipo);

  autoTable(doc, {
    startY: currentY,
    margin: { left: marginX, right: marginX },
    head: [['Ítem', 'Descripción del Equipo / Máquina o Implemento', 'Cant.', 'Precio Unit. (USD)', 'Precio Total (USD)']],
    body: tableBody,
    theme: 'plain',
    headStyles: {
      fillColor: [200, 16, 46],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.2,
      cellPadding: 2.0
    },
    columnStyles: {
      0: { cellWidth: 14, halign: 'center' },
      1: { cellWidth: 92, halign: 'left' },
      2: { cellWidth: 16, halign: 'center' },
      3: { cellWidth: 30, halign: 'right' },
      4: { cellWidth: 30, halign: 'right' }
    },
    styles: {
      fontSize: 7.0,
      textColor: [30, 41, 59],
      cellPadding: 2.0,
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
    doc.text('Subtotal Equipamientos (USD):', totalsBoxX, currentY);
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
  doc.text('VALOR TOTAL A FINANCIAR (IVA Inc.):', totalsBoxX, currentY + 4.5);
  doc.setFontSize(8.5);
  doc.text(formatUSD(totalAFinanciar), pageWidth - marginX - 2, currentY + 4.8, { align: 'right' });

  currentY += barHeight + 5;

  // 5. SEÇÃO 2 — CONDICIONES COMERCIALES, FINANCIACIÓN Y GARANTÍA (Grid 2x2)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(200, 16, 46);
  doc.text('2. CONDICIONES COMERCIALES, FINANCIACIÓN Y GARANTÍA', marginX, currentY);

  currentY += 3.5;

  const gridGap = 4;
  const boxW = (contentWidth - gridGap) / 2; // ~89mm

  // Box A (Financiación) & Box B (Entrega)
  const boxAHeight = 28;
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
  doc.text(
    'Condiciones de Financiación Bancaria (Ref.)',
    boxAX + 3.5,
    currentY + 4.5
  );

  doc.setFontSize(6.2);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  const freqTexto = data.periodicidad === 'semestral'
    ? (data.modalidadSemestral === 'zafra_interes_primero' ? 'Semestral (Zafra)' : 'Semestral (Constante)')
    : 'Anual Estándar';

  const bancoFinal = (data.bancoEntidad && !data.bancoEntidad.toUpperCase().includes('COTRIPAR'))
    ? data.bancoEntidad
    : 'Banco Comercial (Oficial)';

  const finLines = [
    `• Entidad Financiera: ${bancoFinal}`,
    `• Capital a Financiar: ${formatUSD(totalAFinanciar)}${anticipo > 0 ? ' (Neto de Anticipo)' : ''}`,
    `• Plazo y Periodicidad: ${Math.abs(Number(data.plazoAnios) - 1.5) < 0.05 ? '18 Meses' : `${data.plazoAnios} ${Number(data.plazoAnios) === 1 ? 'Año' : 'Años'}`} (${freqTexto})`,
    `• Cuota Referencial (Año 1): ${formatUSD(data.mayorCuotaAnio1USD)}`
  ];
  finLines.forEach((l, idx) => {
    doc.text(l, boxAX + 3.5, currentY + 8.8 + idx * 4.2);
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
  doc.text('Validez, Plazo y Condiciones de Entrega', boxBX + 3.5, currentY + 4.5);

  doc.setFontSize(6.2);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  const entLines = [
    `• Validez: 20 días calendario (Vence: ${fechaVencimiento}).`,
    `• Entrega sujeta a aprobación crediticia y desembolso por parte de la entidad financiera (${data.bancoEntidad || 'el Banco'}).`,
    '• Lugar de entrega: Puesto en estancia / establecimiento del cliente según acuerdo comercial.'
  ];
  let entY = currentY + 8.8;
  entLines.forEach((l) => {
    const split = doc.splitTextToSize(l, boxW - 6);
    doc.text(split, boxBX + 3.5, entY);
    entY += split.length * 3.2 + 1.2;
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

  currentY += 11;

  // Linha de Assinatura Centralizada
  const sigLineWidth = 75;
  const sigLineX = (pageWidth - sigLineWidth) / 2;
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.3);
  doc.line(sigLineX, currentY, sigLineX + sigLineWidth, currentY);

  currentY += 3.8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(data.vendedorNombre || 'Asesor Comercial Cotripar', pageWidth / 2, currentY, { align: 'center' });

  currentY += 3.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(100, 116, 139);
  doc.text('COMERCIO DE TRACTORES E IMPLEMENTOS DEL PARAGUAY (COTRIPAR) S.A.', pageWidth / 2, currentY, { align: 'center' });
  doc.text('RUC: 80019076-9 • Paraguay', pageWidth / 2, currentY + 3.2, { align: 'center' });

  // 7. AVISO LEGAL DE RODAPÉ (UMA ÚNICA PÁGINA PERFEITA)
  const footerY = pageHeight - 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `COMERCIO DE TRACTORES E IMPLEMENTOS DEL PARAGUAY (COTRIPAR) S.A. • RUC: 80019076-9 • Sistema Cotripar SAC ${APP_VERSION}`,
    pageWidth / 2,
    footerY,
    { align: 'center' }
  );

  return doc;
}
