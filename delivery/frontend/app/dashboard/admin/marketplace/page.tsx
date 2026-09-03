"use client";

/**
 * Портал вторички глазами CASA: очередь модерации, подписки агентств и споры.
 *
 * На вкладке модерации намеренно видно, есть ли у объекта принятый договор.
 * Одобрить объект без него нельзя, и лучше показать причину заранее, чем
 * дать нажать кнопку и вернуть ошибку.
 */

import { useCallback, useEffect, useState } from "react";
import { Store, ShieldCheck, TriangleAlert, Check, X, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  getModerationQueue, approveListing, rejectListing,
  getAgencySubscriptions, grantSubscription, cancelSubscription,
  getDisputes,
  type ModerationListing, type AgencySubscriptionRow, type DisputeRow,
} from "@/lib/marketplace-api";

function money(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const [whole] = String(value).split(".");
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ")} ₸`;
}

const OUTCOME_LABEL: Record<string, string> = {
  SOLD_VIA_PLATFORM: "Продан через площадку",
  SOLD_OUTSIDE: "Продан мимо площадки",
  NOT_SOLD: "Не продан",
  WITHDRAWN: "Снят собственником",
};

export default function AdminMarketplacePage() {
  const [queue, setQueue] = useState<ModerationListing[]>([]);
  const [subscriptions, setSubscriptions] = useState<AgencySubscriptionRow[]>([]);
  const [disputes, setDisputes] = useState<DisputeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [grantForm, setGrantForm] = useState({ agencyId: "", plan: "START" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [q, s, d] = await Promise.all([
        getModerationQueue(),
        getAgencySubscriptions(),
        getDisputes(),
      ]);
      setQueue(q.listings);
      setSubscriptions(s.subscriptions);
      setDisputes(d.disputes);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось загрузить данные");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function approve(listing: ModerationListing) {
    setBusy(listing.id);
    try {
      await approveListing(listing.id);
      toast.success("Объект опубликован");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось опубликовать");
    } finally {
      setBusy(null);
    }
  }

  async function reject(listing: ModerationListing) {
    setBusy(listing.id);
    try {
      await rejectListing(listing.id, "Нужны уточнения по объекту");
      toast.success("Отправлено на уточнение");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось отклонить");
    } finally {
      setBusy(null);
    }
  }

  async function grant() {
    if (!grantForm.agencyId.trim()) {
      toast.error("Укажите id агентства или агента");
      return;
    }
    setBusy("grant");
    try {
      await grantSubscription(grantForm.agencyId.trim(), grantForm.plan);
      toast.success("Подписка выдана");
      setGrantForm({ agencyId: "", plan: "START" });
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось выдать подписку");
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-6">
        <Skeleton className="h-9 w-64" />
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Store className="h-6 w-6" aria-hidden />
          Портал вторички
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Объекты собственников, подписки агентств и расхождения при снятии объектов.
        </p>
      </header>

      <Tabs defaultValue="moderation">
        <TabsList>
          <TabsTrigger value="moderation">Модерация ({queue.length})</TabsTrigger>
          <TabsTrigger value="subscriptions">Подписки ({subscriptions.length})</TabsTrigger>
          <TabsTrigger value="disputes">Споры ({disputes.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="moderation" className="space-y-3 pt-4">
          {queue.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
              Очередь пуста
            </p>
          ) : (
            queue.map((listing) => {
              const agreement = listing.listingAgreements?.[0];
              const ready = agreement?.status === "ACTIVE";
              return (
                <article key={listing.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="font-semibold">{listing.residentialComplex}</h2>
                      <p className="text-sm text-muted-foreground">
                        {listing.district}
                        {listing.address ? `, ${listing.address}` : ""} · {listing.rooms}-комн. ·{" "}
                        {listing.area} м²
                      </p>
                      {listing.seller && (
                        <p className="mt-1 text-sm">
                          Собственник: {listing.seller.firstName} {listing.seller.lastName} ·{" "}
                          <span className="text-muted-foreground">{listing.seller.phone}</span>
                        </p>
                      )}
                    </div>
                    <p className="text-lg font-bold tabular-nums">{money(listing.price)}</p>
                  </div>

                  <div
                    className={cn(
                      "mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm",
                      ready
                        ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200"
                        : "bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200",
                    )}
                  >
                    {ready ? <ShieldCheck className="h-4 w-4" aria-hidden /> : <TriangleAlert className="h-4 w-4" aria-hidden />}
                    {ready
                      ? `Договор принят: ${agreement.tier === "EXCLUSIVE" ? "эксклюзив" : "базовое размещение"}`
                      : agreement
                        ? "Условия выбраны, но собственник их не принял — публиковать нельзя"
                        : "Собственник не выбрал условия — публиковать нельзя"}
                  </div>

                  <div className="mt-3 flex gap-2">
                    <Button size="sm" disabled={!ready || busy === listing.id} onClick={() => void approve(listing)}>
                      <Check className="mr-1.5 h-4 w-4" aria-hidden />
                      Опубликовать
                    </Button>
                    <Button size="sm" variant="outline" disabled={busy === listing.id} onClick={() => void reject(listing)}>
                      <X className="mr-1.5 h-4 w-4" aria-hidden />
                      На уточнение
                    </Button>
                  </div>
                </article>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="subscriptions" className="space-y-3 pt-4">
          <div className="flex flex-wrap items-end gap-2 rounded-xl border border-border bg-muted/30 p-4">
            <div className="flex-1 min-w-[220px]">
              <label className="text-xs uppercase tracking-wide text-muted-foreground" htmlFor="agencyId">
                ID агентства или независимого агента
              </label>
              <Input
                id="agencyId"
                value={grantForm.agencyId}
                onChange={(e) => setGrantForm({ ...grantForm, agencyId: e.target.value })}
                placeholder="cuid пользователя"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wide text-muted-foreground" htmlFor="plan">
                Тариф
              </label>
              <select
                id="plan"
                value={grantForm.plan}
                onChange={(e) => setGrantForm({ ...grantForm, plan: e.target.value })}
                className="mt-1 h-9 rounded-md border border-border bg-background px-3 text-sm"
              >
                <option value="TRIAL">Пробный</option>
                <option value="START">Старт</option>
                <option value="PRO">Про</option>
                <option value="ENTERPRISE">Корпоративный</option>
              </select>
            </div>
            <Button onClick={() => void grant()} disabled={busy === "grant"}>
              <CreditCard className="mr-1.5 h-4 w-4" aria-hidden />
              Выдать
            </Button>
          </div>

          {subscriptions.map((sub) => (
            <article key={sub.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
              <div>
                <p className="font-medium">
                  {sub.agency.companyName || `${sub.agency.firstName} ${sub.agency.lastName}`}
                  <span className="ml-2 text-xs text-muted-foreground">{sub.agency.email}</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  {sub.plan} · {sub.status} · до {sub.maxActiveFixations} фиксаций, до {sub.maxAgents} агентов
                  {sub.expiresAt ? ` · до ${new Date(sub.expiresAt).toLocaleDateString("ru-RU")}` : ""}
                </p>
              </div>
              {sub.status === "ACTIVE" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    await cancelSubscription(sub.id);
                    toast.success("Подписка отменена");
                    await load();
                  }}
                >
                  Отменить
                </Button>
              )}
            </article>
          ))}
        </TabsContent>

        <TabsContent value="disputes" className="space-y-3 pt-4">
          {disputes.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
              Расхождений нет
            </p>
          ) : (
            disputes.map((dispute) => (
              <article key={dispute.id} className="rounded-xl border border-rose-200 bg-rose-50/50 p-4 dark:border-rose-900 dark:bg-rose-950/20">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">{dispute.property.residentialComplex}</h2>
                    <p className="text-sm text-muted-foreground">
                      {dispute.property.district} · {dispute.property.rooms}-комн. · {dispute.property.area} м²
                    </p>
                    <p className="mt-2 text-sm">
                      Собственник заявил: <strong>{OUTCOME_LABEL[dispute.outcome] ?? dispute.outcome}</strong>
                      {dispute.declaredPrice ? ` за ${money(dispute.declaredPrice)}` : ""}
                    </p>
                    <p className="mt-1 text-sm text-rose-700 dark:text-rose-300">
                      Покупатель совпал с фиксацией агента, защитный период не истёк —
                      комиссия причитается по договору.
                    </p>
                    {dispute.comment && (
                      <p className="mt-1 text-sm text-muted-foreground">«{dispute.comment}»</p>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(dispute.createdAt).toLocaleDateString("ru-RU")}
                  </p>
                </div>
              </article>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
