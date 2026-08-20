"use client";

/**
 * CASA Pro Ипотека — единый рабочий экран (single_workspace).
 * Phase 0: интерфейс и контракты, все состояния на мок-данных.
 *
 * Оркестратор держит WorkspaceState и реализует переходы (contracts.ts).
 * Ни одна цифра здесь не является банковским решением — CASA формирует
 * предварительное заключение (product_definition.decision_boundary).
 */

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import {
  Calculator,
  ArrowRight,
  RotateCcw,
  Wand2,
  TriangleAlert,
  User2,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

import type { WorkspaceState, MortgageClient, WhatIfInputs } from "@/lib/mortgage/types";
import { formatDateTime } from "@/lib/mortgage/calc";
import {
  createInitialWorkspace,
  DEMO_CLIENT,
  DEFAULT_WHAT_IF,
  CREDIT_HISTORY_FIELDS,
  ENPF_FIELDS,
  MOCK_OBLIGATIONS,
  buildDemoAnalysis,
  buildDemoScenarios,
  buildDemoProperties,
} from "@/lib/mortgage/mock";
import type { WorkspaceHandlers } from "@/components/mortgage/workspace/contracts";
import { SectionClientConsent, SectionDocuments, SectionAnalysis } from "@/components/mortgage/workspace/sections-early";
import { SectionScenarios, SectionWhatIf, SectionProperties, SectionConclusion } from "@/components/mortgage/workspace/sections-late";
import { ClientPickerModal, ConsentModal } from "@/components/mortgage/workspace/modals";

const CASE_STATUS_LABEL: Record<WorkspaceState["caseStatus"], string> = {
  new: "Новый",
  consent_required: "Нужно согласие",
  waiting_for_consent: "Ждём согласие",
  documents_required: "Нужны документы",
  documents_processing: "Обработка документов",
  data_review_required: "Проверка данных",
  ready_for_analysis: "Готов к анализу",
  analysis_ready: "Анализ готов",
  scenario_selected: "Сценарий выбран",
  property_selection_ready: "Подборка готова",
  ready_for_application: "Готов к заявке",
  on_hold: "На паузе",
  closed: "Закрыт",
};

const nowIso = () => new Date().toISOString();

function scrollToSection(order: number) {
  document.getElementById(`mortgage-section-${order}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function MortgageWorkspacePage() {
  const [st, setSt] = useState<WorkspaceState>(createInitialWorkspace);
  const { toast } = useToast();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);

  const patch = useCallback((p: Partial<WorkspaceState>) => setSt((prev) => ({ ...prev, ...p })), []);

  // --- Секция 1: клиент и согласие ------------------------------------------

  const selectClient = useCallback((client: MortgageClient) => {
    setSt(() => {
      const fresh = createInitialWorkspace();
      const whatIf: WhatIfInputs = {
        ...DEFAULT_WHAT_IF,
        propertyPrice: client.desiredPropertyPrice ?? DEFAULT_WHAT_IF.propertyPrice,
        downPayment: client.downPayment ?? DEFAULT_WHAT_IF.downPayment,
        existingDebtPayment: client.existingMonthlyPayment ?? 0,
        termMonths: client.desiredTermMonths ?? DEFAULT_WHAT_IF.termMonths,
      };
      return { ...fresh, client, caseStatus: "consent_required", whatIf };
    });
  }, []);

  const sendConsent = useCallback(() => {
    setSt((prev) => ({
      ...prev,
      consent: {
        ...prev.consent,
        status: "sms_pending",
        audit: {
          consentId: `cs-${Date.now().toString(36)}`,
          phoneMasked: prev.client?.phone ?? "—",
          consentTextVersion: "1.1",
          method: "casa_sms_link_otp",
          requestedAt: nowIso(),
          purposes: ["questionnaire", "credit_history", "enpf", "iin_checks", "scoring", "share_conclusion"],
          smsProviderMessageId: `demo-${Math.floor(Math.random() * 1e6)}`,
        },
      },
      caseStatus: "waiting_for_consent",
    }));
    // Клиент «открыл ссылку»
    setTimeout(() => {
      setSt((prev) =>
        prev.consent.status === "sms_pending"
          ? { ...prev, consent: { ...prev.consent, status: "link_opened", audit: prev.consent.audit ? { ...prev.consent.audit, openedAt: nowIso() } : prev.consent.audit } }
          : prev,
      );
    }, 1200);
  }, []);

  const clientConfirmConsent = useCallback(() => {
    setSt((prev) => ({
      ...prev,
      consent: {
        ...prev.consent,
        status: "confirmed",
        audit: prev.consent.audit ? { ...prev.consent.audit, confirmedAt: nowIso() } : prev.consent.audit,
      },
      caseStatus: "documents_required",
    }));
    setConsentOpen(false);
    toast({ title: "Согласие подтверждено", description: "Чувствительные действия разблокированы." });
  }, [toast]);

  const clientRejectConsent = useCallback(() => {
    setSt((prev) => ({ ...prev, consent: { ...prev.consent, status: "rejected" } }));
    setConsentOpen(false);
    toast({ title: "Согласие отклонено", variant: "destructive" });
  }, [toast]);

  const revokeConsent = useCallback(() => {
    setSt((prev) => ({
      ...createInitialWorkspace(),
      client: prev.client,
      whatIf: prev.whatIf,
      consent: { ...prev.consent, status: "revoked" },
      caseStatus: "consent_required",
    }));
    toast({ title: "Согласие отозвано", description: "Новая обработка и доступ заблокированы (AC-013)." });
  }, [toast]);

  // --- Секция 2: документы и ИИН --------------------------------------------

  const uploadDocument = useCallback((which: "creditHistory" | "enpf") => {
    const fields = which === "creditHistory" ? CREDIT_HISTORY_FIELDS : ENPF_FIELDS;
    const stages: { status: WorkspaceState["documents"]["creditHistory"]["status"]; progress: number; delay: number }[] = [
      { status: "uploading", progress: 25, delay: 0 },
      { status: "scanning", progress: 50, delay: 700 },
      { status: "processing", progress: 80, delay: 1500 },
      { status: "needs_review", progress: 100, delay: 2400 },
    ];
    stages.forEach((s) => {
      setTimeout(() => {
        setSt((prev) => ({
          ...prev,
          caseStatus: "documents_processing",
          documents: {
            ...prev.documents,
            [which]: {
              ...prev.documents[which],
              status: s.status,
              progress: s.progress,
              fileName: `${which === "creditHistory" ? "credit_history" : "enpf"}.pdf`,
              fields: s.status === "needs_review" ? fields.map((f) => ({ ...f })) : prev.documents[which].fields,
              reportDate: s.status === "needs_review" ? "12.08.2026" : prev.documents[which].reportDate,
            },
          },
        }));
      }, s.delay);
    });
  }, []);

  const confirmDocument = useCallback((which: "creditHistory" | "enpf") => {
    setSt((prev) => {
      const documents = {
        ...prev.documents,
        [which]: {
          ...prev.documents[which],
          status: "confirmed" as const,
          fields: prev.documents[which].fields.map((f) => ({ ...f, confirmed: true, confidence: Math.max(f.confidence, 0.95), inconsistency: undefined })),
        },
      };
      const bothConfirmed = documents.creditHistory.status === "confirmed" && documents.enpf.status === "confirmed";
      const obligations = which === "creditHistory" || prev.obligations.length ? MOCK_OBLIGATIONS : prev.obligations;
      return {
        ...prev,
        documents,
        obligations: documents.creditHistory.status === "confirmed" ? MOCK_OBLIGATIONS : obligations,
        caseStatus: bothConfirmed ? "ready_for_analysis" : "documents_required",
      };
    });
  }, []);

  const correctField = useCallback((which: "creditHistory" | "enpf", key: string, value: string) => {
    setSt((prev) => ({
      ...prev,
      documents: {
        ...prev.documents,
        [which]: {
          ...prev.documents[which],
          fields: prev.documents[which].fields.map((f) =>
            f.key === key ? { ...f, value, confidence: 1, confirmed: true, inconsistency: undefined } : f,
          ),
        },
      },
    }));
    toast({ title: "Поле исправлено", description: "Значение подтверждено вручную." });
  }, [toast]);

  const runIinCheck = useCallback(() => {
    setSt((prev) => ({ ...prev, iinCheck: { status: "in_progress" } }));
    setTimeout(() => {
      setSt((prev) => ({
        ...prev,
        iinCheck: {
          status: "verified_no_records",
          checkedAt: nowIso(),
          sourceUrl: "https://www.gov.kz/…/aisoip",
        },
      }));
    }, 1500);
  }, []);

  // --- Секция 3: анализ ------------------------------------------------------

  const runAnalysis = useCallback(() => {
    setSt((prev) => ({
      ...prev,
      analysis: buildDemoAnalysis(),
      scenarios: buildDemoScenarios(),
      obligations: prev.obligations.length ? prev.obligations : MOCK_OBLIGATIONS,
      caseStatus: "analysis_ready",
      lastCalculationAt: nowIso(),
    }));
  }, []);

  const confirmSnapshot = useCallback(() => {
    setSt((prev) => ({ ...prev, snapshotConfirmed: true, caseStatus: "analysis_ready" }));
    toast({ title: "Снимок зафиксирован", description: "Расчёт воспроизводим по этой версии данных (AC-012)." });
  }, [toast]);

  // --- Секция 4: сценарии ----------------------------------------------------

  const selectScenario = useCallback((id: string) => {
    setSt((prev) => ({ ...prev, selectedScenarioId: id, caseStatus: "scenario_selected", lastCalculationAt: nowIso() }));
    const sc = st.scenarios.find((s) => s.id === id);
    if (sc?.requiresVerifiedInput) {
      toast({ title: "Нужны подтверждённые условия", description: "Введите проверенную ставку/предложение — итог показывается предварительным (AC-006)." });
    }
  }, [st.scenarios, toast]);

  const acceptCurrentCase = useCallback(() => {
    setSt((prev) => ({ ...prev, selectedScenarioId: null, caseStatus: "scenario_selected" }));
  }, []);

  // --- Секция 5: что если ----------------------------------------------------

  const changeWhatIf = useCallback((p: Partial<WhatIfInputs>) => {
    setSt((prev) => ({ ...prev, whatIf: { ...prev.whatIf, ...p }, lastCalculationAt: nowIso() }));
  }, []);

  const saveWhatIfScenario = useCallback(() => {
    toast({ title: "Сценарий сохранён", description: "Добавлен в список сценариев клиента (демо)." });
  }, [toast]);

  // --- Секция 6: квартиры ----------------------------------------------------

  const matchProperties = useCallback(() => {
    setSt((prev) => ({ ...prev, properties: buildDemoProperties(), caseStatus: "property_selection_ready" }));
  }, []);

  const toggleSelection = useCallback((id: string) => {
    setSt((prev) => ({
      ...prev,
      properties: prev.properties.map((p) => (p.id === id ? { ...p, inSelection: !p.inSelection } : p)),
    }));
  }, []);

  // --- Секция 7: заключение --------------------------------------------------

  const saveNextAction = useCallback((action: string, dueDate?: string) => {
    setSt((prev) => ({ ...prev, nextAction: { action, dueDate, savedAt: nowIso() }, caseStatus: "ready_for_application" }));
    toast({ title: "Решение сохранено" });
  }, [toast]);

  const generateLink = useCallback(() => {
    setSt((prev) => ({
      ...prev,
      conclusion: {
        conclusionId: `cn-${Date.now().toString(36)}`,
        version: (prev.conclusion?.version ?? 0) + 1,
        publicLink: `https://pro.casa.kz/z/${Math.random().toString(36).slice(2, 10)}`,
        expiresAt: "26.08.2026",
        createdAt: nowIso(),
        pdfReady: prev.conclusion?.pdfReady,
      },
    }));
    toast({ title: "Ссылка создана", description: "Без индексации, с истечением, ИИН и документы скрыты (AC-014)." });
  }, [toast]);

  const generatePdf = useCallback(() => {
    setSt((prev) => ({
      ...prev,
      conclusion: {
        conclusionId: prev.conclusion?.conclusionId ?? `cn-${Date.now().toString(36)}`,
        version: prev.conclusion?.version ?? 1,
        createdAt: prev.conclusion?.createdAt ?? nowIso(),
        publicLink: prev.conclusion?.publicLink,
        expiresAt: prev.conclusion?.expiresAt,
        pdfReady: true,
      },
    }));
    toast({ title: "PDF сформирован (демо)" });
  }, [toast]);

  const handlers: WorkspaceHandlers = useMemo(
    () => ({
      openClientPicker: () => setPickerOpen(true),
      openConsent: () => setConsentOpen(true),
      revokeConsent,
      uploadDocument,
      confirmDocument,
      correctField,
      runIinCheck,
      runAnalysis,
      confirmSnapshot,
      selectScenario,
      acceptCurrentCase,
      changeWhatIf,
      saveWhatIfScenario,
      matchProperties,
      toggleSelection,
      saveNextAction,
      generateLink,
      generatePdf,
    }),
    [revokeConsent, uploadDocument, confirmDocument, correctField, runIinCheck, runAnalysis, confirmSnapshot, selectScenario, acceptCurrentCase, changeWhatIf, saveWhatIfScenario, matchProperties, toggleSelection, saveNextAction, generateLink, generatePdf],
  );

  // --- Демо: пройти весь путь одним кликом (для просмотра всех состояний) ----

  const fillDemo = useCallback(() => {
    setSt(() => {
      const base = createInitialWorkspace();
      const analysis = buildDemoAnalysis();
      return {
        ...base,
        client: DEMO_CLIENT,
        whatIf: {
          ...DEFAULT_WHAT_IF,
          propertyPrice: DEMO_CLIENT.desiredPropertyPrice!,
          downPayment: DEMO_CLIENT.downPayment!,
          existingDebtPayment: DEMO_CLIENT.existingMonthlyPayment!,
        },
        consent: {
          status: "confirmed",
          linkTtlMinutes: 30,
          otpTtlMinutes: 5,
          audit: {
            consentId: "cs-demo",
            phoneMasked: DEMO_CLIENT.phone,
            consentTextVersion: "1.1",
            method: "casa_sms_link_otp",
            requestedAt: nowIso(),
            openedAt: nowIso(),
            confirmedAt: nowIso(),
            purposes: ["questionnaire", "credit_history", "enpf", "iin_checks", "scoring", "share_conclusion"],
            smsProviderMessageId: "demo-000001",
          },
        },
        documents: {
          creditHistory: { ...base.documents.creditHistory, status: "confirmed", fields: CREDIT_HISTORY_FIELDS.map((f) => ({ ...f, confirmed: true, confidence: Math.max(f.confidence, 0.95), inconsistency: undefined })) },
          enpf: { ...base.documents.enpf, status: "confirmed", fields: ENPF_FIELDS.map((f) => ({ ...f, confirmed: true })) },
        },
        iinCheck: { status: "verified_no_records", checkedAt: nowIso() },
        obligations: MOCK_OBLIGATIONS,
        analysis,
        snapshotConfirmed: true,
        scenarios: buildDemoScenarios(),
        selectedScenarioId: "sc-refi",
        properties: buildDemoProperties(),
        caseStatus: "property_selection_ready",
        lastCalculationAt: nowIso(),
      };
    });
    toast({ title: "Демо-данные заполнены", description: "Весь путь до подбора квартир (мок-данные)." });
  }, [toast]);

  const resetAll = useCallback(() => {
    setSt(createInitialWorkspace());
    toast({ title: "Экран сброшен" });
  }, [toast]);

  // --- Первичное действие для липкого контекста ------------------------------

  const primary = useMemo(() => {
    const s = st;
    if (!s.client) return { label: "Выбрать клиента", onClick: () => setPickerOpen(true) };
    if (s.consent.status !== "confirmed") return { label: "Отправить согласие", onClick: () => setConsentOpen(true) };
    if (!(s.documents.creditHistory.status === "confirmed" && s.documents.enpf.status === "confirmed"))
      return { label: "Загрузить документы", onClick: () => scrollToSection(2) };
    if (!s.analysis) return { label: "Запустить анализ", onClick: runAnalysis };
    if (!s.snapshotConfirmed) return { label: "Подтвердить данные", onClick: confirmSnapshot };
    if (!s.selectedScenarioId && s.caseStatus !== "scenario_selected") return { label: "Выбрать сценарий", onClick: () => scrollToSection(4) };
    if (s.properties.length === 0) return { label: "Подобрать квартиры", onClick: matchProperties };
    if (!s.nextAction) return { label: "Сохранить действие", onClick: () => scrollToSection(7) };
    return { label: "Готово", onClick: () => scrollToSection(7) };
  }, [st, runAnalysis, confirmSnapshot, matchProperties]);

  const sectionProps = { state: st, h: handlers };

  return (
    <div className="mx-auto max-w-4xl space-y-4 pb-16">
      {/* Заголовок */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ипотечное решение клиента</h1>
          <p className="text-sm text-muted-foreground">
            Согласие → документы → анализ → сценарии → квартиры → заключение
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" onClick={fillDemo}>
            <Wand2 className="mr-1.5 h-4 w-4" />
            Демо
          </Button>
          <Button variant="ghost" size="sm" onClick={resetAll}>
            <RotateCcw className="mr-1.5 h-4 w-4" />
            Сброс
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/mortgage/tools">
              <Calculator className="mr-1.5 h-4 w-4" />
              Инструменты
            </Link>
          </Button>
        </div>
      </div>

      {/* Демо-предупреждение */}
      <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-800">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Демо-режим (Phase 0): все банковские условия, ставки, платежи и квартиры демонстрационные и требуют проверки
          перед production. CASA формирует предварительное заключение — окончательное решение принимает банк.
        </span>
      </div>

      {/* Липкий контекст */}
      <div className="sticky top-2 z-20 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border bg-card/95 p-3 shadow-sm backdrop-blur">
        <div className="flex items-center gap-2">
          <User2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{st.client ? st.client.fullName : "Клиент не выбран"}</span>
        </div>
        <div className="hidden items-center gap-1.5 sm:flex">
          <span className="text-xs text-muted-foreground">Статус:</span>
          <span className="rounded-full bg-[#15325B]/10 px-2 py-0.5 text-xs font-medium text-[#15325B]">
            {CASE_STATUS_LABEL[st.caseStatus]}
          </span>
        </div>
        <div className="hidden items-center gap-1.5 text-xs text-muted-foreground md:flex">
          <Clock className="h-3.5 w-3.5" />
          Расчёт: {formatDateTime(st.lastCalculationAt)}
        </div>
        <Button size="sm" className={cn("ml-auto bg-[#15325B] hover:bg-[#15325B]/90")} onClick={primary.onClick}>
          {primary.label}
          <ArrowRight className="ml-1.5 h-4 w-4" />
        </Button>
      </div>

      {/* Секции */}
      <SectionClientConsent {...sectionProps} />
      <SectionDocuments {...sectionProps} />
      <SectionAnalysis {...sectionProps} />
      <SectionScenarios {...sectionProps} />
      <SectionWhatIf {...sectionProps} />
      <SectionProperties {...sectionProps} />
      <SectionConclusion {...sectionProps} />

      {/* Модалки */}
      <ClientPickerModal open={pickerOpen} onOpenChange={setPickerOpen} onSelect={selectClient} />
      <ConsentModal
        open={consentOpen}
        onOpenChange={setConsentOpen}
        client={st.client}
        consentStatus={st.consent.status}
        previewHref={st.consent.audit?.consentId ? `/consent/${st.consent.audit.consentId}` : undefined}
        onSend={sendConsent}
        onClientConfirm={clientConfirmConsent}
        onClientReject={clientRejectConsent}
      />
    </div>
  );
}
