import { API_URL } from './api-client';

export async function exportToExcel(endpoint: string, filename: string) {
  const res = await fetch(`${API_URL}/export/${endpoint}?format=xlsx`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Export failed');
  const blob = await res.blob();
  downloadBlob(blob, `${filename}.xlsx`);
}

export async function exportToCsv(endpoint: string, filename: string) {
  const res = await fetch(`${API_URL}/export/${endpoint}?format=csv`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Export failed');
  const blob = await res.blob();
  downloadBlob(blob, `${filename}.csv`);
}

export async function exportToPdf(title: string, headers: string[], rows: string[][]) {
  const { default: jsPDF } = await import('jspdf');
  await import('jspdf-autotable');

  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(title, 14, 20);
  doc.setFontSize(10);
  doc.text(`Дата: ${new Date().toLocaleDateString('ru-RU')}`, 14, 28);

  (doc as any).autoTable({
    head: [headers],
    body: rows,
    startY: 35,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [59, 130, 246] },
  });

  doc.save(`${title}.pdf`);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
