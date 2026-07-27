"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { API_URL } from "@/lib/config"

interface Property {
  id: string
  title: string
  price: number
  seller?: {
    firstName: string
    lastName: string
  }
  buyer?: {
    id: string
    firstName: string
    lastName: string
  }
}

export default function NewDealPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const propertyId = searchParams.get("propertyId")

  const [loading, setLoading] = useState(false)
  const [property, setProperty] = useState<Property | null>(null)
  const [formData, setFormData] = useState({
    amount: "",
    commission: "",
    casaFee: "",
    objectType: "PROPERTY",
    objectId: propertyId || "",
    clientId: "",
    notes: "",
  })

  useEffect(() => {
    if (propertyId) {
      fetchProperty()
    }
  }, [propertyId])

  const fetchProperty = async () => {
    const token = localStorage.getItem("token")
    if (!token || !propertyId) return

    try {
      const res = await fetch(`${API_URL}/properties/${propertyId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (res.ok) {
        const data = await res.json()
        setProperty(data)
        setFormData((prev) => ({
          ...prev,
          amount: data.price.toString(),
          objectId: data.id,
          clientId: data.buyer?.id || "",
        }))
      }
    } catch (error) {
      console.error("Failed to fetch property:", error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const token = localStorage.getItem("token")
    if (!token) return

    try {
      const payload = {
        amount: parseFloat(formData.amount),
        commission: parseFloat(formData.commission),
        casaFee: parseFloat(formData.casaFee),
        objectType: formData.objectType,
        objectId: formData.objectId || undefined,
        clientId: formData.clientId || undefined,
        notes: formData.notes || undefined,
      }

      const res = await fetch(`${API_URL}/deals`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        const deal = await res.json()
        router.push(`/dashboard/deals/${deal.id}`)
      } else {
        const error = await res.json()
        alert(error.message || "Ошибка при создании сделки")
      }
    } catch (error) {
      console.error("Failed to create deal:", error)
      alert("Ошибка при создании сделки")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-3xl font-bold tracking-tight">Новая сделка</h2>
      </div>

      {property && (
        <Card>
          <CardHeader>
            <CardTitle>Информация об объекте</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Объект:</span>
                <span className="font-medium">{property.title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Цена:</span>
                <span className="font-medium">{Number(property.price).toLocaleString()} ₸</span>
              </div>
              {property.seller && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Продавец:</span>
                  <span className="font-medium">
                    {property.seller.firstName} {property.seller.lastName}
                  </span>
                </div>
              )}
              {property.buyer && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Покупатель:</span>
                  <span className="font-medium">
                    {property.buyer.firstName} {property.buyer.lastName}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Детали сделки</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="amount">Сумма сделки (₸) *</Label>
              <Input
                id="amount"
                type="number"
                required
                min="0"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="Введите сумму"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="commission">Комиссия брокера (₸) *</Label>
              <Input
                id="commission"
                type="number"
                required
                min="0"
                step="0.01"
                value={formData.commission}
                onChange={(e) => setFormData({ ...formData, commission: e.target.value })}
                placeholder="Ваша комиссия"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="casaFee">Casa Fee (₸) *</Label>
              <Input
                id="casaFee"
                type="number"
                required
                min="0"
                step="0.01"
                value={formData.casaFee}
                onChange={(e) => setFormData({ ...formData, casaFee: e.target.value })}
                placeholder="Комиссия Casa.kz"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="objectType">Тип объекта *</Label>
              <Select
                value={formData.objectType}
                onValueChange={(value) => setFormData({ ...formData, objectType: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PROPERTY">Вторичка</SelectItem>
                  <SelectItem value="APARTMENT">Новостройка</SelectItem>
                  <SelectItem value="BOOKING">Бронь</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="notes">Примечания</Label>
              <Textarea
                id="notes"
                rows={4}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Дополнительная информация о сделке..."
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4 mt-6">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Отмена
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "Создание..." : "Создать сделку"}
          </Button>
        </div>
      </form>
    </div>
  )
}
