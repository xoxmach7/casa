"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Calculator } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
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
import { formatRange, valuationNeedsAttention, valuationStatusLabel } from "@/lib/secondary-market"
import { SecondaryTabs } from "@/components/marketplace/SecondaryTabs"

interface ValuationListItem {
  id: string
  status: string
  currentVersion: number
  updatedAt: string
  property: {
    id: string
    residentialComplex: string | null
    district: string | null
    address: string | null
    rooms: number | null
    area: string | null
  } | null
  versions: {
    versionNumber: number
    preliminaryLow: string | null
    preliminaryHigh: string | null
    confirmedLow: string | null
    confirmedHigh: string | null
  }[]
}

export default function ValuationsPage() {
  const router = useRouter()
  const [valuations, setValuations] = useState<ValuationListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(getApiUrl("valuations?limit=100"), { headers: getAuthHeaders() })
      .then(async (r) => {
        if (r.status === 403) throw new Error("Раздел доступен координатору и аналитику вторички.")
        if (!r.ok) throw new Error("Не удалось загрузить очередь оценки.")
        return r.json()
      })
      .then((body) => setValuations(body.data ?? []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const attention = valuations.filter((v) => valuationNeedsAttention(v.status)).length

  return (
    <div className="space-y-6 p-6">
      <SecondaryTabs />
      <div>
        <h1 className="text-2xl font-bold">Оценка объектов</h1>
        <p className="text-muted-foreground">
          Внутренний пайплайн оценки вторички. Цена без подтверждения человеком наружу не уходит.
        </p>
      </div>

      {!loading && !error && attention > 0 && (
        <Card className="border-amber-300 dark:border-amber-900">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-sm">
              <span className="font-semibold tabular-nums">{attention}</span> заяв(ок) ждут человека —
              ручной разбор или подтверждение результата.
            </p>
          </CardContent>
        </Card>
      )}

      {loading && <Skeleton className="h-64 rounded-xl" />}

      {!loading && error && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
            <AlertTriangle className="h-8 w-8" />
            <p>{error}</p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && valuations.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
            <Calculator className="h-8 w-8" />
            <p>Очередь пуста.</p>
            <p className="text-sm">
              Заявка на оценку создаётся по объекту вторички — из карточки объекта в разделе «Клиенты».
            </p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && valuations.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Объект</TableHead>
                  <TableHead>Параметры</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Диапазон</TableHead>
                  <TableHead className="text-right">Обновлено</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {valuations.map((v) => {
                  const latest = v.versions[0]
                  const range = latest
                    ? latest.confirmedLow || latest.confirmedHigh
                      ? formatRange(latest.confirmedLow, latest.confirmedHigh)
                      : formatRange(latest.preliminaryLow, latest.preliminaryHigh)
                    : "—"

                  return (
                    <TableRow
                      key={v.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/dashboard/valuations/${v.id}`)}
                    >
                      <TableCell className="font-medium">
                        {v.property?.residentialComplex || v.property?.address || "Объект"}
                        <div className="text-xs font-normal text-muted-foreground">
                          {v.property?.district || "—"}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {[
                          v.property?.rooms ? `${v.property.rooms}-комн.` : null,
                          v.property?.area ? `${v.property.area} м²` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={valuationNeedsAttention(v.status) ? "default" : "secondary"}>
                          {valuationStatusLabel(v.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="tabular-nums">{range}</TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {new Date(v.updatedAt).toLocaleDateString("ru-RU")}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
