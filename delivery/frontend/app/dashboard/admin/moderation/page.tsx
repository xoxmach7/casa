"use client"

import { useEffect, useState } from "react"
import { Check, X, HelpCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { getApiUrl, getAuthHeaders } from "@/lib/api-client"

interface ModerationProperty {
  id: string
  residentialComplex: string
  district: string
  address: string | null
  price: number
  status: string
  createdAt: string
  seller: { id: string; firstName: string; lastName: string; phone: string }
  broker: { id: string; firstName: string; lastName: string }
}

const STATUS_OPTIONS = [
  { value: "MODERATION", label: "Ожидают проверки" },
  { value: "NEEDS_INFORMATION", label: "Нужны уточнения" },
]

function formatPrice(price: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "KZT",
    maximumFractionDigits: 0,
  }).format(price)
}

export default function ModerationQueuePage() {
  const [status, setStatus] = useState("MODERATION")
  const [properties, setProperties] = useState<ModerationProperty[]>([])
  const [loading, setLoading] = useState(true)
  const [actingId, setActingId] = useState<string | null>(null)

  useEffect(() => {
    fetchQueue()
  }, [status])

  function fetchQueue() {
    setLoading(true)
    fetch(getApiUrl(`admin/moderation/properties?status=${status}`), { headers: getAuthHeaders() })
      .then((r) => (r.ok ? r.json() : []))
      .then(setProperties)
      .finally(() => setLoading(false))
  }

  async function decide(id: string, decision: "APPROVE" | "REJECT" | "NEEDS_INFO") {
    let reason: string | undefined
    if (decision !== "APPROVE") {
      reason = window.prompt("Причина (необязательно):") || undefined
    }
    setActingId(id)
    await fetch(getApiUrl(`admin/moderation/properties/${id}/decision`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ decision, reason }),
    })
    setActingId(null)
    fetchQueue()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Модерация каталога</h1>
          <p className="text-muted-foreground">Объекты, ожидающие проверки перед публикацией</p>
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
      ) : properties.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Очередь пуста.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {properties.map((p) => (
            <Card key={p.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {p.residentialComplex} — {p.district}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{p.address}</p>
                <p className="text-lg font-bold">{formatPrice(p.price)}</p>
                <p className="text-sm text-muted-foreground">
                  Собственник: {p.seller.firstName} {p.seller.lastName} · {p.seller.phone}
                </p>
                <p className="text-sm text-muted-foreground">
                  Брокер: {p.broker.firstName} {p.broker.lastName}
                </p>
                <div className="flex gap-2">
                  <Button size="sm" disabled={actingId === p.id} onClick={() => decide(p.id, "APPROVE")}>
                    <Check className="mr-1.5 h-4 w-4" />
                    Одобрить
                  </Button>
                  <Button size="sm" variant="outline" disabled={actingId === p.id} onClick={() => decide(p.id, "NEEDS_INFO")}>
                    <HelpCircle className="mr-1.5 h-4 w-4" />
                    Нужны уточнения
                  </Button>
                  <Button size="sm" variant="destructive" disabled={actingId === p.id} onClick={() => decide(p.id, "REJECT")}>
                    <X className="mr-1.5 h-4 w-4" />
                    Отклонить
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
