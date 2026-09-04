"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Handshake, AlertTriangle, User } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { getApiUrl, getAuthHeaders } from "@/lib/api-client"
import {
  DEAL_ROOM_PHASES,
  dealRoomStageLabel,
  formatTenge,
  trafficLightClass,
  trafficLightLabel,
} from "@/lib/secondary-market"
import { SecondaryTabs } from "@/components/marketplace/SecondaryTabs"

interface DealRoomListItem {
  id: string
  stage: string
  trafficLight: string
  finalPrice: string | null
  updatedAt: string
  property: {
    id: string
    residentialComplex: string | null
    district: string | null
    address: string | null
    rooms: number | null
    area: string | null
  } | null
  buyer: { id: string; firstName: string; lastName: string; phone: string } | null
  coordinator: { id: string; firstName: string; lastName: string } | null
  precheck: { completenessPercent: number; hasBlockingRisk: boolean } | null
  deposit: { status: string; amount: string | null } | null
}

export default function DealRoomBoardPage() {
  const router = useRouter()
  const [deals, setDeals] = useState<DealRoomListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [includeClosed, setIncludeClosed] = useState(false)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(getApiUrl(`deal-room?includeClosed=${includeClosed}&limit=100`), { headers: getAuthHeaders() })
      .then(async (r) => {
        if (r.status === 403) throw new Error("Раздел доступен координатору и аналитику вторички.")
        if (!r.ok) throw new Error("Не удалось загрузить сделки.")
        return r.json()
      })
      .then((body) => setDeals(body.data ?? []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [includeClosed])

  const phases = DEAL_ROOM_PHASES.filter((p) => includeClosed || p.key !== "outcome")

  return (
    <div className="p-6 space-y-6">
      <SecondaryTabs />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Сделки (вторичка)</h1>
          <p className="text-muted-foreground">
            Комната сделки: от оффера до регистрации. Задаток и бронь открываются только после Green 2.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="include-closed" checked={includeClosed} onCheckedChange={setIncludeClosed} />
          <Label htmlFor="include-closed" className="text-sm text-muted-foreground">
            Показать завершённые
          </Label>
        </div>
      </div>

      {loading && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      )}

      {!loading && error && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
            <AlertTriangle className="h-8 w-8" />
            <p>{error}</p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && deals.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
            <Handshake className="h-8 w-8" />
            <p>Пока нет открытых сделок.</p>
            <p className="text-sm">
              Комната сделки открывается автоматически, когда покупатель подаёт первый формальный оффер по объекту.
            </p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && deals.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {phases.map((phase) => {
            const inPhase = deals.filter((d) => phase.stages.includes(d.stage as never))
            return (
              <div key={phase.key} className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    {phase.title}
                  </h2>
                  <span className="text-sm tabular-nums text-muted-foreground">{inPhase.length}</span>
                </div>

                {inPhase.length === 0 && (
                  <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                    пусто
                  </div>
                )}

                {inPhase.map((deal) => (
                  <Card
                    key={deal.id}
                    className="cursor-pointer transition-colors hover:border-primary"
                    onClick={() => router.push(`/dashboard/deal-room/${deal.id}`)}
                  >
                    <CardContent className="space-y-2 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold leading-tight">
                          {deal.property?.residentialComplex || deal.property?.address || "Объект без названия"}
                        </p>
                        <Badge className={trafficLightClass(deal.trafficLight)}>
                          {trafficLightLabel(deal.trafficLight)}
                        </Badge>
                      </div>

                      <p className="text-xs text-muted-foreground">
                        {[deal.property?.district, deal.property?.rooms ? `${deal.property.rooms}-комн.` : null,
                          deal.property?.area ? `${deal.property.area} м²` : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>

                      <p className="text-sm">{dealRoomStageLabel(deal.stage)}</p>

                      {deal.buyer && (
                        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <User className="h-3 w-3 shrink-0" />
                          {deal.buyer.firstName} {deal.buyer.lastName}
                        </p>
                      )}

                      {deal.finalPrice && (
                        <p className="text-sm font-semibold tabular-nums">{formatTenge(deal.finalPrice)}</p>
                      )}

                      {deal.precheck?.hasBlockingRisk && (
                        <p className="flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400">
                          <AlertTriangle className="h-3 w-3 shrink-0" />
                          Блокирующий риск
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
