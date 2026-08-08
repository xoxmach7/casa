export interface FixationPdfData {
  fixationId: string;
  statusLabel: string;
  createdAt: string; // ISO
  expiresAt: string | null; // ISO
  brokerName: string;
  brokerPhone: string;
  clientName: string;
  clientPhone: string;
  projectName: string;
  apartmentNumber: string;
  paymentMethodLabel: string;
  dealAmount: number;
}

export async function generateFixationSheetPdf(data: FixationPdfData) {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');
  const { registerCyrillicFont } = await import('./pdf-fonts');

  const doc = new jsPDF();
  registerCyrillicFont(doc);

  doc.setFontSize(14);
  doc.text(`Лист фиксации №${data.fixationId}`, 14, 18);
  doc.setFontSize(10);
  doc.text(`Статус: ${data.statusLabel}`, 14, 25);
  doc.text(
    `Действителен до: ${data.expiresAt ? new Date(data.expiresAt).toLocaleString('ru-RU') : '—'}`,
    14,
    31
  );

  let y = 40;
  const section = (title: string, rows: [string, string][]) => {
    doc.setFontSize(11);
    doc.text(title, 14, y);
    autoTable(doc, {
      body: rows,
      startY: y + 3,
      theme: 'plain',
      styles: { font: 'Roboto', fontSize: 9, cellPadding: 1.5 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 55 } },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  };

  section('Партнёр', [
    ['Агентство', 'CASA Pro'],
    ['Агент', data.brokerName],
    ['Телефон', data.brokerPhone],
    ['Дата', new Date(data.createdAt).toLocaleDateString('ru-RU')],
  ]);

  section('Клиент', [
    ['ФИО', data.clientName],
    ['Телефон', data.clientPhone],
  ]);

  section('Интерес клиента', [
    ['ЖК', data.projectName],
    ['Квартира', data.apartmentNumber],
    ['Способ оплаты', data.paymentMethodLabel],
    ['Сумма ДДУ', `${data.dealAmount.toLocaleString('ru-RU')} ₸`],
  ]);

  doc.setFontSize(9);
  doc.setTextColor(150);
  doc.text('Специалист застройщика — заполняется вручную', 14, y);

  doc.save(`Fixation-${data.fixationId}.pdf`);
}
