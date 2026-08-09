"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { AlertTriangle, ArrowLeft, History, Lock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getApiUrl, getAuthHeaders } from "@/lib/api-client"
import {
  auditActionLabel,
  comparabilityLabel,
  formatRange,
  formatTenge,
  scaleLabel,
  valuationStatusLabel,
} from "@/lib/secondary-market"

interface ValuationVersion {
  id: string
  versionNumber: number
  preliminaryLow: string | null
  preliminaryHigh: string | null
  confirmedLow: string | null
  confirmedHigh: string | null
  urgentLow: string | null
  urgentHigh: string | null
  recommendedLaunchPrice: string | null
  maxLaunchPrice: string | null
  liquidity: string | null
  confidence: string | null
  decision: string | null
  reviewerReason: string | null
  reviewedAt: string | null
  isImmutable: boolean
  createdAt: string
  reviewer: { firstName: string; lastName: string } | null
  marketReference: {
    basePricePerM2Low: string
    basePricePerM2High: string
    sourceDate: string
  } | null
  comparables: {
    id: string
    sourceRef: string
    askingPrice: string
    totalArea: string
    pricePerM2: string | null
    compatibility: string
    included: boolean
    reasonExcluded: string | null
  }[]
}

interface ValuationDetail {
  id: string
  status: string
  currentVersion: number
  property: any
  versions: ValuationVersion[]
  history: {
    id: string
    action: string
    reason: string | null
    createdAt: string
    actor: { firstName: string; lastName: string } | null
  }[]
}

const DECISION_LABELS: Record<string, string> = {
  ACCEPTED: "Принято",
  ACCEPTED_WITH_PRICE_CONDITION: "Принято с условием по цене",
  REJECTED: "Отклонено",
}

export default function ValuationDetailPage() {
  const router = useRouter()
  const params = useParams()
  const valuationId = params.id as string

  const [valuation, setValuation] = useState<ValuationDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(getApiUrl(`valuations/${valuationId}`), { headers: getAuthHeaders() })
      .then(async (r) => {
        if (r.status === 403) throw new Error("Раздел доступен координатору и аналитику вторички.")
        if (r.status === 404) throw new Error("Оценка не найдена.")
        if (!r.ok) throw new Error("Не удалось загрузить оценку.")
        return r.json()
      })
      .then((body) => setValuation(body.data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [valuationId])

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  if (error || !valuation) {
    return (
      <div className="p-6">
        <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/valuations")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          К очереди оценки
        </Button>
        <Card className="mt-4">
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
            <AlertTriangle className="h-8 w-8" />
            <p>{error ?? "Оценка не найдена."}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const current = valuation.versions[0]
  const earlier = valuation.versions.slice(1)

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard/valuations")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">
            {valuation.property?.residentialComplex || valuation.property?.address || "Оценка объекта"}
          </h1>
          <p className="text-muted-foreground">
            {[
              valuation.property?.district,
              valuation.property?.rooms ? `${valuation.property.rooms}-комн.` : null,
              valuation.property?.area ? `${valuation.property.area} м²` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <Badge className="ml-auto">{valuationStatusLabel(valuation.status)}</Badge>
      </div>

      {!current && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Расчёт ещё не запускался — версии результата пока нет.
          </CardContent>
        </Card>
      )}

      {current && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-base">Версия {current.versionNumber}</CardTitle>
                {current.isImmutable && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Lock className="h-3 w-3" />
                    подтверждена, не редактируется
                  </span>
                )}
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row
                  label="Предварительный диапазон"
                  value={formatRange(current.preliminaryLow, current.preliminaryHigh)}
                />
                <Row
                  label="Подтверждённый диапазон"
                  value={formatRange(current.confirmedLow, current.confirmedHigh)}
                />
                <Row label="Срочная продажа" value={formatRange(current.urgentLow, current.urgentHigh)} />
                <Separator className="my-2" />
                <Row label="Рекомендуемая цена выхода" value={formatTenge(current.recommendedLaunchPrice)} />
                <Row label="Максимальная цена выхода" value={formatTenge(current.maxLaunchPrice)} />
                <Separator className="my-2" />
                <Row label="Ликвидность" value={scaleLabel(current.liquidity)} />
                <Row label="Уверенность в оценке" value={scaleLabel(current.confidence)} />
                <Row
                  label="Решение"
                  value={current.decision ? DECISION_LABELS[current.decision] ?? current.decision : "—"}
                />
                {current.reviewerReason && (
                  <p className="pt-2 text-muted-foreground">{current.reviewerReason}</p>
                )}
                {current.reviewer && current.reviewedAt && (
                  <p className="text-xs text-muted-foreground">
                    {current.reviewer.firstName} {current.reviewer.lastName} ·{" "}
                    {new Date(current.reviewedAt).toLocaleString("ru-RU")}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Аналоги ({current.comparables.filter((c) => c.included).length} в расчёте из{" "}
                  {current.comparables.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {current.comparables.length === 0 ? (
                  <p className="px-6 pb-6 text-sm text-muted-foreground">
                    Аналоги ещё не собраны. Без них подтвердить оценку нельзя.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Источник</TableHead>
                          <TableHead>Цена</TableHead>
                          <TableHead>Площадь</TableHead>
                          <TableHead>За м²</TableHead>
                          <TableHead>Схожесть</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {current.comparables.map((c) => (
                          <TableRow key={c.id} className={c.included ? "" : "opacity-50"}>
                            <TableCell className="max-w-[16rem] truncate" title={c.sourceRef}>
                              {c.sourceRef}
                              {!c.included && (
                                <div className="text-xs text-muted-foreground">
                                  исключён{c.reasonExcluded ? `: ${c.reasonExcluded}` : ""}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="tabular-nums">{formatTenge(c.askingPrice)}</TableCell>
                            <TableCell className="tabular-nums">{c.totalArea} м²</TableCell>
                            <TableCell className="tabular-nums">{formatTenge(c.pricePerM2)}</TableCell>
                            <TableCell>
                              <Badge variant="secondary">{comparabilityLabel(c.compatibility)}</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {earlier.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Предыдущие версии</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {earlier.map((v) => (
                    <div key={v.id} className="flex items-baseline justify-between gap-3 border-b pb-2 last:border-0">
                      <span className="text-muted-foreground">
                        Версия {v.versionNumber} · {new Date(v.createdAt).toLocaleDateString("ru-RU")}
                      </span>
                      <span className="text-right tabular-nums">
                        {formatRange(
                          v.confirmedLow ?? v.preliminaryLow,
                          v.confirmedHigh ?? v.preliminaryHigh
                        )}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Рыночный эталон</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {current.marketReference ? (
                  <>
                    <Row
                      label="Цена за м²"
                      value={formatRange(
                        current.marketReference.basePricePerM2Low,
                        current.marketReference.basePricePerM2High
                      )}
                    />
                    <Row
                      label="Дата источника"
                      value={new Date(current.marketReference.sourceDate).toLocaleDateString("ru-RU")}
                    />
                  </>
                ) : (
                  <p className="text-muted-foreground">
                    Эталона по этому ЖК и району нет — поэтому заявка ушла на ручной разбор, а не
                    получила придуманную цену.
                  </p>
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
                {valuation.history.length === 0 && (
                  <p className="text-sm text-muted-foreground">Пока ничего не происходило.</p>
                )}
                {valuation.history.map((entry) => (
                  <div key={entry.id} className="border-l-2 pl-3 text-sm">
                    <p className="font-medium">{auditActionLabel(entry.action)}</p>
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
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium tabular-nums">{value}</span>
    </div>
  )
}
