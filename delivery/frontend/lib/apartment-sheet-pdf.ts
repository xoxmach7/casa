/**
 * Квартирный лист — одностраничный PDF по конкретной квартире, который брокер
 * отдаёт клиенту после показа.
 *
 * Сделан тем же способом, что и лист фиксации ([[fixation-pdf]]): jsPDF с
 * встроенным кириллическим Roboto, потому что штатные шрифты jsPDF кириллицу
 * не рисуют. Знака ₸ в подключённом сабсете нет — валюта пишется словом «тг.»,
 * иначе в PDF получается пустой квадрат.
 */

export interface ApartmentSheetData {
  projectName: string;
  projectCity?: string;
  projectAddress?: string;
  number: string;
  floor: number;
  rooms: number;
  /** Строки как в каталоге — форматируем, но не пересчитываем. */
  area: string;
  price: string;
  statusLabel: string;
  layoutImage?: string;
  agentName?: string;
  agentPhone?: string;
}

const money = (n: number) => `${Math.round(n).toLocaleString('ru-RU')} тг.`;

/**
 * Планировка в PDF нужна, но она не обязана быть: картинка может лежать на
 * другом домене без CORS или просто не открыться. Тогда лист печатается без
 * неё — это лучше, чем упасть и не отдать клиенту ничего.
 */
async function loadImage(url: string): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) return null;
    const blob = await res.blob();
    const data = await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
    const size = await new Promise<{ w: number; h: number }>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = reject;
      img.src = data;
    });
    return { data, ...size };
  } catch {
    return null;
  }
}

export async function generateApartmentSheetPdf(data: ApartmentSheetData) {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');
  const { registerCyrillicFont } = await import('./pdf-fonts');

  const doc = new jsPDF();
  registerCyrillicFont(doc);

  const price = parseFloat(data.price) || 0;
  const area = parseFloat(data.area) || 0;

  doc.setFontSize(16);
  doc.text(`Квартира №${data.number}`, 14, 18);

  doc.setFontSize(11);
  doc.text(data.projectName, 14, 26);
  const place = [data.projectAddress, data.projectCity].filter(Boolean).join(', ');
  if (place) {
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(place, 14, 32);
    doc.setTextColor(0);
  }

  let y = place ? 40 : 34;

  const layout = data.layoutImage ? await loadImage(data.layoutImage) : null;
  if (layout) {
    const maxW = 90;
    const maxH = 70;
    const scale = Math.min(maxW / layout.w, maxH / layout.h);
    const w = layout.w * scale;
    const h = layout.h * scale;
    try {
      doc.addImage(layout.data, 14, y, w, h);
      y += h + 8;
    } catch {
      // Формат, который jsPDF не принимает, — лист печатается без планировки.
    }
  }

  doc.setFontSize(11);
  doc.text('Параметры', 14, y);
  autoTable(doc, {
    body: [
      ['Комнат', String(data.rooms)],
      ['Этаж', String(data.floor)],
      ['Площадь', `${data.area} м2`],
      ['Цена', money(price)],
      ['Цена за м2', area > 0 ? money(price / area) : '—'],
      ['Статус', data.statusLabel],
    ] as [string, string][],
    startY: y + 3,
    theme: 'plain',
    styles: { font: 'Roboto', fontSize: 10, cellPadding: 1.8 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 45 } },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  if (data.agentName || data.agentPhone) {
    doc.setFontSize(11);
    doc.text('Ваш агент', 14, y);
    autoTable(doc, {
      body: [
        ['Агентство', 'CASA Pro'],
        ['Агент', data.agentName || '—'],
        ['Телефон', data.agentPhone || '—'],
      ] as [string, string][],
      startY: y + 3,
      theme: 'plain',
      styles: { font: 'Roboto', fontSize: 10, cellPadding: 1.8 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 45 } },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(
    `Цена и статус актуальны на ${new Date().toLocaleDateString('ru-RU')} и не являются публичной офертой.`,
    14,
    Math.min(y, 280),
  );

  doc.save(`Kvartira-${data.number}.pdf`);
}
