"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Loader2, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getApiUrl } from "@/lib/api-client"

interface PublicApartment {
  id: string
  number: string
  floor: number
  rooms: number
  area: number
  price: number
  status: string
  project: { id: string; name: string; address: string; district: string }
}

interface PublicSelection {
  name: string | null
  status: string
  createdAt: string
  apartments: PublicApartment[]
}

function formatPrice(price: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "KZT",
    maximumFractionDigits: 0,
  }).format(price)
}

export default function PublicSelectionPage() {
  const { token } = useParams<{ token: string }>()
  const [selection, setSelection] = useState<PublicSelection | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    fetch(getApiUrl(`public/selections/${token}`))
      .then((r) => {
        if (!r.ok) throw new Error()
        return r.json()
      })
      .then((data) => {
        setSelection(data)
        if (data.status === "CLIENT_SELECTED") {
          // We don't know which apartment was picked from this payload alone,
          // so just show the general "выбор сделан" state.
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [token])

  async function selectApartment(apartmentId: string) {
    setSelectedId(apartmentId)
    await fetch(getApiUrl(`public/selections/${token}/apartments/${apartmentId}/select`), {
      method: "POST",
    })
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (notFound || !selection) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center text-muted-foreground">
        Подборка не найдена или ссылка больше не действует.
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">{selection.name || "Ваша подборка квартир"}</h1>
        <p className="text-muted-foreground">Подобрано специально для вас — выберите понравившийся вариант</p>
      </div>

      {selection.apartments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            В подборке пока нет квартир.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {selection.apartments.map((apartment) => {
            const isSelected = selectedId === apartment.id || selection.status === "CLIENT_SELECTED"
            return (
              <Card key={apartment.id} className={isSelected ? "ring-2 ring-primary" : ""}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    {apartment.project.name} — № {apartment.number}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    {apartment.project.district}, {apartment.project.address}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {apartment.rooms}-комн. · {apartment.area} м² · {apartment.floor} этаж
                  </p>
                  <p className="text-lg font-bold">{formatPrice(apartment.price)}</p>
                  <Button
                    className="w-full"
                    variant={selectedId === apartment.id ? "secondary" : "default"}
                    onClick={() => selectApartment(apartment.id)}
                    disabled={selectedId === apartment.id}
                  >
                    {selectedId === apartment.id ? (
                      <>
                        <Check className="mr-1.5 h-4 w-4" />
                        Выбрано
                      </>
                    ) : (
                      "Эта квартира понравилась"
                    )}
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
