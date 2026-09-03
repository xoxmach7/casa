"use client";

/**
 * «Новый расчёт» — недостающее звено между списком клиентов и ипотечным
 * экраном. До него брокеру было негде начать: экран предлагал «начните новый
 * расчёт», но начинать было нечем, потому что расчёт заводится на клиента.
 *
 * Диалог НЕ создаёт клиента и не показывает чужих: список приходит из
 * /clients, который уже отфильтрован по брокеру на сервере.
 */

import { useCallback, useEffect, useState } from "react";
import { Search, UserPlus, Loader2 } from "lucide-react";
import Link from "next/link";
import { API_URL } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { createMortgageCase, MortgageCaseApiError } from "@/lib/mortgage/case-api";

interface PickableClient {
  id: string;
  firstName: string;
  lastName: string;
  city?: string | null;
}

export function NewCaseDialog({
  open, onOpenChange, onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (caseId: string) => void;
}) {
  const [clients, setClients] = useState<PickableClient[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [creatingFor, setCreatingFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (query: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: "1", limit: "20" });
      if (query.trim()) params.set("search", query.trim());
      const res = await fetch(`${API_URL}/clients?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error(String(res.status));
      const body = await res.json();
      setClients(Array.isArray(body?.clients) ? body.clients : []);
    } catch {
      setClients([]);
      setError("Не удалось загрузить список клиентов");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    // Задержка, иначе на каждое нажатие клавиши уходил бы отдельный запрос.
    const timer = setTimeout(() => void load(search), search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [open, search, load]);

  const start = async (clientId: string) => {
    setCreatingFor(clientId);
    setError(null);
    try {
      const created = await createMortgageCase(clientId);
      onOpenChange(false);
      onCreated(created.id);
    } catch (e) {
      setError(
        e instanceof MortgageCaseApiError ? e.message : "Не удалось создать расчёт",
      );
    } finally {
      setCreatingFor(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Новый расчёт</DialogTitle>
          <DialogDescription>
            Выберите клиента — расчёт заведётся на него. Дальше загрузите его
            документы и получите сумму кредита.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по имени или телефону"
            className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-3 text-sm"
          />
        </div>

        <div className="max-h-72 space-y-1 overflow-y-auto">
          {loading && (
            <div className="space-y-2 py-2">
              {[0, 1, 2].map((i) => <div key={i} className="h-11 animate-pulse rounded-md bg-muted/60" />)}
            </div>
          )}

          {!loading && clients.length === 0 && (
            <div className="py-8 text-center">
              <p className="text-sm text-muted-foreground">
                {search.trim() ? "Никого не нашли по этому запросу" : "У вас пока нет клиентов"}
              </p>
              <Button asChild variant="outline" size="sm" className="mt-3">
                <Link href="/dashboard/clients/new">
                  <UserPlus className="mr-1.5 h-4 w-4" />Добавить клиента
                </Link>
              </Button>
            </div>
          )}

          {!loading && clients.map((c) => (
            <button
              key={c.id}
              type="button"
              disabled={creatingFor !== null}
              onClick={() => void start(c.id)}
              className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-muted/60 disabled:opacity-60"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">
                  {`${c.lastName ?? ""} ${c.firstName ?? ""}`.trim() || "Без имени"}
                </span>
                {c.city && <span className="block truncate text-xs text-muted-foreground">{c.city}</span>}
              </span>
              {creatingFor === c.id
                ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                : <span className="shrink-0 text-xs text-primary">Начать</span>}
            </button>
          ))}
        </div>

        {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
      </DialogContent>
    </Dialog>
  );
}
