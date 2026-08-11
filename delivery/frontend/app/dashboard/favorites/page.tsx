"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Star, Building2, X } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { getApiUrl, getAuthHeaders } from "@/lib/api-client"

interface Favorite {
  id: string
  apartmentId: string
  apartment: {
    id: string
    number: string
    floor: number
    rooms: number
    area: string
    price: string
    status: "AVAILABLE" | "RESERVED" | "SOLD"
    project: { id: string; name: string; city: string; address: string } | null
  }
}

const STATUS_LABEL: Record<Favorite["apartment"]["status"], string> = {
  AVAILABLE: "Доступно",
  RESERVED: "Фиксация",
  SOLD: "Продано",
}
const STATUS_BADGE: Record<Favorite["apartment"]["status"], string> = {
  AVAILABLE: "bg-green-500",
  RESERVED: "bg-yellow-500",
  SOLD: "bg-gray-500",
}

function formatPrice(price: string) {
  return new Intl.NumberFormat("ru-KZ", {
    style: "currency",
    currency: "KZT",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(parseFloat(price))
}

export default function FavoritesPage() {
  const router = useRouter()
  const [favorites, setFavorites] = useState<Favorite[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(getApiUrl("favorites"), { headers: getAuthHeaders() })
      .then((r) => (r.ok ? r.json() : []))
      .then(setFavorites)
      .finally(() => setLoading(false))
  }, [])

  async function remove(apartmentId: string) {
    setFavorites((prev) => prev.filter((f) => f.apartmentId !== apartmentId))
    try {
      await fetch(getApiUrl(`favorites/${apartmentId}`), { method: "DELETE", headers: getAuthHeaders() })
    } catch {
      /* при ошибке список перезагрузится на следующем заходе */
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Избранное</h1>
        <p className="text-muted-foreground">
          Быстрые закладки на квартиры — без привязки к клиенту
        </p>
      </div>

      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      )}

      {!loading && favorites.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
            <Star className="h-8 w-8" />
            <p>В избранном пока пусто.</p>
            <p className="text-sm">
              Откройте «Новостройки», выберите квартиру и нажмите звёздочку в карточке квартиры.
            </p>
          </CardContent>
        </Card>
      )}

      {!loading && favorites.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {favorites.map((f) => (
            <Card key={f.id} className="group relative transition-colors hover:border-primary">
              <CardContent className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <button
                    className="text-left"
                    onClick={() =>
                      f.apartment.project &&
                      router.push(`/dashboard/projects/${f.apartment.project.id}/apartments`)
                    }
                  >
                    <p className="flex items-center gap-1.5 font-semibold">
                      <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      {f.apartment.project?.name ?? "ЖК"} · №{f.apartment.number}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {f.apartment.rooms}-комн, {f.apartment.floor} этаж, {f.apartment.area} м²
                    </p>
                    <p className="mt-1 font-medium">{formatPrice(f.apartment.price)}</p>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-muted-foreground"
                    title="Убрать из избранного"
                    onClick={() => remove(f.apartmentId)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <Badge className={STATUS_BADGE[f.apartment.status]}>
                  {STATUS_LABEL[f.apartment.status]}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
