"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { ArrowLeft, Edit, Calendar, Building2, User, DollarSign, FileText, MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { API_URL } from "@/lib/config"
import { toast } from "@/hooks/use-toast"

interface Deal {
  id: string
  title?: string
  dealType: string
  status: string
  amount: number
  commission: number
  casaFee: number
  notes?: string
  createdAt: string
  updatedAt: string
  client?: {
    id: string
    firstName: string
    lastName: string
    phone: string
    email?: string
  } | null
  property?: {
    id: string
    title: string
    address: string
    price: number
  }
  apartment?: {
    id: string
    number: string
    floor: number
    rooms: number
    area: number
    price: number
    project: {
      id: string
      name: string
    }
  }
  broker?: {
    id: string
    firstName: string
    lastName: string
    email: string
  }
}

export default function DealDetailPage() {
  const router = useRouter()
  const params = useParams()
  const dealId = params.id as string

  const [deal, setDeal] = useState<Deal | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [brokers, setBrokers] = useState<any[]>([])

  useEffect(() => {
    fetchCurrentUser()
    if (dealId) {
      fetchDeal()
    }
  }, [dealId])

  useEffect(() => {
    if (currentUser?.role === 'ADMIN') {
      fetchBrokers()
    }
  }, [currentUser])

  const fetchCurrentUser = async () => {
    const token = localStorage.getItem("token")
    if (!token) return
    try {
      const res = await fetch(`${API_URL}/users/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setCurrentUser(data)
      }
    } catch (e) {
      console.error("Failed to fetch user", e)
    }
  }

  const fetchBrokers = async () => {
    const token = localStorage.getItem("token")
    if (!token) return
    try {
      const res = await fetch(`${API_URL}/users?role=BROKER&limit=100`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setBrokers(data.users)
      }
    } catch (e) {
      console.error("Failed to fetch brokers", e)
    }
  }

  const fetchDeal = async () => {
    const token = localStorage.getItem("token")
    if (!token) return
    try {
      const res = await fetch(`${API_URL}/deals/${dealId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setDeal(data)
      } else {
        toast({ title: "Ошибка", description: "Сделка не найдена", variant: "destructive" })
        router.push("/dashboard/deals")
      }
    } catch (error) {
      console.error("Failed to fetch deal:", error)
      toast({ title: "Ошибка", description: "Не удалось загрузить сделку", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    const token = localStorage.getItem("token")
    if (!token || !deal) return

    setUpdating(true)
    try {
      const res = await fetch(`${API_URL}/deals/${dealId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      })

      if (res.ok) {
        const updated = await res.json()
        setDeal(updated)
        toast({ title: "Успешно", description: "Статус сделки обновлён" })
      } else {
        toast({ title: "Ошибка", description: "Не удалось обновить статус", variant: "destructive" })
      }
    } catch (error) {
      console.error("Failed to update deal:", error)
      toast({ title: "Ошибка", description: "Ошибка при обновлении", variant: "destructive" })
    } finally {
      setUpdating(false)
    }
  }

  const handleBrokerChange = async (brokerId: string) => {
    const token = localStorage.getItem("token")
    if (!token || !deal) return

    setUpdating(true)
    try {
      const res = await fetch(`${API_URL}/deals/${dealId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ brokerId }),
      })

      if (res.ok) {
        const updated = await res.json()
        setDeal(updated)
        toast({ title: "Успешно", description: "Брокер переназначен" })
      } else {
        toast({ title: "Ошибка", description: "Не удалось переназначить брокера", variant: "destructive" })
      }
    } catch (error) {
      console.error("Failed to update broker:", error)
      toast({ title: "Ошибка", description: "Ошибка при обновлении", variant: "destructive" })
    } finally {
      setUpdating(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "NEW": return "bg-blue-500"
      case "IN_PROGRESS": return "bg-yellow-500"
      case "PENDING": return "bg-orange-500"
      case "COMPLETED": return "bg-green-500"
      case "CANCELLED": return "bg-red-500"
      default: return "bg-gray-500"
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "NEW": return "Новая"
      case "IN_PROGRESS": return "В работе"
      case "PENDING": return "Ожидание"
      case "COMPLETED": return "Завершена"
      case "CANCELLED": return "Отменена"
      default: return status
    }
  }

  const getDealTypeLabel = (type: string) => {
    switch (type) {
      case "NEW_BUILDING": return "Новостройка"
      case "PROPERTY": return "Вторичка"
      default: return type
    }
  }

  const getWhatsAppLink = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, "")
    return `https://wa.me/${cleanPhone}`
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("ru-KZ", {
      style: "currency",
      currency: "KZT",
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("ru-RU", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!deal) {
    return (
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <div className="text-center py-8">Сделка не найдена</div>
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">{deal.notes || `Сделка #${deal.id.slice(-4)}`}</h2>
            <p className="text-muted-foreground">ID: {deal.id.slice(0, 8)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={`${getStatusColor(deal.status)} text-white`}>
            {getStatusLabel(deal.status)}
          </Badge>
          <Badge variant="outline">{getDealTypeLabel(deal.dealType)}</Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {/* Основная информация */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Финансы
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Сумма сделки</p>
              <p className="text-2xl font-bold">{formatCurrency(deal.amount)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Комиссия брокера</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(deal.commission)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Комиссия Casa</p>
              <p className="text-2xl font-bold text-blue-600">{formatCurrency(deal.casaFee)}</p>
            </div>
          </CardContent>
        </Card>

        {/* Статус */}
        <Card>
          <CardHeader>
            <CardTitle>Управление</CardTitle>
            <CardDescription>Изменить статус сделки</CardDescription>
          </CardHeader>
          <CardContent>
            <Select
              value={deal.status}
              onValueChange={handleStatusChange}
              disabled={updating}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NEW">Новая</SelectItem>
                <SelectItem value="IN_PROGRESS">В работе</SelectItem>
                <SelectItem value="PENDING">Ожидание</SelectItem>
                <SelectItem value="COMPLETED">Завершена</SelectItem>
                <SelectItem value="CANCELLED">Отменена</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Клиент */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Клиент
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {deal.client ? (
              <>
                <div>
                  <p className="font-medium">{deal.client.firstName} {deal.client.lastName}</p>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Телефон:</span>
                  <span>{deal.client.phone}</span>
                </div>
                {deal.client.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Email:</span>
                    <span>{deal.client.email}</span>
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/dashboard/clients/${deal.client!.id}`)}
                  >
                    Карточка
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(getWhatsAppLink(deal.client!.phone), "_blank")}
                  >
                    <MessageCircle className="h-4 w-4 mr-1" />
                    WhatsApp
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground">Клиент не привязан</p>
            )}
          </CardContent>
        </Card>

        {/* Объект */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Объект
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {deal.apartment ? (
              <>
                <div>
                  <p className="font-medium">{deal.apartment.project.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Кв. {deal.apartment.number}, этаж {deal.apartment.floor}
                  </p>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Комнат: </span>
                  <span>{deal.apartment.rooms}</span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Площадь: </span>
                  <span>{deal.apartment.area} м²</span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Цена: </span>
                  <span className="font-medium">{formatCurrency(deal.apartment.price)}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => router.push(`/dashboard/projects/${deal.apartment?.project.id}`)}
                >
                  Открыть проект
                </Button>
              </>
            ) : deal.property ? (
              <>
                <div>
                  <p className="font-medium">{deal.property.title}</p>
                  <p className="text-sm text-muted-foreground">{deal.property.address}</p>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Цена: </span>
                  <span className="font-medium">{formatCurrency(deal.property.price)}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => router.push(`/dashboard/properties/${deal.property?.id}`)}
                >
                  Открыть объект
                </Button>
              </>
            ) : (
              <p className="text-muted-foreground">Объект не привязан</p>
            )}
          </CardContent>
        </Card>

        {/* Брокер */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Брокер
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {deal.broker ? (
              currentUser?.role === 'ADMIN' ? (
                <Select
                  value={deal.broker.id}
                  onValueChange={handleBrokerChange}
                  disabled={updating}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите брокера">
                      {deal.broker.firstName} {deal.broker.lastName}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {brokers.map((broker) => (
                      <SelectItem key={broker.id} value={broker.id}>
                        {broker.firstName} {broker.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <>
                  <p className="font-medium">{deal.broker.firstName} {deal.broker.lastName}</p>
                  <p className="text-sm text-muted-foreground">{deal.broker.email}</p>
                </>
              )
            ) : (
              <p className="text-muted-foreground">Брокер не назначен</p>
            )}
          </CardContent>
        </Card>

        {/* Даты */}
        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Хронология
            </CardTitle>
          </CardHeader>
          <CardContent className="flex gap-8">
            <div>
              <p className="text-sm text-muted-foreground">Создана</p>
              <p className="font-medium">{formatDate(deal.createdAt)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Обновлена</p>
              <p className="font-medium">{formatDate(deal.updatedAt)}</p>
            </div>
          </CardContent>
        </Card>

        {/* Заметки */}
        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Заметки
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <textarea
              className="w-full min-h-[150px] p-3 border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Добавьте заметки о сделке..."
              value={deal.notes || ''}
              onChange={(e) => setDeal({ ...deal, notes: e.target.value })}
            />
            <Button
              onClick={async () => {
                const token = localStorage.getItem("token");
                if (!token) return;

                setUpdating(true);
                try {
                  const res = await fetch(`${API_URL}/deals/${dealId}`, {
                    method: "PUT",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ notes: deal.notes }),
                  });

                  if (res.ok) {
                    toast({ title: "Успешно", description: "Заметки сохранены" });
                  } else {
                    toast({ title: "Ошибка", description: "Не удалось сохранить", variant: "destructive" });
                  }
                } catch (error) {
                  toast({ title: "Ошибка", description: "Ошибка при сохранении", variant: "destructive" });
                } finally {
                  setUpdating(false);
                }
              }}
              disabled={updating}
            >
              Сохранить заметки
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
