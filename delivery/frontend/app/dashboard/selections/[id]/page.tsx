"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Phone, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { getApiUrl, getAuthHeaders } from "@/lib/api-client"

interface SelectionDetail {
  id: string
  name: string | null
  client: { id: string; firstName: string; lastName: string; phone: string }
  apartments: {
    id: string
    apartment: {
      id: string
      number: string
      floor: number
      rooms: number
      area: number
      price: number
      status: string
      project: { id: string; name: string; address: string }
    }
  }[]
}

function formatPrice(price: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "KZT",
    maximumFractionDigits: 0,
  }).format(price)
}

export default function SelectionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [selection, setSelection] = useState<SelectionDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSelection()
  }, [id])

  function fetchSelection() {
    setLoading(true)
    fetch(getApiUrl(`selections/${id}`), { headers: getAuthHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then(setSelection)
      .finally(() => setLoading(false))
  }

  async function removeApartment(apartmentId: string) {
    await fetch(getApiUrl(`selections/${id}/apartments/${apartmentId}`), {
      method: "DELETE",
      headers: getAuthHeaders(),
    })
    fetchSelection()
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
    )
  }

  if (!selection) {
    return <div className="p-6 text-muted-foreground">Подборка не найдена.</div>
  }

  return (
    <div className="p-6 space-y-6">
      <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/selections")}>
        <ArrowLeft className="mr-1.5 h-4 w-4" />
        К подборкам
      </Button>

      <div>
        <h1 className="text-2xl font-bold">
          {selection.name || `Подборка для ${selection.client.firstName} ${selection.client.lastName}`}
        </h1>
        <p className="flex items-center gap-1.5 text-muted-foreground">
          <Phone className="h-3.5 w-3.5" />
          {selection.client.firstName} {selection.client.lastName} · {selection.client.phone}
        </p>
      </div>

      {selection.apartments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            В подборке пока нет квартир.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {selection.apartments.map(({ apartment }) => (
            <Card key={apartment.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {apartment.project.name} — № {apartment.number}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">{apartment.project.address}</p>
                <p className="text-sm text-muted-foreground">
                  {apartment.rooms}-комн. · {apartment.area} м² · {apartment.floor} этаж
                </p>
                <p className="text-lg font-bold">{formatPrice(apartment.price)}</p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => router.push(`/dashboard/projects/${apartment.project.id}`)}
                  >
                    Открыть ЖК
                  </Button>
                  <Button size="sm" variant="ghost" className="text-red-600" onClick={() => removeApartment(apartment.id)}>
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    Убрать
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
