"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  Home,
  Building,
  Store,
  MapPin
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { API_URL } from "@/lib/config"
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
  images: string[]
  createdAt: string
  broker: {
    firstName: string
    lastName: string
  }
  seller?: {
    firstName: string
    lastName: string
    phone: string
  }
  buyer?: {
    firstName: string
    lastName: string
    phone: string
  }
}

export default function PropertiesPage() {
  const router = useRouter()
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("ALL")
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [cityFilter, setCityFilter] = useState("ALL")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  useEffect(() => {
    fetchProperties()
  }, [page, typeFilter, statusFilter, cityFilter])

  const fetchProperties = async () => {
    const token = localStorage.getItem("token")
    if (!token) return

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "10",
      })

      if (typeFilter !== "ALL") params.append("type", typeFilter)
      if (statusFilter !== "ALL") params.append("status", statusFilter)
      if (cityFilter !== "ALL") params.append("city", cityFilter)
      if (search) params.append("search", search)

      const res = await fetch(`${API_URL}/properties?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (res.ok) {
        const data = await res.json()
        setProperties(data.properties)
        setTotalPages(data.totalPages)
      }
    } catch (error) {
      console.error("Failed to fetch properties:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    fetchProperties()
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить объект?")) return

    const token = localStorage.getItem("token")
    try {
      const res = await fetch(`${API_URL}/properties/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })

      if (res.ok) {
        fetchProperties()
      }
    } catch (error) {
      console.error("Failed to delete property:", error)
    }
  }

  const handleStatusChange = async (id: string, newStatus: string) => {
    const token = localStorage.getItem("token")
    try {
      const res = await fetch(`${API_URL}/properties/${id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      })

      if (res.ok) {
        fetchProperties()
      }
    } catch (error) {
      console.error("Failed to update status:", error)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACTIVE": return "#2E7D5E"
      case "RESERVED": return "#D4A843"
      case "SOLD": return "#1B5E40"
      case "ARCHIVED": return "#ef4444"
      default: return "#6b7280"
    }
  }

  const getPropertyTypeIcon = (type: string) => {
    switch (type) {
      case "APARTMENT": return <Home className="h-4 w-4" />
      case "HOUSE": return <Building className="h-4 w-4" />
      case "COMMERCIAL": return <Store className="h-4 w-4" />
      case "LAND": return <MapPin className="h-4 w-4" />
      default: return <Home className="h-4 w-4" />
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

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Объекты вторички</h2>
        <Button onClick={() => router.push("/dashboard/properties/new")} className="bg-[#2E7D5E] hover:bg-[#1B5E40] text-white">
          <Plus className="mr-2 h-4 w-4" />
          Добавить объект
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4">
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Поиск по адресу или названию..."
                  className="pl-8"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Button type="submit" variant="secondary">
                Найти
              </Button>
            </form>
            <div className="flex gap-2 flex-wrap">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Тип объекта" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Все типы</SelectItem>
                  <SelectItem value="APARTMENT">Квартира</SelectItem>
                  <SelectItem value="HOUSE">Дом</SelectItem>
                  <SelectItem value="COMMERCIAL">Коммерция</SelectItem>
                  <SelectItem value="LAND">Участок</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Статус" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Все статусы</SelectItem>
                  <SelectItem value="ACTIVE">Активен</SelectItem>
                  <SelectItem value="RESERVED">Забронирован</SelectItem>
                  <SelectItem value="SOLD">Продан</SelectItem>
                  <SelectItem value="ARCHIVED">Снят</SelectItem>
                </SelectContent>
              </Select>

              <Select value={cityFilter} onValueChange={setCityFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Город" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Все города</SelectItem>
                  <SelectItem value="Астана">Астана</SelectItem>
                  <SelectItem value="Алматы">Алматы</SelectItem>
                  <SelectItem value="Шымкент">Шымкент</SelectItem>
                  <SelectItem value="Актобе">Актобе</SelectItem>
                  <SelectItem value="Караганда">Караганда</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Объект</TableHead>
                <TableHead>Тип</TableHead>
                <TableHead>Локация</TableHead>
                <TableHead>Параметры</TableHead>
                <TableHead>Цена</TableHead>
                <TableHead>Продавец</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><div className="flex items-center gap-2"><Skeleton className="h-12 w-12 rounded" /><div className="space-y-1"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-20" /></div></div></TableCell>
                    <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8 ml-auto rounded" /></TableCell>
                  </TableRow>
                ))
              ) : properties.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Объекты не найдены
                  </TableCell>
                </TableRow>
              ) : (
                properties.map((property) => (
                  <TableRow key={property.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {property.images && property.images.length > 0 ? (
                          <img
                            src={property.images[0]}
                            alt={property.title}
                            className="h-12 w-12 rounded object-cover"
                          />
                        ) : (
                          <div className="h-12 w-12 rounded bg-[#2E7D5E]/5 flex items-center justify-center text-[#2E7D5E]">
                            {getPropertyTypeIcon(property.propertyType)}
                          </div>
                        )}
                        <div className="flex flex-col">
                          <span className="font-medium">{property.title}</span>
                          <span className="text-xs text-muted-foreground">
                            ID: {property.id.slice(0, 8)}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {getPropertyTypeLabel(property.propertyType)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{property.city}</span>
                        {property.district && (
                          <span className="text-xs text-muted-foreground">
                            {property.district}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {property.rooms && <span>{property.rooms}-комн, </span>}
                        <span>{property.area} м²</span>
                        {property.floor && <span>, {property.floor} этаж</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold text-[#2E7D5E]">
                        {Number(property.price).toLocaleString()} ₸
                      </span>
                    </TableCell>
                    <TableCell>
                      {property.seller ? (
                        <div className="flex flex-col">
                          <span className="text-sm">
                            {property.seller.firstName} {property.seller.lastName}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {property.seller.phone}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        style={{
                          backgroundColor: getStatusColor(property.status),
                          color: 'white'
                        }}
                      >
                        {property.status === 'ACTIVE' && 'Активен'}
                        {property.status === 'RESERVED' && 'Забронирован'}
                        {property.status === 'SOLD' && 'Продан'}
                        {property.status === 'ARCHIVED' && 'Снят'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Открыть меню</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Действия</DropdownMenuLabel>
                          <DropdownMenuItem
                            onClick={() => router.push(`/dashboard/properties/${property.id}`)}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            Просмотр
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => router.push(`/dashboard/properties/${property.id}/edit`)}
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            Редактировать
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuLabel>Изменить статус</DropdownMenuLabel>
                          {property.status !== 'ACTIVE' && (
                            <DropdownMenuItem onClick={() => handleStatusChange(property.id, 'ACTIVE')}>
                              <span className="mr-2 h-2 w-2 rounded-full bg-green-500"></span>
                              Активен
                            </DropdownMenuItem>
                          )}
                          {property.status !== 'RESERVED' && (
                            <DropdownMenuItem onClick={() => handleStatusChange(property.id, 'RESERVED')}>
                              <span className="mr-2 h-2 w-2 rounded-full bg-yellow-500"></span>
                              Забронирован
                            </DropdownMenuItem>
                          )}
                          {property.status !== 'SOLD' && (
                            <DropdownMenuItem onClick={() => handleStatusChange(property.id, 'SOLD')}>
                              <span className="mr-2 h-2 w-2 rounded-full bg-[#1B5E40]"></span>
                              Продан
                            </DropdownMenuItem>
                          )}
                          {property.status !== 'ARCHIVED' && (
                            <DropdownMenuItem onClick={() => handleStatusChange(property.id, 'ARCHIVED')}>
                              <span className="mr-2 h-2 w-2 rounded-full bg-red-500"></span>
                              Снят с публикации
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => handleDelete(property.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Удалить
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between space-x-2 py-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
              >
                Назад
              </Button>
              <div className="text-sm text-muted-foreground">
                Страница {page} из {totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page + 1)}
                disabled={page === totalPages}
              >
                Далее
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
