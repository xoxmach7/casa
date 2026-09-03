"use client";

/**
 * Витрина вторички — главный экран агента с покупателем.
 *
 * Экран построен вокруг одной мысли: агент везёт клиента на ЧУЖУЮ квартиру,
 * и решает он это по двум цифрам — цене объекта и своему вознаграждению.
 * Поэтому вознаграждение стоит на карточке крупно, рядом с ценой, а не в
 * подвале мелким шрифтом.
 *
 * Вторая мысль: адрес и контакты закрыты до фиксации, и об этом надо
 * говорить прямо, а не молча отдавать карточку без полей. Скрытое поле,
 * о котором не предупредили, читается как поломка.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Lock, MapPin, Building2, Layers, Ruler, ShieldCheck, Crown,
  TriangleAlert, UserPlus, Search, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  getCatalog, getSubscription, fixBuyer, MarketplaceApiError,
  type CatalogListing, type MarketplaceSubscription,
} from "@/lib/marketplace-api";
import api from "@/lib/api-client";

function money(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const [whole, fraction] = String(value).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return fraction && Number(fraction) > 0 ? `${grouped},${fraction} ₸` : `${grouped} ₸`;
}

const PLAN_LABEL: Record<string, string> = {
  TRIAL: "Пробный",
  START: "Старт",
  PRO: "Про",
  ENTERPRISE: "Корпоративный",
};

function SubscriptionBar({ data }: { data: MarketplaceSubscription | null }) {
  if (!data?.subscription) return null;
  const { subscription, liveFixations, remainingFixations } = data;
  const tight = remainingFixations <= 2;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-border bg-muted/40 px-4 py-2.5 text-sm">
      <span className="font-medium">Тариф {PLAN_LABEL[subscription.plan] ?? subscription.plan}</span>
      <span className="text-muted-foreground">
        Активных фиксаций {liveFixations} из {subscription.maxActiveFixations}
      </span>
      <span className={cn("ml-auto", tight ? "font-medium text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>
        {remainingFixations > 0
          ? `Осталось ${remainingFixations}`
          : "Лимит исчерпан — завершите или отмените фиксации"}
      </span>
    </div>
  );
}

function ListingCard({ listing, onFix }: { listing: CatalogListing; onFix: (l: CatalogListing) => void }) {
  const fixed = Boolean(listing.fixation);

  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md">
      <div className="relative h-40 bg-muted">
        {listing.images?.[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={listing.images[0]} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Building2 className="h-8 w-8" aria-hidden />
          </div>
        )}
        {listing.tier === "EXCLUSIVE" && (
          <Badge className="absolute left-3 top-3 gap-1 bg-amber-500 text-white hover:bg-amber-500">
            <Crown className="h-3 w-3" aria-hidden />
            Эксклюзив
          </Badge>
        )}
        {fixed && (
          <Badge className="absolute right-3 top-3 gap-1 bg-emerald-600 text-white hover:bg-emerald-600">
            <ShieldCheck className="h-3 w-3" aria-hidden />
            Зафиксирован
          </Badge>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="font-semibold leading-tight">{listing.residentialComplex}</h3>
          <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {listing.district}
            {listing.address ? `, ${listing.address}` : ""}
          </p>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Layers className="h-3.5 w-3.5" aria-hidden />
            {listing.rooms}-комн.
          </span>
          <span className="flex items-center gap-1">
            <Ruler className="h-3.5 w-3.5" aria-hidden />
            {listing.area} м²
          </span>
          <span>{listing.floor}/{listing.totalFloors} эт.</span>
          <span>{listing.yearBuilt} г.</span>
        </div>

        <div className="mt-auto space-y-2 pt-2">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-xl font-bold tabular-nums">{money(listing.price)}</span>
          </div>

          {/* Вознаграждение — то, ради чего агент повезёт клиента на чужой
              объект. Держим его рядом с ценой, а не прячем в детали. */}
          {listing.expectedReward && (
            <div className="rounded-lg bg-emerald-50 px-3 py-2 dark:bg-emerald-950/40">
              <p className="text-[11px] uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                Вам при сделке
              </p>
              <p className="text-lg font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
                {money(listing.expectedReward)}
              </p>
              <p className="text-[11px] text-emerald-700/70 dark:text-emerald-300/70">
                {listing.declaredSharePercent}% комиссии собственника
              </p>
            </div>
          )}

          {fixed ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 px-3 py-2 text-sm dark:border-emerald-900 dark:bg-emerald-950/20">
              <p className="font-medium text-emerald-700 dark:text-emerald-300">Контакты открыты</p>
              {listing.seller && (
                <p className="text-muted-foreground">
                  {listing.seller.firstName} {listing.seller.lastName} · {listing.seller.phone}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Фиксация до {new Date(listing.fixation!.expiresAt).toLocaleDateString("ru-RU")}
              </p>
            </div>
          ) : (
            <>
              <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                Точный адрес и контакты собственника откроются после фиксации покупателя
              </p>
              <Button className="w-full" size="sm" onClick={() => onFix(listing)}>
                <UserPlus className="mr-1.5 h-4 w-4" aria-hidden />
                Зафиксировать покупателя
              </Button>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

export default function MarketplacePage() {
  const [listings, setListings] = useState<CatalogListing[]>([]);
  const [subscription, setSubscription] = useState<MarketplaceSubscription | null>(null);
  const [buyers, setBuyers] = useState<Array<{ id: string; firstName: string; lastName?: string | null; phone: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [target, setTarget] = useState<CatalogListing | null>(null);
  const [busy, setBusy] = useState(false);

  const [district, setDistrict] = useState("");
  const [rooms, setRooms] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [catalog, sub] = await Promise.all([
        getCatalog({ district: district || undefined, rooms: rooms ? Number(rooms) : undefined }),
        getSubscription().catch(() => null),
      ]);
      setListings(catalog.listings);
      setSubscription(sub);
      setBlocked(null);
    } catch (error) {
      if (error instanceof MarketplaceApiError && error.code === "MARKETPLACE_SUBSCRIPTION_REQUIRED") {
        setBlocked(error.message);
      } else {
        toast.error(error instanceof Error ? error.message : "Не удалось загрузить каталог");
      }
      setListings([]);
    } finally {
      setLoading(false);
    }
  }, [district, rooms]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    api.get("/buyers")
      .then((r) => setBuyers(Array.isArray(r.data) ? r.data : r.data?.buyers ?? []))
      .catch(() => setBuyers([]));
  }, []);

  const districts = useMemo(
    () => Array.from(new Set(listings.map((l) => l.district))).sort(),
    [listings],
  );

  async function confirmFixation(buyerId: string) {
    if (!target) return;
    setBusy(true);
    try {
      await fixBuyer(target.id, buyerId);
      toast.success("Покупатель зафиксирован — адрес и контакты открыты");
      setTarget(null);
      await load();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Не удалось зафиксировать";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  if (blocked) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <TriangleAlert className="mx-auto h-10 w-10 text-amber-500" aria-hidden />
        <h1 className="mt-4 text-xl font-semibold">Доступ к площадке закрыт</h1>
        <p className="mt-2 text-muted-foreground">{blocked}</p>
        <p className="mt-4 text-sm text-muted-foreground">
          Подписка даёт доступ к объектам собственников, которых нет в открытых
          источниках. Обратитесь к администратору CASA, чтобы её оформить.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 px-4 py-6 md:px-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Площадка вторички</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Объекты собственников. Приводите покупателя — получаете объявленную долю комиссии.
          </p>
        </div>
      </header>

      <SubscriptionBar data={subscription} />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            list="marketplace-districts"
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            placeholder="Район"
            className="w-48 pl-8"
          />
          <datalist id="marketplace-districts">
            {districts.map((d) => <option key={d} value={d} />)}
          </datalist>
        </div>
        <Input
          type="number"
          min={1}
          max={10}
          value={rooms}
          onChange={(e) => setRooms(e.target.value)}
          placeholder="Комнат"
          className="w-28"
        />
        {(district || rooms) && (
          <Button variant="ghost" size="sm" onClick={() => { setDistrict(""); setRooms(""); }}>
            <X className="mr-1 h-4 w-4" aria-hidden />
            Сбросить
          </Button>
        )}
        <span className="ml-auto text-sm text-muted-foreground">
          {loading ? "Загрузка…" : `Объектов: ${listings.length}`}
        </span>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-80 rounded-xl" />
          ))}
        </div>
      ) : listings.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <Building2 className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
          <p className="mt-3 font-medium">Подходящих объектов нет</p>
          <p className="mt-1 text-sm text-muted-foreground">
            В витрину попадают только объекты с принятым договором собственника.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {listings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} onFix={setTarget} />
          ))}
        </div>
      )}

      <Dialog open={Boolean(target)} onOpenChange={(open) => !open && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Зафиксировать покупателя</DialogTitle>
            <DialogDescription>
              {target?.residentialComplex}, {target?.district}. После фиксации откроются
              точный адрес и контакты собственника, а покупатель закрепится за вами
              — другой агент не сможет провести с ним эту сделку.
            </DialogDescription>
          </DialogHeader>

          {buyers.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              У вас нет покупателей в CRM. Сначала заведите покупателя — фиксация
              подтверждает, что именно вы его привели.
            </p>
          ) : (
            <div className="max-h-72 space-y-1.5 overflow-y-auto py-1">
              {buyers.map((buyer) => (
                <button
                  key={buyer.id}
                  type="button"
                  disabled={busy}
                  onClick={() => void confirmFixation(buyer.id)}
                  className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted disabled:opacity-50"
                >
                  <span>
                    <span className="font-medium">{buyer.firstName} {buyer.lastName ?? ""}</span>
                    <span className="block text-xs text-muted-foreground">{buyer.phone}</span>
                  </span>
                  <UserPlus className="h-4 w-4 text-muted-foreground" aria-hidden />
                </button>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)} disabled={busy}>
              Отмена
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
