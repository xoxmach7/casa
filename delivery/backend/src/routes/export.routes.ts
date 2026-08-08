import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { prisma } from '../lib/prisma';
import ExcelJS from 'exceljs';

export const exportRouter = Router();
exportRouter.use(authenticate);

// Prefixes a leading =, +, -, @ with a quote so spreadsheet apps never
// interpret an exported cell (free-text fields like comments/addresses)
// as a formula when the CSV is later opened in Excel/Sheets.
function csvEscape(value: unknown): string {
  let s = String(value ?? '');
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function rowsToCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.map(csvEscape).join(',')];
  for (const r of rows) lines.push(headers.map((h) => csvEscape(r[h])).join(','));
  return lines.join('\n');
}

function addJsonSheet(wb: ExcelJS.Workbook, name: string, rows: Record<string, unknown>[]) {
  const ws = wb.addWorksheet(name);
  if (rows.length === 0) return ws;
  const headers = Object.keys(rows[0]);
  ws.addRow(headers);
  for (const r of rows) ws.addRow(headers.map((h) => r[h] ?? ''));
  return ws;
}

// GET /api/export/clients?format=xlsx|csv
exportRouter.get('/clients', async (req: Request, res: Response): Promise<void> => {
  try {
    const format = (req.query.format as string) || 'xlsx';
    const userId = req.user!.userId;
    const userRole = req.user!.role;
    const where: any = {};
    if (['BROKER', 'REALTOR', 'AGENCY'].includes(userRole)) {
      where.brokerId = userId;
    }

    const clients = await prisma.client.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { broker: { select: { firstName: true, lastName: true } } },
    });

    const rows = clients.map(c => ({
      'ИИН': c.iin,
      'Имя': c.firstName,
      'Фамилия': c.lastName,
      'Отчество': c.middleName || '',
      'Телефон': c.phone,
      'Email': c.email || '',
      'Город': c.city || '',
      'Тип': c.clientType,
      'Статус': c.status,
      'Доход': c.monthlyIncome ? Number(c.monthlyIncome) : '',
      'Первоначальный взнос': c.initialPayment ? Number(c.initialPayment) : '',
      'Брокер': `${c.broker.firstName} ${c.broker.lastName}`,
      'Дата создания': c.createdAt.toLocaleDateString('ru-RU'),
    }));

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=clients.csv');
      res.send('﻿' + rowsToCsv(rows)); // BOM for Excel UTF-8
    } else {
      const wb = new ExcelJS.Workbook();
      addJsonSheet(wb, 'Клиенты', rows);
      const buf = await wb.xlsx.writeBuffer();
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=clients.xlsx');
      res.send(Buffer.from(buf));
    }
  } catch (error) {
    console.error('Export clients error:', error);
    res.status(500).json({ error: 'Ошибка экспорта' });
  }
});


// GET /api/export/analytics?format=xlsx|csv
exportRouter.get('/analytics', async (req: Request, res: Response): Promise<void> => {
  try {
    const format = (req.query.format as string) || 'xlsx';
    const userId = req.user!.userId;
    const userRole = req.user!.role;
    const where: any = {};
    if (['BROKER', 'REALTOR', 'AGENCY'].includes(userRole)) {
      where.brokerId = userId;
    }

    const [deals, bookings, clients] = await Promise.all([
      prisma.deal.findMany({ where, orderBy: { createdAt: 'desc' } }),
      prisma.booking.findMany({ where, orderBy: { createdAt: 'desc' }, include: { client: { select: { firstName: true, lastName: true } }, apartment: { select: { number: true, project: { select: { name: true } } } } } }),
      prisma.client.findMany({ where, select: { id: true, status: true } }),
    ]);

    // Deals sheet
    const dealsRows = deals.map(d => ({
      'Сумма': Number(d.amount),
      'Комиссия': Number(d.commission),
      'Casa Fee': Number(d.casaFee),
      'Статус': d.status,
      'Этап': d.stage,
      'Тип объекта': d.objectType,
      'Дата': d.createdAt.toLocaleDateString('ru-RU'),
    }));

    // Bookings sheet
    const bookingsRows = bookings.map(b => ({
      'Клиент': `${b.client?.firstName || ''} ${b.client?.lastName || ''}`,
      'ЖК': b.apartment?.project?.name || '',
      'Квартира': b.apartment?.number || '',
      'Статус': b.status,
      'Дата': b.createdAt.toLocaleDateString('ru-RU'),
    }));

    // Summary
    const totalDeals = deals.length;
    const completedDeals = deals.filter(d => d.status === 'COMPLETED').length;
    const totalClients = clients.length;
    const conversionRate = totalClients > 0 ? Math.round((completedDeals / totalClients) * 100) : 0;

    const summaryRows = [
      { 'Показатель': 'Всего сделок', 'Значение': totalDeals },
      { 'Показатель': 'Закрытых сделок', 'Значение': completedDeals },
      { 'Показатель': 'Всего клиентов', 'Значение': totalClients },
      { 'Показатель': 'Конверсия', 'Значение': `${conversionRate}%` },
      { 'Показатель': 'Общая комиссия', 'Значение': deals.filter(d => d.status === 'COMPLETED').reduce((s, d) => s + Number(d.commission), 0) },
    ];

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=analytics.csv');
      res.send('﻿' + rowsToCsv(summaryRows));
    } else {
      const wb = new ExcelJS.Workbook();
      addJsonSheet(wb, 'Сводка', summaryRows);
      addJsonSheet(wb, 'Сделки', dealsRows);
      addJsonSheet(wb, 'Брони', bookingsRows);
      const buf = await wb.xlsx.writeBuffer();
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=analytics.xlsx');
      res.send(Buffer.from(buf));
    }
  } catch (error) {
    console.error('Export analytics error:', error);
    res.status(500).json({ error: 'Ошибка экспорта' });
  }
});
