"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, AlertTriangle, Loader2, ShieldCheck, History } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { getApiUrl, getAuthHeaders } from "@/lib/api-client"
import {
  blockerLabel,
  dealRoomStageLabel,
  depositStatusLabel,
  formatTenge,
  trafficLightClass,
  trafficLightLabel,
} from "@/lib/secondary-market"

interface DealRoomDetail {
  id: string
  stage: string
  trafficLight: string
  finalPrice: string | null
  version: number
  outcomeReason: string | null
  property: any
  buyer: any
  offer: any
  coordinator: { id: string; firstName: string; lastName: string; email: string } | null
  precheck: {
    buyerVerified: boolean
    sellerVerified: boolean
    propertyVerified: boolean
    paymentRouteConfirmed: boolean
    completenessPercent: number
    hasBlockingRisk: boolean
    missingAmount: string
    mortgagePartConfirmed: boolean
    notes: string | null
  } | null
  deposit: {
    amount: string | null
    status: string
    proofType: string | null
    coordinatorVerified: boolean
    verifiedAt: string | null
  } | null
  booking: any
  risks: { id: string; severity: string; description: string; isBlocker: boolean; resolvedAt: string | null }[]
  history: {
    id: string
    action: string
    reason: string | null
    createdAt: string
    oldValues: any
    newValues: any
    actor: { firstName: string; lastName: string } | null
  }[]
}

/** Переходы, для которых сервер требует явную причину. */
const REASON_REQUIRED = ["SOLD", "FAILED"]

export default function DealRoomDetailPage() {
  const router = useRouter()
  const params = useParams()
  const dealId = params.id as string

  const [deal, setDeal] = useState<DealRoomDetail | null>(null)
  const [availableStages, setAvailableStages] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [transitioning, setTransitioning] = useState<string | null>(null)
  const [transitionError, setTransitionError] = useState<string | null>(null)
  const [canCoordinate, setCanCoordinate] = useState(false)

  useEffect(() => {
    const raw = localStorage.getItem("user")
    const role = raw ? JSON.parse(raw)?.role : null
    setCanCoordinate(role === "ADMIN" || role === "COORDINATOR")
  }, [])

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    fetch(getApiUrl(`deal-room/${dealId}`), { headers: getAuthHeaders() })
      .then(async (r) => {
        if (r.status === 403) throw new Error("Раздел доступен координатору и аналитику вторички.")
        if (r.status === 404) throw new Error("Сделка не найдена.")
        if (!r.ok) throw new Error("Не удалось загрузить сделку.")
        return r.json()
      })
      .then((body) => {
        setDeal(body.data)
        setAvailableStages(body.meta?.availableStages ?? [])
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [dealId])

  useEffect(load, [load])

  async function transition(targetStage: string) {
    if (!deal) return

    let reason: string | undefined
    if (REASON_REQUIRED.includes(targetStage)) {
      const entered = window.prompt(
        targetStage === "SOLD" ? "Причина закрытия сделки:" : "Почему сделка сорвалась?"
      )
      if (!entered) return
      reason = entered
    }

    setTransitioning(targetStage)
    setTransitionError(null)
    try {
      const res = await fetch(getApiUrl(`deal-room/${dealId}/transition`), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          targetStage,
          expectedVersion: deal.version,
          reason,
          // Финальный чек-лист пока подтверждается координатором вручную —
          // отдельной сущности чек-листа в схеме ещё нет.
          finalChecklistComplete: true,
        }),
      })
      const body = await res.json().catch(() => null)

      if (!res.ok) {
        const blockers: string[] = (body?.error?.blockers ?? []).map((b: any) => blockerLabel(b.code))
        setTransitionError(
          blockers.length > 0
            ? blockers.join("; ")
            : body?.error?.message || "Переход отклонён сервером."
        )
        // На конфликте версий перечитываем — кто-то изменил сделку параллельно.
        if (res.status === 409) load()
        return
      }

      load()
    } catch {
      setTransitionError("Не удалось связаться с сервером.")
    } finally {
      setTransitioning(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  if (error || !deal) {
    return (
      <div className="p-6">
        <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/deal-room")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          К списку сделок
        </Button>
        <Card className="mt-4">
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
            <AlertTriangle className="h-8 w-8" />
            <p>{error ?? "Сделка не найдена."}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const openBlockers = deal.risks.filter((r) => r.isBlocker && !r.resolvedAt)

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard/deal-room")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">
            {deal.property?.residentialComplex || deal.property?.address || "Сделка"}
          </h1>
          <p className="text-muted-foreground">
            {dealRoomStageLabel(deal.stage)}
            {deal.buyer ? ` · покупатель: ${deal.buyer.firstName} ${deal.buyer.lastName}` : ""}
          </p>
        </div>
        <Badge className={`ml-auto ${trafficLightClass(deal.trafficLight)}`}>
          {trafficLightLabel(deal.trafficLight)}
        </Badge>
      </div>

      {openBlockers.length > 0 && (
        <Card className="border-red-300 dark:border-red-900">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-red-700 dark:text-red-400">
              <AlertTriangle className="h-4 w-4" />
              Блокирующие риски ({openBlockers.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {openBlockers.map((r) => (
              <p key={r.id}>{r.description}</p>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Проверка (pre-check)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {deal.precheck ? (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Готовность</span>
                    <span className="font-semibold tabular-nums">{deal.precheck.completenessPercent}%</span>
                  </div>
                  <Separator />
                  <CheckRow label="Покупатель проверен" value={deal.precheck.buyerVerified} />
                  <CheckRow label="Продавец проверен" value={deal.precheck.sellerVerified} />
                  <CheckRow label="Объект проверен" value={deal.precheck.propertyVerified} />
                  <CheckRow label="Источник оплаты подтверждён" value={deal.precheck.paymentRouteConfirmed} />
                  <CheckRow label="Ипотечная часть подтверждена" value={deal.precheck.mortgagePartConfirmed} />
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Не хватает суммы</span>
                    <span className="font-medium tabular-nums">{formatTenge(deal.precheck.missingAmount)}</span>
                  </div>
                  {deal.precheck.notes && (
                    <p className="text-sm text-muted-foreground">{deal.precheck.notes}</p>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Проверка ещё не начиналась.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Задаток</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {deal.deposit ? (
                <>
                  <Row label="Статус" value={depositStatusLabel(deal.deposit.status)} />
                  <Row label="Сумма" value={formatTenge(deal.deposit.amount)} />
                  <Row
                    label="Проверен координатором"
                    value={deal.deposit.coordinatorVerified ? "да" : "нет"}
                  />
                  <p className="pt-2 text-xs text-muted-foreground">
                    CASA не принимает задаток. Деньги идут напрямую продавцу, координатор только
                    подтверждает факт перевода по документу.
                  </p>
                </>
              ) : (
                <p className="text-muted-foreground">Задаток ещё не заводился.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <History className="h-4 w-4" />
                История
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {deal.history.length === 0 && (
                <p className="text-sm text-muted-foreground">Пока ничего не происходило.</p>
              )}
              {deal.history.map((entry) => (
                <div key={entry.id} className="border-l-2 pl-3 text-sm">
                  <p className="font-medium">
                    {entry.newValues?.stage
                      ? dealRoomStageLabel(entry.newValues.stage)
                      : entry.action}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(entry.createdAt).toLocaleString("ru-RU")}
                    {entry.actor ? ` · ${entry.actor.firstName} ${entry.actor.lastName}` : ""}
                  </p>
                  {entry.reason && <p className="mt-0.5 text-xs text-muted-foreground">{entry.reason}</p>}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Следующий шаг</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {!canCoordinate && (
                <p className="text-sm text-muted-foreground">
                  Двигать сделку может координатор. У вас доступ только на чтение.
                </p>
              )}

              {canCoordinate && availableStages.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Сделка в терминальной стадии — дальше двигать некуда.
                </p>
              )}

              {canCoordinate &&
                availableStages.map((stage) => (
                  <Button
                    key={stage}
                    className="w-full justify-start"
                    variant={stage === "FAILED" ? "outline" : "default"}
                    disabled={transitioning !== null}
                    onClick={() => transition(stage)}
                  >
                    {transitioning === stage && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {dealRoomStageLabel(stage)}
                  </Button>
                ))}

              {transitionError && (
                <p className="flex items-start gap-1.5 pt-1 text-sm text-red-600 dark:text-red-400">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {transitionError}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Объект и участники</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Район" value={deal.property?.district || "—"} />
              <Row label="Адрес" value={deal.property?.address || "—"} />
              <Row label="Комнат" value={deal.property?.rooms ?? "—"} />
              <Row label="Площадь" value={deal.property?.area ? `${deal.property.area} м²` : "—"} />
              <Separator className="my-2" />
              <Row
                label="Покупатель"
                value={deal.buyer ? `${deal.buyer.firstName} ${deal.buyer.lastName}` : "—"}
              />
              <Row label="Телефон" value={deal.buyer?.phone || "—"} />
              <Row
                label="Координатор"
                value={
                  deal.coordinator ? `${deal.coordinator.firstName} ${deal.coordinator.lastName}` : "не назначен"
                }
              />
              <Separator className="my-2" />
              <Row label="Финальная цена" value={formatTenge(deal.finalPrice)} />
              {deal.outcomeReason && <Row label="Итог" value={deal.outcomeReason} />}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  )
}

function CheckRow({ label, value }: { label: string; value: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      {value ? (
        <span className="flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
          <ShieldCheck className="h-3.5 w-3.5" />
          да
        </span>
      ) : (
        <span className="font-medium text-muted-foreground">нет</span>
      )}
    </div>
  )
}
