"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  ArrowLeft,
  Building2,
  Calendar,
  User,
  Phone,
  Search,
  Loader2,
  CheckCircle2,
  Home,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { API_URL } from "@/lib/config"
import { useToast } from "@/hooks/use-toast"

interface Client {
  id: string
  firstName: string
  lastName: string
  phone: string
  status: string
}

interface Apartment {
  id: string
  number: string
  floor: number
  rooms: number
  area: number
  price: number
  status: string
  project?: {
    id: string
    name: string
    city: string
    address: string
  }
}

interface Project {
  id: string
  name: string
  city: string
  apartments: Apartment[]
}

export default function NewBookingPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  
  const apartmentIdParam = searchParams.get("apartmentId")
  const projectIdParam = searchParams.get("projectId")
  
  const [clients, setClients] = useState<Client[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedApartment, setSelectedApartment] = useState<Apartment | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  
  const [selectedClientId, setSelectedClientId] = useState("")
  const [selectedProjectId, setSelectedProjectId] = useState(projectIdParam || "")
  const [selectedApartmentId, setSelectedApartmentId] = useState(apartmentIdParam || "")
  const [notes, setNotes] = useState("")
  const [expirationDays, setExpirationDays] = useState("7")
  const [clientSearch, setClientSearch] = useState("")

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    // Если есть apartmentId, загружаем информацию о квартире
    if (apartmentIdParam) {
      fetchApartmentDetails(apartmentIdParam)
    }
  }, [apartmentIdParam])

  const fetchData = async () => {
    try {
      const token = localStorage.getItem("token")
      
      const [clientsRes, projectsRes] = await Promise.all([
        fetch(`${API_URL}/clients?limit=100`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_URL}/projects?limit=100`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ])

      if (clientsRes.ok) {
        const data = await clientsRes.json()
        setClients(data.clients || [])
      }

      if (projectsRes.ok) {
        const data = await projectsRes.json()
        setProjects(data.projects || [])
      }
    } catch (error) {
      console.error("Failed to fetch data:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchApartmentDetails = async (apartmentId: string) => {
    try {
      const token = localStorage.getItem("token")
      const res = await fetch(`${API_URL}/apartments/${apartmentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setSelectedApartment(data)
        if (data.project?.id) {
          setSelectedProjectId(data.project.id)
        }
      }
    } catch (error) {
      console.error("Failed to fetch apartment:", error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedClientId) {
      toast({ title: "Ошибка", description: "Выберите клиента", variant: "destructive" })
      return
    }
    
    if (!selectedApartmentId) {
      toast({ title: "Ошибка", description: "Выберите квартиру", variant: "destructive" })
      return
    }

    setSubmitting(true)
    
    try {
      const token = localStorage.getItem("token")
      const res = await fetch(`${API_URL}/bookings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          clientId: selectedClientId,
          apartmentId: selectedApartmentId,
          notes,
          expirationDays: parseInt(expirationDays),
        }),
      })

      if (res.ok) {
        toast({ title: "Успешно", description: "Бронь создана" })
        router.push("/dashboard/bookings")
      } else {
        const error = await res.json()
        toast({ 
          title: "Ошибка", 
          description: error.error || "Не удалось создать бронь", 
          variant: "destructive" 
        })
      }
    } catch (error) {
      toast({ title: "Ошибка", description: "Не удалось создать бронь", variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  // Фильтрация клиентов по поиску
  const filteredClients = clients.filter(
    (c) =>
      c.firstName.toLowerCase().includes(clientSearch.toLowerCase()) ||
      c.lastName.toLowerCase().includes(clientSearch.toLowerCase()) ||
      c.phone.includes(clientSearch)
  )

  // Получение квартир выбранного проекта
  const selectedProject = projects.find((p) => p.id === selectedProjectId)
  const availableApartments = selectedProject?.apartments?.filter((a) => a.status === "AVAILABLE") || []

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("ru-RU").format(price)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Новая бронь</h1>
          <p className="text-muted-foreground">Создание брони квартиры для клиента</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left Column - Form */}
          <div className="space-y-6">
            {/* Client Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Выбор клиента
                </CardTitle>
                <CardDescription>Выберите клиента для бронирования</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Поиск по имени или телефону..."
                    className="pl-8"
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                  />
                </div>
                
                <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите клиента" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredClients.length === 0 ? (
                      <SelectItem value="none" disabled>
                        Клиенты не найдены
                      </SelectItem>
                    ) : (
                      filteredClients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          <div className="flex items-center gap-2">
                            <span>{client.firstName} {client.lastName}</span>
                            <span className="text-muted-foreground">({client.phone})</span>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>

                <Button 
                  type="button" 
                  variant="outline" 
                  className="w-full"
                  onClick={() => router.push("/dashboard/clients/new")}
                >
                  + Добавить нового клиента
                </Button>
              </CardContent>
            </Card>

            {/* Apartment Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Home className="h-5 w-5" />
                  Выбор квартиры
                </CardTitle>
                <CardDescription>
                  {selectedApartment 
                    ? `Выбрана квартира №${selectedApartment.number}`
                    : "Выберите проект и квартиру"
                  }
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!apartmentIdParam && (
                  <>
                    <div className="space-y-2">
                      <Label>Жилой комплекс</Label>
                      <Select value={selectedProjectId} onValueChange={(val) => {
                        setSelectedProjectId(val)
                        setSelectedApartmentId("")
                      }}>
                        <SelectTrigger>
                          <SelectValue placeholder="Выберите ЖК" />
                        </SelectTrigger>
                        <SelectContent>
                          {projects.map((project) => (
                            <SelectItem key={project.id} value={project.id}>
                              {project.name} ({project.city})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedProjectId && (
                      <div className="space-y-2">
                        <Label>Квартира</Label>
                        <Select value={selectedApartmentId} onValueChange={setSelectedApartmentId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Выберите квартиру" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableApartments.length === 0 ? (
                              <SelectItem value="none" disabled>
                                Нет доступных квартир
                              </SelectItem>
                            ) : (
                              availableApartments.map((apt) => (
                                <SelectItem key={apt.id} value={apt.id}>
                                  №{apt.number} • {apt.rooms}-комн • {apt.area} м² • {formatPrice(apt.price)} ₸
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </>
                )}

                {selectedApartment && (
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Building2 className="h-4 w-4" />
                      <span className="font-medium">{selectedApartment.project?.name}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>Квартира: <strong>№{selectedApartment.number}</strong></div>
                      <div>Этаж: <strong>{selectedApartment.floor}</strong></div>
                      <div>Комнат: <strong>{selectedApartment.rooms}</strong></div>
                      <div>Площадь: <strong>{selectedApartment.area} м²</strong></div>
                    </div>
                    <div className="mt-2 text-lg font-bold text-primary">
                      {formatPrice(selectedApartment.price)} ₸
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Booking Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Параметры брони
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Срок брони</Label>
                  <Select value={expirationDays} onValueChange={setExpirationDays}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3 дня</SelectItem>
                      <SelectItem value="7">7 дней</SelectItem>
                      <SelectItem value="14">14 дней</SelectItem>
                      <SelectItem value="30">30 дней</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Заметки (опционально)</Label>
                  <Textarea
                    placeholder="Дополнительная информация о брони..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Summary */}
          <div>
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle>Сводка</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Selected Client */}
                <div className="p-3 border rounded-lg">
                  <div className="text-sm text-muted-foreground mb-1">Клиент</div>
                  {selectedClientId ? (
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <span className="font-medium">
                        {clients.find((c) => c.id === selectedClientId)?.firstName}{" "}
                        {clients.find((c) => c.id === selectedClientId)?.lastName}
                      </span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">Не выбран</span>
                  )}
                </div>

                {/* Selected Apartment */}
                <div className="p-3 border rounded-lg">
                  <div className="text-sm text-muted-foreground mb-1">Квартира</div>
                  {selectedApartmentId || selectedApartment ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Home className="h-4 w-4" />
                        <span className="font-medium">
                          {selectedApartment?.project?.name || selectedProject?.name}
                        </span>
                      </div>
                      <div className="text-sm">
                        Квартира №{selectedApartment?.number || availableApartments.find(a => a.id === selectedApartmentId)?.number}
                      </div>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">Не выбрана</span>
                  )}
                </div>

                {/* Booking Period */}
                <div className="p-3 border rounded-lg">
                  <div className="text-sm text-muted-foreground mb-1">Срок брони</div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span className="font-medium">{expirationDays} дней</span>
                  </div>
                </div>

                <Button 
                  type="submit" 
                  className="w-full bg-green-600 hover:bg-green-700" 
                  disabled={submitting || !selectedClientId || (!selectedApartmentId && !apartmentIdParam)}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Создание...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Создать бронь
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </div>
  )
}
