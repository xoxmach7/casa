"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Plus,
  DollarSign,
  TrendingUp,
  Eye,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { API_URL } from "@/lib/config"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface Deal {
  id: string
  amount: number
  commission: number
  casaFee: number
  status: string
  objectType: string
  createdAt: string
  completedAt?: string
  broker: {
    firstName: string
    lastName: string
  }
  client?: {
    firstName: string
    lastName: string
    phone: string
  }
}

export default function DealsPage() {
  const router = useRouter()
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    totalAmount: 0,
    totalCommission: 0,
  })
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  useEffect(() => {
    fetchDeals()
  }, [page, statusFilter])

  const fetchDeals = async () => {
    const token = localStorage.getItem("token")
    if (!token) return

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "10",
      })

      if (statusFilter !== "ALL") params.append("status", statusFilter)

      const res = await fetch(`${API_URL}/deals?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (res.ok) {
        const data = await res.json()
        setDeals(data.deals)
        setTotalPages(data.pagination.pages)
        
        // Calculate simple stats from deals
        const completed = data.deals.filter((d: Deal) => d.status === 'COMPLETED')
        setStats({
          total: data.deals.length,
          completed: completed.length,
          totalAmount: completed.reduce((sum: number, d: Deal) => sum + Number(d.amount), 0),
          totalCommission: completed.reduce((sum: number, d: Deal) => sum + Number(d.commission), 0),
        })
      }
    } catch (error) {
      console.error("Failed to fetch deals:", error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING": return "#f59e0b"
      case "IN_PROGRESS": return "#3b82f6"
      case "COMPLETED": return "#10b981"
      case "CANCELLED": return "#ef4444"
      default: return "#6b7280"
    }
  }

  const getObjectTypeLabel = (type: string) => {
    switch (type) {
      case "PROPERTY": return "Вторичка"
      case "APARTMENT": return "Новостройка"
      case "BOOKING": return "Бронь"
      default: return type
    }
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Сделки</h2>
        <Button onClick={() => router.push("/dashboard/deals/new")}>
          <Plus className="mr-2 h-4 w-4" />
          Новая сделка
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Всего сделок</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Завершено</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completed}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Общая сумма</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalAmount.toLocaleString()} ₸</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Моя комиссия</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCommission.toLocaleString()} ₸</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>История сделок</CardTitle>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Статус" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Все статусы</SelectItem>
                <SelectItem value="PENDING">Ожидание</SelectItem>
                <SelectItem value="IN_PROGRESS">В процессе</SelectItem>
                <SelectItem value="COMPLETED">Завершено</SelectItem>
                <SelectItem value="CANCELLED">Отменено</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Дата</TableHead>
                <TableHead>Клиент</TableHead>
                <TableHead>Тип</TableHead>
                <TableHead>Сумма</TableHead>
                <TableHead>Комиссия</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    Загрузка...
                  </TableCell>
                </TableRow>
              ) : deals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Сделки не найдены
                  </TableCell>
                </TableRow>
              ) : (
                deals.map((deal) => (
                  <TableRow key={deal.id}>
                    <TableCell>
                      {new Date(deal.createdAt).toLocaleDateString("ru-RU")}
                    </TableCell>
                    <TableCell>
                      {deal.client ? (
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {deal.client.firstName} {deal.client.lastName}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {deal.client.phone}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {getObjectTypeLabel(deal.objectType)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold">
                        {Number(deal.amount).toLocaleString()} ₸
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium text-green-600">
                        {Number(deal.commission).toLocaleString()} ₸
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        style={{
                          backgroundColor: getStatusColor(deal.status),
                          color: 'white'
                        }}
                      >
                        {deal.status === 'PENDING' && 'Ожидание'}
                        {deal.status === 'IN_PROGRESS' && 'В процессе'}
                        {deal.status === 'COMPLETED' && 'Завершено'}
                        {deal.status === 'CANCELLED' && 'Отменено'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => router.push(`/dashboard/deals/${deal.id}`)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
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
