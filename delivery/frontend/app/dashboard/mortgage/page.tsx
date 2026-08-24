"use client";

import { ChangeEvent, useEffect, useState } from "react";
import { API_URL } from "@/lib/api-client";
import { createMortgageCase, MortgageCase } from "@/lib/mortgage/case-api";
import { calculateMortgage, MortgageCalculation, MortgageCalculationInput, uploadMortgageDocument } from "@/lib/mortgage/workspace-api";

const initialCalculation: MortgageCalculationInput = {
  propertyPrice: 0,
  downPayment: 0,
  termMonths: 0,
  rate: 0,
  existingDebtPayment: 0,
  additionalConfirmedIncome: 0,
  baseIncome: 0,
};

const money = new Intl.NumberFormat("ru-KZ", { maximumFractionDigits: 0 });

type ClientOption = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
};

export default function MortgageWorkspacePage() {
  const [clientId, setClientId] = useState("");
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [mortgageCase, setMortgageCase] = useState<MortgageCase | null>(null);
  const [calculation, setCalculation] = useState<MortgageCalculation | null>(null);
  const [values, setValues] = useState(initialCalculation);
  const [file, setFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<"credit_history" | "enpf_statement">("credit_history");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<"case" | "calc" | "upload" | "pdf" | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`${API_URL}/clients?limit=100`, { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Не удалось загрузить клиентов");
        return response.json() as Promise<{ clients?: ClientOption[] }>;
      })
      .then((body) => { if (active) setClients(body.clients || []); })
      .catch(() => { if (active) setNotice("Не удалось загрузить список клиентов. Обновите страницу."); })
      .finally(() => { if (active) setClientsLoading(false); });
    return () => { active = false; };
  }, []);

  const setNumber = (key: keyof MortgageCalculationInput, value: string) => setValues((current) => ({ ...current, [key]: Number(value) || 0 }));

  async function createCase() {
    if (!clientId.trim()) { setNotice("Выберите клиента."); return; }
    setBusy("case");
    setNotice("");
    try {
      const created = await createMortgageCase(clientId.trim());
      setMortgageCase(created);
      setNotice("Заявка создана");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Не удалось создать заявку"); }
    finally { setBusy(null); }
  }

  async function calculate() {
    setBusy("calc");
    setNotice("");
    try { setCalculation(await calculateMortgage(values)); setNotice("Расчёт обновлён"); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Не удалось выполнить расчёт"); }
    finally { setBusy(null); }
  }

  async function upload() {
    if (!file) { setNotice("Выберите PDF-файл."); return; }
    setBusy("upload");
    setNotice("");
    try { const document = await uploadMortgageDocument(file, documentType); setNotice(`Документ «${document.fileName}» загружен приватно.`); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Не удалось загрузить документ"); }
    finally { setBusy(null); }
  }

  async function makePdf() {
    setBusy("pdf");
    try {
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF();
      pdf.setFontSize(16); pdf.text("CASA Pro — внутренний ипотечный расчёт", 14, 20);
      pdf.setFontSize(11); pdf.text(`Заявка: ${mortgageCase?.id || "не создана"}`, 14, 32);
      pdf.text(`Клиент: ${clientId || "не указан"}`, 14, 40);
      if (calculation) {
        pdf.text(`Сумма кредита: ${money.format(calculation.loanAmount)} ₸`, 14, 52);
        pdf.text(`Ежемесячный платёж: ${money.format(calculation.monthlyPayment)} ₸`, 14, 60);
        pdf.text(`КДН: ${calculation.kdn}%`, 14, 68);
      }
      pdf.setFontSize(9); pdf.text("Предварительный внутренний расчёт. Не является решением банка.", 14, 280);
      pdf.save("mortgage-calculation.pdf");
      setNotice("PDF сформирован");
    } catch { setNotice("Не удалось сформировать PDF"); }
    finally { setBusy(null); }
  }

  return <main className="mx-auto max-w-5xl space-y-6 pb-16">
    <section className="rounded-lg border bg-white p-5">
      <h1 className="text-2xl font-bold text-[#15325B]">Ипотечная заявка</h1>
      <p className="mt-1 text-sm text-muted-foreground">Создайте заявку, добавьте приватные документы, рассчитайте платёж и сформируйте внутренний PDF.</p>
      <p className="mt-2 text-sm text-slate-600">Внешние проверки подключаются отдельно и не блокируют заявку.</p>
    </section>

    <section className="rounded-lg border p-5">
      <h2 className="font-semibold">1. Заявка</h2>
      <label className="mt-3 block text-sm" htmlFor="client">Клиент</label>
      <div className="mt-1 flex flex-wrap gap-2">
        <select id="client" value={clientId} onChange={(event) => setClientId(event.target.value)} disabled={clientsLoading} className="min-w-64 rounded border p-2 text-sm disabled:opacity-50">
          <option value="">{clientsLoading ? "Загружаем клиентов…" : "Выберите клиента"}</option>
          {clients.map((client) => <option key={client.id} value={client.id}>{client.firstName} {client.lastName} · {client.phone}</option>)}
        </select>
        <button type="button" onClick={createCase} disabled={busy === "case" || !clientId} className="rounded bg-[#15325B] px-4 py-2 text-sm text-white disabled:opacity-50">{busy === "case" ? "Создаём…" : "Создать заявку"}</button>
      </div>
      {!clientsLoading && clients.length === 0 && <p className="mt-2 text-sm text-muted-foreground">В базе пока нет клиентов. Сначала создайте клиента в разделе «Клиенты».</p>}
      {mortgageCase && <p className="mt-3 text-sm text-emerald-700">Заявка создана: {mortgageCase.id} · {mortgageCase.status}</p>}
    </section>

    <section className="rounded-lg border p-5">
      <h2 className="font-semibold">2. Приватные документы</h2>
      <p className="mt-1 text-sm text-muted-foreground">PDF хранится приватно и доступен только владельцу заявки и администраторам.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <select aria-label="Тип документа" value={documentType} onChange={(event) => setDocumentType(event.target.value as typeof documentType)} className="rounded border p-2 text-sm"><option value="credit_history">Кредитная история</option><option value="enpf_statement">Выписка ЕНПФ</option></select>
        <input aria-label="PDF файл" type="file" accept="application/pdf,.pdf" onChange={(event: ChangeEvent<HTMLInputElement>) => setFile(event.target.files?.[0] || null)} className="text-sm" />
        <button type="button" onClick={upload} disabled={busy === "upload"} className="rounded border px-4 py-2 text-sm disabled:opacity-50">{busy === "upload" ? "Загрузка…" : "Загрузить PDF"}</button>
      </div>
    </section>

    <section className="rounded-lg border p-5">
      <h2 className="font-semibold">3. Расчёт и сценарии</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {([['propertyPrice','Стоимость объекта'], ['downPayment','Первоначальный взнос'], ['termMonths','Срок, месяцев'], ['rate','Ставка, %'], ['baseIncome','Подтверждённый доход'], ['existingDebtPayment','Текущие платежи']] as const).map(([key, label]) => <label key={key} className="text-sm">{label}<input type="number" min="0" value={values[key]} onChange={(event) => setNumber(key, event.target.value)} className="mt-1 w-full rounded border p-2" /></label>)}
      </div>
      <button type="button" onClick={calculate} disabled={busy === "calc"} className="mt-4 rounded bg-[#15325B] px-4 py-2 text-sm text-white disabled:opacity-50">{busy === "calc" ? "Считаем…" : "Рассчитать"}</button>
      {calculation && <div className="mt-4 grid gap-3 rounded bg-slate-50 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4"><p>Кредит<br /><strong>{money.format(calculation.loanAmount)} ₸</strong></p><p>Платёж в месяц<br /><strong>{money.format(calculation.monthlyPayment)} ₸</strong></p><p>КДН<br /><strong>{calculation.kdn}%</strong></p><p>Принимаемый доход<br /><strong>{money.format(calculation.acceptedIncome)} ₸</strong></p></div>}
    </section>

    <section className="rounded-lg border p-5"><h2 className="font-semibold">4. Внутренний PDF</h2><p className="mt-1 text-sm text-muted-foreground">Файл содержит текущий расчёт для работы с клиентом; это не публичная ссылка и не решение банка.</p><button type="button" onClick={makePdf} disabled={busy === "pdf" || !mortgageCase} className="mt-3 rounded border px-4 py-2 text-sm disabled:opacity-50">{busy === "pdf" ? "Формируем…" : "Сформировать PDF"}</button></section>
    {notice && <p role="status" className="rounded border p-3 text-sm">{notice}</p>}
  </main>;
}
