"use client";

import { ChangeEvent, useEffect, useState } from "react";
import {
  MortgageSandboxApiError,
  checkMortgageSandboxIin,
  confirmMortgageSandboxDocument,
  getMortgageSandboxAnalysis,
  getMortgageSandboxStatus,
  previewMortgageSandboxScenario,
  uploadMortgageSandboxDocument,
  type MortgageSandboxDocument,
  type MortgageSandboxIinCheck,
  type MortgageSandboxStatus,
} from "@/lib/mortgage/sandbox-api";

function errorText(error: unknown): string {
  if (error instanceof MortgageSandboxApiError) return `${error.code ? `${error.code}: ` : ""}${error.message}`;
  return "Не удалось подключиться к sandbox-серверу. Локальные результаты не показаны.";
}

export default function MortgageWorkspacePage() {
  const [status, setStatus] = useState<MortgageSandboxStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [attested, setAttested] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<"credit_history" | "enpf_statement">("credit_history");
  const [document, setDocument] = useState<MortgageSandboxDocument | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [syntheticIin, setSyntheticIin] = useState("");
  const [iinResult, setIinResult] = useState<MortgageSandboxIinCheck | null>(null);
  const [questionnaireName, setQuestionnaireName] = useState("");
  const [analysis, setAnalysis] = useState<unknown>(null);
  const [scenario, setScenario] = useState<unknown>(null);

  useEffect(() => {
    void getMortgageSandboxStatus()
      .then(setStatus)
      .catch((error) => setStatusError(errorText(error)));
  }, []);

  const upload = async () => {
    if (!file || !attested || !status) return;
    setOperationError(null);
    try {
      setDocument(await uploadMortgageSandboxDocument({ type: docType, file, syntheticAttestation: true }));
    } catch (error) {
      setOperationError(errorText(error));
    }
  };

  const confirm = async () => {
    if (!document) return;
    setOperationError(null);
    try {
      const confirmed = await confirmMortgageSandboxDocument(document.id);
      setDocument({ ...document, status: confirmed.status });
    } catch (error) {
      setOperationError(errorText(error));
    }
  };

  const checkIin = async () => {
    setOperationError(null);
    try {
      setIinResult(await checkMortgageSandboxIin(syntheticIin));
    } catch (error) {
      setOperationError(errorText(error));
    }
  };

  const runAnalysis = async () => {
    setOperationError(null);
    try {
      setAnalysis((await getMortgageSandboxAnalysis()).analysis);
    } catch (error) {
      setOperationError(errorText(error));
    }
  };

  const runScenario = async () => {
    setOperationError(null);
    try {
      setScenario((await previewMortgageSandboxScenario([{ type: "lower_property_budget", newPropertyPrice: "35000000" }])).scenario);
    } catch (error) {
      setOperationError(errorText(error));
    }
  };

  const onFile = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;
    setFile(selected);
    setDocument(null);
  };

  return (
    <main className="mx-auto max-w-4xl space-y-6 pb-16">
      <section className="rounded-lg border-2 border-amber-500 bg-amber-50 p-4 text-amber-950" aria-label="Безопасный sandbox">
        <h1 className="text-xl font-bold">Безопасный sandbox</h1>
        <p className="mt-1 text-sm">Только синтетические или обезличенные данные. Это не банковское решение и не проверка по государственным источникам.</p>
        <p className="mt-2 text-xs">{status ? `Режим: ${status.mode}; политика ${status.policyVersion}.` : "Проверяем доступность sandbox…"}</p>
        {statusError && <p role="alert" className="mt-2 text-sm">{statusError}</p>}
      </section>

      <section className="rounded-lg border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Синтетическая анкета</h2>
            <p className="text-sm text-muted-foreground">Демо заполняет только анкету; документы, согласие, ИИН и расчёты не подделываются.</p>
          </div>
          <button type="button" className="rounded bg-[#15325B] px-3 py-2 text-sm text-white" onClick={() => setQuestionnaireName("Синтетический клиент CASA")}>Заполнить демо</button>
        </div>
        <label className="mt-3 block text-sm" htmlFor="synthetic-name">Имя в синтетической анкете</label>
        <input id="synthetic-name" value={questionnaireName} onChange={(event) => setQuestionnaireName(event.target.value)} className="mt-1 w-full rounded border p-2" />
        <p className="mt-2 text-sm">Документы не загружены</p>
        <p className="text-sm">Согласие: требуется интеграция провайдера</p>
      </section>

      <section className="rounded-lg border p-4">
        <h2 className="font-semibold">Приватная загрузка PDF</h2>
        <p className="mt-1 text-sm text-muted-foreground">Сервер принимает только PDF с текстовым слоем до 25 МБ и отклоняет найденный валидный ИИН до сохранения.</p>
        <label className="mt-3 flex items-start gap-2 text-sm">
          <input type="checkbox" checked={attested} onChange={(event) => setAttested(event.target.checked)} />
          <span>Подтверждаю, что документ синтетический или обезличенный и не содержит реальных персональных данных.</span>
        </label>
        <div className="mt-3 flex flex-wrap gap-2">
          <select aria-label="Тип документа" value={docType} onChange={(event) => setDocType(event.target.value as typeof docType)} className="rounded border p-2 text-sm">
            <option value="credit_history">Кредитная история</option>
            <option value="enpf_statement">Выписка ЕНПФ</option>
          </select>
          <input aria-label="PDF файл" type="file" accept="application/pdf,.pdf" onChange={onFile} />
          <button type="button" disabled={!attested || !file || !status} onClick={upload} className="rounded border px-3 py-2 text-sm disabled:opacity-50">Загрузить PDF</button>
        </div>
        {document && <div className="mt-3 rounded bg-emerald-50 p-3 text-sm">Сохранён на сервере (приватно): {document.fileName} · {document.status}{document.status === "needs_review" && <button type="button" className="ml-3 underline" onClick={confirm}>Подтвердить поля</button>}</div>}
      </section>

      <section className="rounded-lg border p-4">
        <h2 className="font-semibold">Проверка синтетического ИИН</h2>
        <p className="mt-1 text-sm text-muted-foreground">Проверяется только формат и контрольная сумма; официальный источник не подключён.</p>
        <label htmlFor="synthetic-iin" className="mt-3 block text-sm">Синтетический ИИН</label>
        <div className="mt-1 flex gap-2"><input id="synthetic-iin" value={syntheticIin} onChange={(event) => setSyntheticIin(event.target.value)} className="rounded border p-2" /><button type="button" onClick={checkIin} className="rounded border px-3 text-sm">Проверить структуру ИИН</button></div>
        {iinResult && <div className="mt-3 text-sm"><p>Контрольная сумма: {iinResult.checksumValid ? "корректна" : "некорректна"}</p><p>{iinResult.externalSourceStatus}</p><p>Официальный результат: не получен.</p></div>}
      </section>

      <section className="rounded-lg border p-4">
        <h2 className="font-semibold">Серверный анализ и сценарии</h2>
        <p className="mt-1 text-sm text-muted-foreground">Результаты поступают только из детерминированного sandbox-core.</p>
        <div className="mt-3 flex gap-2"><button type="button" onClick={runAnalysis} className="rounded border px-3 py-2 text-sm">Запустить анализ</button><button type="button" onClick={runScenario} className="rounded border px-3 py-2 text-sm">Проверить сценарий</button></div>
        {analysis !== null && <pre className="mt-3 overflow-auto rounded bg-muted p-2 text-xs">{JSON.stringify(analysis, null, 2)}</pre>}
        {scenario !== null && <pre className="mt-3 overflow-auto rounded bg-muted p-2 text-xs">{JSON.stringify(scenario, null, 2)}</pre>}
      </section>

      <section className="rounded-lg border p-4">
        <h2 className="font-semibold">Клиентские ссылки и PDF</h2>
        <p className="mt-1 text-sm text-muted-foreground">Требуется интеграция провайдера и юридическая политика. Публичные ссылки и PDF в sandbox не создаются.</p>
        <button type="button" disabled className="mt-3 rounded border px-3 py-2 text-sm">Создать публичную ссылку</button>
        <button type="button" disabled className="mt-3 ml-2 rounded border px-3 py-2 text-sm">Сформировать PDF</button>
      </section>
      {operationError && <p role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">{operationError}</p>}
    </main>
  );
}