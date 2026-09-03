"use client";

/**
 * Мои фиксации — рабочий список агента.
 *
 * Фиксация здесь не «запись в журнале», а доказательство того, что покупателя
 * привёл этот агент. Поэтому на карточке видно две даты, и вторая важнее
 * первой: срок самой фиксации и срок защиты, в течение которого сделка с
 * этим покупателем всё ещё считается приведённой площадкой.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck, Clock, ArrowRight, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getFixations, advanceFixation, type Fixation } from "@/lib/marketplace-api";

function money(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const [whole] = String(value).split(".");
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ")} ₸`;
}

const STATUS_VIEW: Record<string, { label: string; tone: string; next?: string; nextLabel?: string }> = {
  CONFIRMED: {
    label: "Закреплён",
    tone: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
    next: "SHOWN",
    nextLabel: "Показ состоялся",
  },
  SHOWN: {
    label: "Показ проведён",
    tone: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
    next: "OFFER_MADE",
    nextLabel: "Внесено предложение",
  },
  OFFER_MADE: {
    label: "Предложение внесено",
    tone: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200",
    next: "DEAL",
    nextLabel: "Вышли на сделку",
  },
  DEAL: { label: "Сделка", tone: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200" },
  EXPIRED: { label: "Срок истёк", tone: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200" },
  CANCELLED: { label: "Отменена", tone: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200" },
  REJECTED_DUPLICATE: { label: "Отказ: дубль", tone: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200" },
};

export default function FixationsPage() {
  const [fixations, setFixations] = useState<Fixation[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getFixations();
      setFixations(data.fixations);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось загрузить фиксации");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function advance(fixation: Fixation, status: string) {
    setBusy(fixation.id);
    try {
      await advanceFixation(fixation.id, status);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось изменить статус");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Мои фиксации</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Закреплённые за вами покупатели по объектам площадки.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/marketplace">
            <Store className="mr-1.5 h-4 w-4" aria-hidden />К площадке</Link>
        </Button>
      </header>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : fixations.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <ShieldCheck className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
          <p className="mt-3 font-medium">Фиксаций пока нет</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Найдите объект на площадке и закрепите за собой покупателя.
          </p>
          <Button asChild className="mt-4" size="sm">
            <Link href="/dashboard/marketplace">Открыть площадку</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {fixations.map((fixation) => {
            const view = STATUS_VIEW[fixation.status] ?? { label: fixation.status, tone: "bg-muted" };
            return (
              <article key={fixation.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold">{fixation.property.residentialComplex}</h2>
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", view.tone)}>
                        {view.label}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {fixation.property.district} · {fixation.property.rooms}-комн. ·{" "}
                      {fixation.property.area} м² · {money(fixation.property.price)}
                    </p>
                    <p className="mt-1 text-sm">
                      Покупатель:{" "}
                      <span className="font-medium">
                        {fixation.buyer.firstName} {fixation.buyer.lastName ?? ""}
                      </span>{" "}
                      <span className="text-muted-foreground">{fixation.buyer.phone}</span>
                    </p>
                  </div>

                  {view.next && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy === fixation.id}
                      onClick={() => void advance(fixation, view.next!)}
                    >
                      {view.nextLabel}
                      <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden />
                    </Button>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t border-border pt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" aria-hidden />
                    Фиксация до {new Date(fixation.expiresAt).toLocaleDateString("ru-RU")}
                  </span>
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3" aria-hidden />
                    Защита до {new Date(fixation.protectionUntil).toLocaleDateString("ru-RU")}
                  </span>
                  <span>Ваша доля: {fixation.declaredSharePercent}%</span>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
