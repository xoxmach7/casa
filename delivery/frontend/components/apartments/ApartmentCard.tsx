"use client"

import { Image as ImageIcon, Home, ListPlus, Calculator } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"

export interface ApartmentCardData {
  id: string
  number: string
  floor: number
  rooms: number
  area: number
  price: number
  status: "AVAILABLE" | "RESERVED" | "SOLD"
  layoutImage?: string
}

interface ApartmentCardProps {
  apartment: ApartmentCardData
  onViewLayout?: (apartment: ApartmentCardData) => void
  onBook?: (apartment: ApartmentCardData) => void
  onAddToSelection?: (apartment: ApartmentCardData) => void
  onCalculateMortgage?: (apartment: ApartmentCardData) => void
}

function formatPrice(price: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "KZT",
    maximumFractionDigits: 0,
  }).format(price)
}

function StatusBadge({ status }: { status: ApartmentCardData["status"] }) {
  switch (status) {
    case "AVAILABLE":
      return <Badge className="bg-green-500">Свободна</Badge>
    case "RESERVED":
      return <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-600">Бронь</Badge>
    case "SOLD":
      return <Badge variant="secondary" className="bg-red-500/20 text-red-600">Продана</Badge>
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

export function ApartmentCard({
  apartment,
  onViewLayout,
  onBook,
  onAddToSelection,
  onCalculateMortgage,
}: ApartmentCardProps) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => apartment.layoutImage && onViewLayout?.(apartment)}
            className="h-20 w-20 shrink-0 rounded border overflow-hidden hover:border-primary transition-colors disabled:cursor-default"
            disabled={!apartment.layoutImage}
          >
            {apartment.layoutImage ? (
              <img
                src={apartment.layoutImage}
                alt={`Планировка №${apartment.number}`}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-muted">
                <ImageIcon className="h-5 w-5 text-muted-foreground/30" />
              </div>
            )}
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">№ {apartment.number}</p>
                <p className="text-sm text-muted-foreground">
                  {apartment.rooms}-комн. · {apartment.area} м² · {apartment.floor} этаж
                </p>
              </div>
              <StatusBadge status={apartment.status} />
            </div>
            <p className="mt-1 text-lg font-bold">{formatPrice(apartment.price)}</p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {apartment.status === "AVAILABLE" && onBook && (
            <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => onBook(apartment)}>
              <Home className="mr-1.5 h-3.5 w-3.5" />
              Забронировать
            </Button>
          )}
          {onAddToSelection && (
            <Button size="sm" variant="outline" onClick={() => onAddToSelection(apartment)}>
              <ListPlus className="mr-1.5 h-3.5 w-3.5" />
              В подборку
            </Button>
          )}
          {onCalculateMortgage && (
            <Button size="sm" variant="outline" onClick={() => onCalculateMortgage(apartment)}>
              <Calculator className="mr-1.5 h-3.5 w-3.5" />
              Рассчитать ипотеку
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
