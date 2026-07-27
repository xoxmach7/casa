"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams, useSearchParams } from "next/navigation"
import { ArrowLeft, Edit, MapPin, Home, Users, DollarSign, UserPlus, UserMinus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { API_URL } from "@/lib/config"
import { toast } from "@/hooks/use-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface Property {
  id: string
  title: string
  propertyType: string
  city: string
  district?: string
  address: string
  floor?: number
  rooms?: number
  area: number
  price: number
  status: string
  description?: string
  images: string[]
  features: string[]
  createdAt: string
  broker: {
    firstName: string
    lastName: string
    email: string
    phone: string
  }
  seller?: {
    firstName: string
    lastName: string
    phone: string
    email: string
  }
  buyer?: {
    firstName: string
    lastName: string
    phone: string
    email: string
  }
}

interface Client {
  id: string
  firstName: string
  lastName: string
  phone: string
}

export default function PropertyDetailPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const fromCRM = searchParams.get('from') === 'crm'
  const [property, setProperty] = useState<Property | null>(null)
  const [loading, setLoading] = useState(true)
  const [buyers, setBuyers] = useState<Client[]>([])
  const [selectedBuyer, setSelectedBuyer] = useState("")
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  useEffect(() => {
    if (params.id) {
      fetchProperty()
      fetchBuyers()
    }
  }, [params.id])

  const fetchProperty = async () => {
    const token = localStorage.getItem("token")
    if (!token) return

    try {
      const res = await fetch(`${API_URL}/properties/${params.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (res.ok) {
        const data = await res.json()
        setProperty(data)
      }
    } catch (error) {
      console.error("Failed to fetch property:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchBuyers = async () => {
    const token = localStorage.getItem("token")
    if (!token) return

    try {
      const res = await fetch(`${API_URL}/clients?clientType=BUYER&limit=100`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (res.ok) {
        const data = await res.json()
        setBuyers(data.clients)
      }
    } catch (error) {
      console.error("Failed to fetch buyers:", error)
    }
  }

  const handleAssignBuyer = async () => {
    if (!selectedBuyer || !property) return

    setAssigning(true)
    const token = localStorage.getItem("token")

    try {
      const res = await fetch(`${API_URL}/properties/${property.id}/assign-buyer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ buyerId: selectedBuyer }),
      })

      if (res.ok) {
        const updated = await res.json()
        setProperty(updated)
        setAssignDialogOpen(false)
        setSelectedBuyer("")
      } else {
        alert("Ошибка при назначении покупателя")
      }
    } catch (error) {
      console.error("Failed to assign buyer:", error)
      alert("Ошибка при назначении покупателя")
    } finally {
      setAssigning(false)
    }
  }

  const handleUnassignBuyer = async () => {
    if (!property) return

    if (!confirm("Снять покупателя с объекта?")) return

    const token = localStorage.getItem("token")

    try {
      const res = await fetch(`${API_URL}/properties/${property.id}/unassign-buyer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      })

      if (res.ok) {
        const updated = await res.json()
        setProperty(updated)
      } else {
        alert("Ошибка при снятии покупателя")
      }
    } catch (error) {
      console.error("Failed to unassign buyer:", error)
      alert("Ошибка при снятии покупателя")
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    if (!property) return
    
    setUpdatingStatus(true)
    const token = localStorage.getItem("token")

    try {
      const res = await fetch(`${API_URL}/properties/${property.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      })

      if (res.ok) {
        const updated = await res.json()
        setProperty(updated)
        toast({ 
          title: "Статус обновлён", 
          description: `Объект теперь: ${getStatusLabel(newStatus)}` 
        })
      } else {
        toast({ 
          title: "Ошибка", 
          description: "Не удалось обновить статус", 
          variant: "destructive" 
        })
      }
    } catch (error) {
      console.error("Failed to update status:", error)
      toast({ 
        title: "Ошибка", 
        description: "Ошибка при обновлении статуса", 
        variant: "destructive" 
      })
    } finally {
      setUpdatingStatus(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACTIVE": return "#10b981"
      case "RESERVED": return "#f59e0b"
      case "SOLD": return "#6366f1"
      case "ARCHIVED": return "#ef4444"
      default: return "#6b7280"
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "ACTIVE": return "Активен"
      case "RESERVED": return "Забронирован"
      case "SOLD": return "Продан"
      case "ARCHIVED": return "Снят с публикации"
      default: return status
    }
  }

  const getPropertyTypeLabel = (type: string) => {
    switch (type) {
      case "APARTMENT": return "Квартира"
      case "HOUSE": return "Дом"
      case "COMMERCIAL": return "Коммерция"
      case "LAND": return "Участок"
      default: return type
    }
  }

  if (loading) {
    return (
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <div className="text-center py-8">Загрузка...</div>
      </div>
    )
  }

  if (!property) {
    return (
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <div className="text-center py-8">Объект не найден</div>
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => fromCRM ? router.push('/dashboard/crm?tab=objects') : router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          {fromCRM && (
            <Button variant="outline" size="sm" onClick={() => router.push('/dashboard/crm?tab=objects')}>
              Вернуться в CRM
            </Button>
          )}
          <div>
            <h2 className="text-3xl font-bold tracking-tight">{property.title}</h2>
            <p className="text-muted-foreground">ID: {property.id}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {property.status === "ACTIVE" && !property.buyer && (
            <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <UserPlus className="mr-2 h-4 w-4" />
                  Назначить покупателя
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Назначить покупателя</DialogTitle>
                  <DialogDescription>
                    Выберите клиента-покупателя для этого объекта
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <Select value={selectedBuyer} onValueChange={setSelectedBuyer}>
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите покупателя" />
                    </SelectTrigger>
                    <SelectContent>
                      {buyers.map((buyer) => (
                        <SelectItem key={buyer.id} value={buyer.id}>
                          {buyer.firstName} {buyer.lastName} ({buyer.phone})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setAssignDialogOpen(false)}
                    >
                      Отмена
                    </Button>
                    <Button
                      onClick={handleAssignBuyer}
                      disabled={!selectedBuyer || assigning}
                    >
                      {assigning ? "Назначение..." : "Назначить"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
          {property.buyer && property.status === "RESERVED" && (
            <Button variant="outline" onClick={handleUnassignBuyer}>
              <UserMinus className="mr-2 h-4 w-4" />
              Снять покупателя
            </Button>
          )}
          <Button onClick={() => router.push(`/dashboard/properties/${property.id}/edit`)}>
            <Edit className="mr-2 h-4 w-4" />
            Редактировать
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Информация об объекте</CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Статус:</span>
                <Select 
                  value={property.status} 
                  onValueChange={handleStatusChange}
                  disabled={updatingStatus}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getStatusColor(property.status) }} />
                        {getStatusLabel(property.status)}
                      </div>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        Активен
                      </div>
                    </SelectItem>
                    <SelectItem value="RESERVED">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-yellow-500" />
                        Забронирован
                      </div>
                    </SelectItem>
                    <SelectItem value="SOLD">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-purple-500" />
                        Продан
                      </div>
                    </SelectItem>
                    <SelectItem value="ARCHIVED">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-red-500" />
                        Снят с публикации
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Images */}
            {property.images && property.images.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {property.images.map((image, index) => (
                  <img
                    key={index}
                    src={image}
                    alt={`Фото ${index + 1}`}
                    className="w-full h-48 object-cover rounded"
                  />
                ))}
              </div>
            )}

            <div className="grid gap-4">
              <div className="flex items-center gap-2">
                <Home className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Тип объекта</p>
                  <p className="font-medium">{getPropertyTypeLabel(property.propertyType)}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Адрес</p>
                  <p className="font-medium">{property.address}</p>
                  <p className="text-sm text-muted-foreground">
                    {property.city}{property.district && `, ${property.district}`}
                  </p>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {property.rooms && (
                  <div>
                    <p className="text-sm text-muted-foreground">Комнат</p>
                    <p className="text-lg font-semibold">{property.rooms}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">Площадь</p>
                  <p className="text-lg font-semibold">{property.area} м²</p>
                </div>
                {property.floor && (
                  <div>
                    <p className="text-sm text-muted-foreground">Этаж</p>
                    <p className="text-lg font-semibold">{property.floor}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">Цена</p>
                  <p className="text-lg font-semibold text-green-600">
                    {Number(property.price).toLocaleString()} ₸
                  </p>
                </div>
              </div>

              {property.description && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Описание</p>
                    <p className="text-sm">{property.description}</p>
                  </div>
                </>
              )}

              {property.features && property.features.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Особенности</p>
                    <div className="flex flex-wrap gap-2">
                      {property.features.map((feature, index) => (
                        <Badge key={index} variant="outline">
                          {feature}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Участники
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Брокер</p>
                <p className="font-medium">{property.broker.firstName} {property.broker.lastName}</p>
                <p className="text-sm text-muted-foreground">{property.broker.phone}</p>
                <p className="text-sm text-muted-foreground">{property.broker.email}</p>
              </div>

              {property.seller && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Продавец</p>
                    <p className="font-medium">{property.seller.firstName} {property.seller.lastName}</p>
                    <p className="text-sm text-muted-foreground">{property.seller.phone}</p>
                    {property.seller.email && (
                      <p className="text-sm text-muted-foreground">{property.seller.email}</p>
                    )}
                  </div>
                </>
              )}

              {property.buyer && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Покупатель</p>
                    <p className="font-medium">{property.buyer.firstName} {property.buyer.lastName}</p>
                    <p className="text-sm text-muted-foreground">{property.buyer.phone}</p>
                    {property.buyer.email && (
                      <p className="text-sm text-muted-foreground">{property.buyer.email}</p>
                    )}
                    <Button
                      className="w-full mt-3"
                      onClick={() => router.push(`/dashboard/deals/new?propertyId=${property.id}`)}
                    >
                      <DollarSign className="mr-2 h-4 w-4" />
                      Создать сделку
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Дополнительно</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Создан</span>
                <span>{new Date(property.createdAt).toLocaleDateString("ru-RU")}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
