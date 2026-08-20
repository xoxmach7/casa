"use client";

import { useState } from "react";
import { Search, UserPlus, ShieldCheck, Loader2, Send, Check, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { formatTenge } from "@/lib/mortgage/calc";
import { MOCK_CLIENTS } from "@/lib/mortgage/mock";
import type { MortgageClient, ConsentStatus } from "@/lib/mortgage/types";

const CONSENT_PURPOSES = [
  "Сбор и обработка анкетных данных",
  "Обработка загруженной кредитной истории",
  "Обработка выписки ЕНПФ",
  "Разрешённые проверки по ИИН",
  "Предварительный расчёт вариантов ипотеки",
  "Подбор программ и квартир",
  "Формирование и передача клиентского заключения",
];

// ============================================================================
// Выбор / создание клиента
// ============================================================================

export function ClientPickerModal({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelect: (client: MortgageClient) => void;
}) {
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("Алматы");

  const filtered = MOCK_CLIENTS.filter(
    (c) => c.fullName.toLowerCase().includes(q.toLowerCase()) || c.phone.includes(q),
  );

  const createClient = () => {
    if (!name.trim()) return;
    onSelect({
      id: `cl-${Date.now()}`,
      fullName: name.trim(),
      phone: phone.trim() || "+7 700 000 00 00",
      iinMasked: "••••••••••••",
      city: city.trim() || "Алматы",
    });
    onOpenChange(false);
    setCreating(false);
    setName("");
    setPhone("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{creating ? "Новый клиент" : "Выбор клиента"}</DialogTitle>
          <DialogDescription>
            {creating ? "Заполните минимальные данные — остальное из документов." : "Найдите клиента или создайте нового."}
          </DialogDescription>
        </DialogHeader>

        {!creating ? (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Имя или телефон…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
            </div>
            <div className="max-h-72 space-y-1.5 overflow-y-auto">
              {filtered.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    onSelect(c);
                    onOpenChange(false);
                  }}
                  className="flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors hover:border-[#15325B] hover:bg-[#15325B]/[0.03]"
                >
                  <div>
                    <p className="font-medium">{c.fullName}</p>
                    <p className="text-xs text-muted-foreground">{c.phone} · {c.city}</p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    {c.confirmedIncome ? formatTenge(c.confirmedIncome) : "—"}
                    <span className="block">доход/мес</span>
                  </div>
                </button>
              ))}
              {filtered.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Никого не найдено.</p>}
            </div>
            <Button variant="outline" className="w-full" onClick={() => setCreating(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Создать нового клиента
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>ФИО *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Иванов Иван" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Телефон</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7 700 …" />
              </div>
              <div className="space-y-1.5">
                <Label>Город</Label>
                <Input value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreating(false)}>Назад</Button>
              <Button className="bg-[#15325B] hover:bg-[#15325B]/90" onClick={createClient} disabled={!name.trim()}>
                Создать и выбрать
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Поток согласия
// ============================================================================

export function ConsentModal({
  open,
  onOpenChange,
  client,
  consentStatus,
  previewHref,
  onSend,
  onClientConfirm,
  onClientReject,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  client: MortgageClient | null;
  consentStatus: ConsentStatus;
  previewHref?: string;
  onSend: () => void;
  onClientConfirm: () => void;
  onClientReject: () => void;
}) {
  const pending = consentStatus === "sms_pending" || consentStatus === "link_opened";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-[#15325B]" />
            Согласие на обработку данных
          </DialogTitle>
          <DialogDescription>
            {client ? `${client.fullName} · ${client.phone}` : ""} · версия текста 1.1
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-lg bg-muted/50 p-3 text-sm">
            <p className="font-medium">Клиент даёт согласие на:</p>
            <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-muted-foreground">
              {CONSENT_PURPOSES.map((p) => <li key={p}>{p}</li>)}
            </ul>
          </div>

          <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
            Демо-режим Phase 0: SMS не отправляется. Достаточность способа подтверждения для каждого источника
            согласуется с юристом и поставщиком данных до production (open_decisions OD-001).
          </p>

          {!pending ? (
            <Button className="w-full bg-[#15325B] hover:bg-[#15325B]/90" onClick={onSend}>
              <Send className="mr-2 h-4 w-4" />
              Отправить SMS-согласие
            </Button>
          ) : (
            <div className="space-y-3">
              <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Ссылка отправлена на {client?.phone}. Ожидаем ответ клиента…
              </p>
              {previewHref && (
                <a
                  href={previewHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-md border border-dashed py-2 text-center text-xs text-[#15325B] hover:bg-[#15325B]/[0.03]"
                >
                  Открыть страницу клиента (демо) ↗
                </a>
              )}
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 text-red-600" onClick={onClientReject}>
                  <X className="mr-2 h-4 w-4" />
                  Клиент отклонил (демо)
                </Button>
                <Button className="flex-1 bg-emerald-600 hover:bg-emerald-600/90" onClick={onClientConfirm}>
                  <Check className="mr-2 h-4 w-4" />
                  Клиент подтвердил (демо)
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
