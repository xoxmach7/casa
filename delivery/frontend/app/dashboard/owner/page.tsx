"use client";

/**
 * Кабинет собственника.
 *
 * Экран ведёт по трём шагам, и порядок здесь не украшение: разместить —
 * выбрать условия — принять их. Пока условия не приняты, объект не выходит
 * в витрину, потому что именно принятие делает комиссию обязательством, а
 * не пожеланием. Об этом на экране сказано прямо, а не спрятано в оферте.
 *
 * Снятие объекта — отдельный шаг с обязательным вопросом «кому продано».
 * Без него платформа не узнаёт о сделке вовсе.
 */

import { useCallback, useEffect, useState } from "react";
import {
  Home, Plus, Crown, ShieldCheck, Clock, Eye, TriangleAlert, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  getOwnerListings, getTiers, createOwnerListing, chooseTier, acceptAgreement,
  declareExit, getListingInterest,
  type OwnerListing, type TierTerms, type ListingTier,
} from "@/lib/marketplace-api";

function money(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const [whole] = String(value).split(".");
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ")} ₸`;
}

const STATUS_VIEW: Record<string, { label: string; tone: string }> = {
  MODERATION: { label: "На проверке", tone: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200" },
  NEEDS_INFORMATION: { label: "Нужны уточнения", tone: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200" },
  ACTIVE: { label: "В витрине", tone: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" },
  SOLD: { label: "Продан", tone: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200" },
  ARCHIVED: { label: "Снят", tone: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200" },
};

const EMPTY_FORM = {
  rooms: "2",
  residentialComplex: "",
  district: "",
  address: "",
  area: "",
  floor: "",
  totalFloors: "",
  yearBuilt: "",
  price: "",
  description: "",
};

export default function OwnerCabinetPage() {
  const [listings, setListings] = useState<OwnerListing[]>([]);
  const [tiers, setTiers] = useState<Record<ListingTier, TierTerms> | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const [tierTarget, setTierTarget] = useState<OwnerListing | null>(null);
  const [exitTarget, setExitTarget] = useState<OwnerListing | null>(null);
  const [exitForm, setExitForm] = useState({ outcome: "SOLD_VIA_PLATFORM", buyerPhone: "", declaredPrice: "", comment: "" });
  const [interest, setInterest] = useState<{ listing: OwnerListing; rows: any[] } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [data, tierData] = await Promise.all([getOwnerListings(), getTiers()]);
      setListings(data.listings);
      setTiers(tierData);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось загрузить объекты");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function submitListing() {
    setBusy(true);
    try {
      await createOwnerListing({
        rooms: Number(form.rooms),
        residentialComplex: form.residentialComplex,
        district: form.district,
        address: form.address,
        area: Number(form.area),
        floor: Number(form.floor),
        totalFloors: Number(form.totalFloors),
        yearBuilt: Number(form.yearBuilt),
        price: Number(form.price),
        description: form.description || undefined,
      });
      toast.success("Квартира отправлена на проверку");
      setCreating(false);
      setForm({ ...EMPTY_FORM });
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось разместить квартиру");
    } finally {
      setBusy(false);
    }
  }

  async function pickTier(tier: ListingTier) {
    if (!tierTarget) return;
    setBusy(true);
    try {
      const agreement = await chooseTier(tierTarget.id, tier);
      // Черновик сразу принимаем: собственник нажал кнопку с условиями на
      // экране — это и есть акцепт оферты, разносить его на два клика незачем.
      await acceptAgreement(agreement.id);
      toast.success("Условия приняты. Объект выйдет в витрину после проверки.");
      setTierTarget(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось принять условия");
    } finally {
      setBusy(false);
    }
  }

  async function submitExit() {
    if (!exitTarget) return;
    setBusy(true);
    try {
      await declareExit(exitTarget.id, {
        outcome: exitForm.outcome,
        buyerPhone: exitForm.buyerPhone || undefined,
        declaredPrice: exitForm.declaredPrice || undefined,
        comment: exitForm.comment || undefined,
      });
      toast.success("Объект снят с площадки");
      setExitTarget(null);
      setExitForm({ outcome: "SOLD_VIA_PLATFORM", buyerPhone: "", declaredPrice: "", comment: "" });
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось снять объект");
    } finally {
      setBusy(false);
    }
  }

  async function showInterest(listing: OwnerListing) {
    try {
      const data = await getListingInterest(listing.id);
      setInterest({ listing, rows: data.fixations });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось загрузить активность");
    }
  }

  const soldOutcome = exitForm.outcome === "SOLD_VIA_PLATFORM" || exitForm.outcome === "SOLD_OUTSIDE";

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Мои квартиры</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Разместите квартиру — её будут показывать покупателям агенты площадки.
            Размещение бесплатное, комиссия платится только при продаже.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="mr-1.5 h-4 w-4" aria-hidden />
          Разместить квартиру
        </Button>
      </header>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      ) : listings.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <Home className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
          <p className="mt-3 font-medium">Пока ни одной квартиры</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Разместите первую — на проверку уходит около суток.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {listings.map((listing) => {
            const agreement = listing.listingAgreements?.[0];
            const active = agreement?.status === "ACTIVE";
            const view = STATUS_VIEW[listing.status] ?? { label: listing.status, tone: "bg-muted" };
            const closed = listing.status === "SOLD" || listing.status === "ARCHIVED";

            return (
              <article key={listing.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold">{listing.residentialComplex}</h2>
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", view.tone)}>
                        {view.label}
                      </span>
                      {active && agreement.tier === "EXCLUSIVE" && (
                        <Badge className="gap-1 bg-amber-500 text-white hover:bg-amber-500">
                          <Crown className="h-3 w-3" aria-hidden />
                          Эксклюзив
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {listing.district}
                      {listing.address ? `, ${listing.address}` : ""} · {listing.rooms}-комн. ·{" "}
                      {listing.area} м² · {listing.floor}/{listing.totalFloors} эт.
                    </p>
                  </div>
                  <p className="text-lg font-bold tabular-nums">{money(listing.price)}</p>
                </div>

                {/* Условия либо приняты и объект работает, либо не приняты — и
                    тогда это единственное, что мешает ему выйти в витрину. */}
                {active ? (
                  <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 rounded-lg bg-muted/50 px-3 py-2 text-sm">
                    <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
                      <ShieldCheck className="h-4 w-4" aria-hidden />
                      Условия приняты
                    </span>
                    <span className="text-muted-foreground">
                      Комиссия {agreement.commissionPercent}% при продаже
                    </span>
                    <span className="text-muted-foreground">
                      Интерес агентов: {listing._count?.secondaryFixations ?? 0}
                    </span>
                  </div>
                ) : (
                  !closed && (
                    <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm dark:border-amber-900 dark:bg-amber-950/30">
                      <TriangleAlert className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
                      <span className="text-amber-800 dark:text-amber-200">
                        Пока вы не выбрали условия, квартиру не увидит ни один агент
                      </span>
                      <Button size="sm" className="ml-auto" onClick={() => setTierTarget(listing)}>
                        Выбрать условия
                      </Button>
                    </div>
                  )
                )}

                {!closed && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => void showInterest(listing)}>
                      <Eye className="mr-1.5 h-4 w-4" aria-hidden />
                      Кто интересуется
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setExitTarget(listing)}>
                      Снять с площадки
                    </Button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* --- Размещение квартиры --- */}
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Разместить квартиру</DialogTitle>
            <DialogDescription>
              Точный адрес нужен нам для проверки. Агентам он не показывается,
              пока они не закрепят за собой покупателя.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="rc">Жилой комплекс или дом</Label>
              <Input id="rc" value={form.residentialComplex}
                onChange={(e) => setForm({ ...form, residentialComplex: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="district">Район</Label>
              <Input id="district" value={form.district}
                onChange={(e) => setForm({ ...form, district: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="rooms">Комнат</Label>
              <Input id="rooms" type="number" min={1} max={10} value={form.rooms}
                onChange={(e) => setForm({ ...form, rooms: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="address">Точный адрес</Label>
              <Input id="address" placeholder="ул. Достык, 12, кв. 45" value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="area">Площадь, м²</Label>
              <Input id="area" type="number" step="0.1" value={form.area}
                onChange={(e) => setForm({ ...form, area: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="year">Год постройки</Label>
              <Input id="year" type="number" value={form.yearBuilt}
                onChange={(e) => setForm({ ...form, yearBuilt: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="floor">Этаж</Label>
              <Input id="floor" type="number" value={form.floor}
                onChange={(e) => setForm({ ...form, floor: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="floors">Этажей в доме</Label>
              <Input id="floors" type="number" value={form.totalFloors}
                onChange={(e) => setForm({ ...form, totalFloors: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="price">Цена, ₸</Label>
              <Input id="price" type="number" value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="desc">Описание</Label>
              <Textarea id="desc" rows={3} value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)} disabled={busy}>Отмена</Button>
            <Button onClick={() => void submitListing()} disabled={busy}>
              {busy ? "Отправляем…" : "Отправить на проверку"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- Выбор условий --- */}
      <Dialog open={Boolean(tierTarget)} onOpenChange={(open) => !open && setTierTarget(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Условия продажи</DialogTitle>
            <DialogDescription>
              Комиссия платится только при продаже. Ничего не продали — ничего не платите.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            {(["EXCLUSIVE", "BASIC"] as ListingTier[]).map((tier) => {
              const terms = tiers?.[tier];
              if (!terms) return null;
              const price = Number(tierTarget?.price ?? 0);
              const cost = (price * Number(terms.commissionPercent)) / 100;
              return (
                <div
                  key={tier}
                  className={cn(
                    "flex flex-col rounded-xl border p-4",
                    tier === "EXCLUSIVE" ? "border-amber-400 bg-amber-50/40 dark:bg-amber-950/20" : "border-border",
                  )}
                >
                  <div className="flex items-center gap-2">
                    {tier === "EXCLUSIVE" && <Crown className="h-4 w-4 text-amber-500" aria-hidden />}
                    <h3 className="font-semibold">
                      {tier === "EXCLUSIVE" ? "Эксклюзив" : "Базовое размещение"}
                    </h3>
                  </div>
                  <p className="mt-2 text-2xl font-bold tabular-nums">{terms.commissionPercent}%</p>
                  <p className="text-sm text-muted-foreground">
                    при вашей цене это {money(String(Math.round(cost)))}
                  </p>
                  <ul className="mt-3 flex-1 space-y-1.5 text-sm">
                    {terms.includedServices.map((service) => (
                      <li key={service} className="flex items-start gap-1.5">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
                        {service}
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="mt-4"
                    variant={tier === "EXCLUSIVE" ? "default" : "outline"}
                    disabled={busy}
                    onClick={() => void pickTier(tier)}
                  >
                    Выбрать и принять
                  </Button>
                </div>
              );
            })}
          </div>

          <p className="text-xs text-muted-foreground">
            Нажимая «Выбрать и принять», вы соглашаетесь: если покупателя привёл агент
            площадки, комиссия причитается при продаже — в том числе если сделка
            состоится в течение защитного периода после окончания работы агента.
          </p>
        </DialogContent>
      </Dialog>

      {/* --- Снятие объекта --- */}
      <Dialog open={Boolean(exitTarget)} onOpenChange={(open) => !open && setExitTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Снять с площадки</DialogTitle>
            <DialogDescription>
              Скажите, чем закончилось — от этого зависит расчёт по договору.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              {[
                { value: "SOLD_VIA_PLATFORM", label: "Продал покупателю с площадки" },
                { value: "SOLD_OUTSIDE", label: "Продал сам, мимо площадки" },
                { value: "NOT_SOLD", label: "Не продал, снимаю" },
                { value: "WITHDRAWN", label: "Передумал продавать" },
              ].map((option) => (
                <label
                  key={option.value}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm",
                    exitForm.outcome === option.value ? "border-primary bg-muted" : "border-border",
                  )}
                >
                  <input
                    type="radio"
                    name="outcome"
                    value={option.value}
                    checked={exitForm.outcome === option.value}
                    onChange={(e) => setExitForm({ ...exitForm, outcome: e.target.value })}
                  />
                  {option.label}
                </label>
              ))}
            </div>

            {soldOutcome && (
              <>
                <div>
                  <Label htmlFor="buyerPhone">Телефон покупателя</Label>
                  <Input
                    id="buyerPhone"
                    placeholder="+7 777 123 45 67"
                    value={exitForm.buyerPhone}
                    onChange={(e) => setExitForm({ ...exitForm, buyerPhone: e.target.value })}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Нужен, чтобы понять, участвовал ли в сделке агент площадки.
                    Номер хранится в необратимом виде.
                  </p>
                </div>
                <div>
                  <Label htmlFor="declaredPrice">Цена сделки, ₸</Label>
                  <Input
                    id="declaredPrice"
                    type="number"
                    value={exitForm.declaredPrice}
                    onChange={(e) => setExitForm({ ...exitForm, declaredPrice: e.target.value })}
                  />
                </div>
              </>
            )}

            <div>
              <Label htmlFor="exitComment">Комментарий</Label>
              <Textarea
                id="exitComment"
                rows={2}
                value={exitForm.comment}
                onChange={(e) => setExitForm({ ...exitForm, comment: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setExitTarget(null)} disabled={busy}>Отмена</Button>
            <Button onClick={() => void submitExit()} disabled={busy}>
              {busy ? "Снимаем…" : "Снять с площадки"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- Кто интересуется --- */}
      <Dialog open={Boolean(interest)} onOpenChange={(open) => !open && setInterest(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Кто интересуется</DialogTitle>
            <DialogDescription>
              Агенты, закрепившие за собой покупателей по этому объекту.
              Контакты покупателей принадлежат агентам и не показываются.
            </DialogDescription>
          </DialogHeader>

          {interest?.rows.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              Пока никто не закреплён. Обычно первые заявки приходят в течение недели
              после публикации.
            </p>
          ) : (
            <ul className="max-h-72 space-y-2 overflow-y-auto">
              {interest?.rows.map((row) => (
                <li key={row.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                  <p className="font-medium">
                    {row.agent.firstName} {row.agent.lastName}
                    {row.agency?.companyName ? ` · ${row.agency.companyName}` : ""}
                  </p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" aria-hidden />
                    {new Date(row.createdAt).toLocaleDateString("ru-RU")} · {row.status}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
