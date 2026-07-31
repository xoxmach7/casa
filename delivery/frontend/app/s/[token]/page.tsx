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
  selectedApartmentId: string | null
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
  const [selectingId, setSelectingId] = useState<string | null>(null)
  const [selectError, setSelectError] = useState<string | null>(null)

  useEffect(() => {
    fetch(getApiUrl(`public/selections/${token}`))
      .then((r) => {
        if (!r.ok) throw new Error()
        return r.json()
      })
      .then((data) => {
        setSelection(data)
        setSelectedId(data.selectedApartmentId ?? null)
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [token])

  async function selectApartment(apartmentId: string) {
    setSelectError(null)
    setSelectingId(apartmentId)
    try {
      const res = await fetch(getApiUrl(`public/selections/${token}/apartments/${apartmentId}/select`), {
        method: "POST",
      })
      if (!res.ok) throw new Error()
      setSelectedId(apartmentId)
      setSelection((prev) => (prev ? { ...prev, status: "CLIENT_SELECTED", selectedApartmentId: apartmentId } : prev))
    } catch {
      setSelectError("Не удалось сохранить выбор. Попробуйте ещё раз.")
    } finally {
      setSelectingId(null)
    }
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

      {selectError && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-600">{selectError}</p>
      )}

      {selection.apartments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            В подборке пока нет квартир.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {selection.apartments.map((apartment) => {
            const isSelected = selectedId === apartment.id
            const isSelecting = selectingId === apartment.id
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
                    variant={isSelected ? "secondary" : "default"}
                    onClick={() => selectApartment(apartment.id)}
                    disabled={isSelected || isSelecting}
                  >
                    {isSelecting ? (
                      <>
                        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                        Сохранение...
                      </>
                    ) : isSelected ? (
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
