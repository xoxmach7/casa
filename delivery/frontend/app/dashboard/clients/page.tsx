"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Phone,
  MessageCircle,
  Building2,
  User,
  Wallet,
  Calendar,
  Building
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import { getStatusColor, getClientTypeColor } from "@/lib/design-tokens"
import { API_URL } from "@/lib/config"

interface Client {
  id: string
  firstName: string
  lastName: string
  phone: string
  email: string
  city: string
  status: string
  clientType: string
  budget: number
  createdAt: string
  _count?: {
    bookings: number
    mortgageCalculations: number
  }
}

export default function ClientsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [typeFilter, setTypeFilter] = useState("ALL")
  const [cityFilter, setCityFilter] = useState("ALL")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [deleteClientId, setDeleteClientId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetchClients()
  }, [page, statusFilter, typeFilter, cityFilter])

  const fetchClients = async () => {
    const token = (localStorage.getItem('user') ? '1' : null)
    if (!token) return

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "10",
      })

      if (statusFilter !== "ALL") params.append("status", statusFilter)
      if (typeFilter !== "ALL") params.append("clientType", typeFilter)
      if (cityFilter !== "ALL") params.append("city", cityFilter)
      if (search) params.append("search", search)

      const response = await fetch(`${API_URL}/clients?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        const data = await response.json()
        setClients(data.clients)
        setTotalPages(data.pagination.pages)
      }
    } catch (error) {
      console.error("Failed to fetch clients:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    fetchClients()
  }

  const getWhatsAppLink = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, "")
    return `https://wa.me/${cleanPhone}`
  }

  const handleDeleteClient = async () => {
    if (!deleteClientId) return
    setDeleting(true)
    try {
      const token = (localStorage.getItem('user') ? '1' : null)
      const response = await fetch(`${API_URL}/clients/${deleteClientId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.error || "Не удалось удалить клиента")
      }
      toast({ title: "Клиент удалён" })
      fetchClients()
    } catch (error) {
      toast({
        title: "Ошибка",
        description: error instanceof Error ? error.message : "Не удалось удалить клиента",
        variant: "destructive",
      })
    } finally {
      setDeleting(false)
      setDeleteClientId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => router.push('/dashboard/crm')} className="border-[#2E7D5E]/20 text-[#2E7D5E] hover:bg-[#2E7D5E]/5">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Клиенты</h1>
            <p className="text-muted-foreground">
              Управление базой клиентов и сделками
            </p>
          </div>
        </div>
        <Button onClick={() => router.push("/dashboard/clients/new")} className="bg-[#2E7D5E] hover:bg-[#1B5E40] text-white">
          <Plus className="mr-2 h-4 w-4" />
          Добавить клиента
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-4 justify-between">
            <form onSubmit={handleSearch} className="flex gap-2 flex-1 max-w-md">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Поиск по имени или телефону..."
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
                  <SelectValue placeholder="Тип клиента" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Все типы</SelectItem>
                  <SelectItem value="BUYER">Покупатель</SelectItem>
                  <SelectItem value="SELLER">Продавец</SelectItem>
                  <SelectItem value="NEW_BUILDING">Новостройка</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Статус" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Все статусы</SelectItem>
                  <SelectItem value="NEW">Новый</SelectItem>
                  <SelectItem value="IN_PROGRESS">В работе</SelectItem>
                  <SelectItem value="DEAL_CLOSED">Сделка закрыта</SelectItem>
                  <SelectItem value="REJECTED">Отказ</SelectItem>
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
                <TableHead>Клиент</TableHead>
                <TableHead>Город</TableHead>
                <TableHead>Тип</TableHead>
                <TableHead>Бюджет</TableHead>
                <TableHead>Активность</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Дата создания</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><div className="space-y-1"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-24" /></div></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : clients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Клиенты не найдены
                  </TableCell>
                </TableRow>
              ) : (
                clients.map((client: any) => (
                  <TableRow key={client.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {client.firstName} {client.lastName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {client.phone}
                        </span>
                        {client.email && (
                          <span className="text-xs text-muted-foreground">
                            {client.email}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{client.city || '-'}</span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        style={{
                          borderColor: getClientTypeColor(client.clientType),
                          color: getClientTypeColor(client.clientType)
                        }}
                      >
                        {client.clientType === 'BUYER' && 'Покупатель'}
                        {client.clientType === 'SELLER' && 'Продавец'}
                        {client.clientType === 'NEW_BUILDING' && 'Новостройка'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {client.budget ? (
                        <div className="flex items-center gap-1">
                          <Wallet className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">{Number(client.budget).toLocaleString()} ₸</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2 text-xs text-muted-foreground">
                        {client._count?.bookings > 0 && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {client._count.bookings}
                          </span>
                        )}
                        {client._count?.mortgageCalculations > 0 && (
                          <span className="flex items-center gap-1">
                            <Building className="h-3 w-3" />
                            {client._count.mortgageCalculations}
                          </span>
                        )}
                        {(!client._count?.bookings && !client._count?.mortgageCalculations) && (
                          <span>-</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        style={{
                          backgroundColor: getStatusColor(client.status),
                          color: 'white'
                        }}
                      >
                        {client.status === 'NEW' && 'Новый'}
                        {client.status === 'IN_PROGRESS' && 'В работе'}
                        {client.status === 'DEAL_CLOSED' && 'Сделка'}
                        {client.status === 'REJECTED' && 'Отказ'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(client.createdAt).toLocaleDateString("ru-RU")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-[#2E7D5E] hover:text-[#1B5E40] hover:bg-[#2E7D5E]/5"
                          onClick={() => window.open(getWhatsAppLink(client.phone), '_blank')}
                        >
                          <MessageCircle className="h-4 w-4" />
                        </Button>
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
                              onClick={() => router.push(`/dashboard/clients/${client.id}`)}
                            >
                              Открыть карточку
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => router.push(`/dashboard/bookings/new?clientId=${client.id}`)}
                            >
                              Создать бронь
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => setDeleteClientId(client.id)}
                            >
                              Удалить
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Назад
              </Button>
              <span className="flex items-center text-sm text-muted-foreground">
                Страница {page} из {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Вперед
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteClientId} onOpenChange={(open) => !open && setDeleteClientId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить клиента?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие нельзя отменить. Клиент будет удалён из базы.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteClient} disabled={deleting} className="bg-red-600 hover:bg-red-700">
              {deleting ? "Удаление..." : "Удалить"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
