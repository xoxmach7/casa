"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Users, ListPlus } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { getApiUrl, getAuthHeaders } from "@/lib/api-client"

interface Selection {
  id: string
  name: string | null
  createdAt: string
  client: { id: string; firstName: string; lastName: string; phone: string }
  _count: { apartments: number }
}

export default function SelectionsPage() {
  const router = useRouter()
  const [selections, setSelections] = useState<Selection[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(getApiUrl("selections"), { headers: getAuthHeaders() })
      .then((r) => (r.ok ? r.json() : []))
      .then(setSelections)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Мои подборки</h1>
        <p className="text-muted-foreground">
          Квартиры из новостроек, подобранные под запросы клиентов
        </p>
      </div>

      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      )}

      {!loading && selections.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
            <ListPlus className="h-8 w-8" />
            <p>Пока нет подборок.</p>
            <p className="text-sm">
              Откройте «Новостройки», выберите ЖК и добавьте квартиру в подборку клиента из карточки квартиры.
            </p>
          </CardContent>
        </Card>
      )}

      {!loading && selections.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {selections.map((s) => (
            <Card
              key={s.id}
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={() => router.push(`/dashboard/selections/${s.id}`)}
            >
              <CardContent className="p-4 space-y-2">
                <p className="font-semibold">
                  {s.name || `Подборка для ${s.client.firstName} ${s.client.lastName}`}
                </p>
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Users className="h-3.5 w-3.5" />
                  {s.client.firstName} {s.client.lastName} · {s.client.phone}
                </p>
                <p className="text-sm text-muted-foreground">
                  {s._count.apartments} {s._count.apartments === 1 ? "квартира" : "квартир(ы)"}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
