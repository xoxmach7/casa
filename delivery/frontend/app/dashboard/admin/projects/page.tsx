"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Building2,
  Search,
  Plus,
  MapPin,
  Calendar,
  Edit,
  Trash2,
  Eye,
  Users,
  Home,
  Filter,
  MoreVertical
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { API_URL } from "@/lib/config"
import { useToast } from "@/hooks/use-toast"

interface Project {
  id: string
  name: string
  city: string
  district?: string
  address: string
  class?: string
  buildingStatus: string
  deliveryDate?: string
  developerName?: string
  createdAt: string
  developer?: {
    id: string
    firstName: string
    lastName: string
    email: string
  }
  _count?: {
    apartments: number
  }
  apartmentStats?: {
    total: number
    available: number
    reserved: number
    sold: number
  }
}

export default function AdminProjectsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [cityFilter, setCityFilter] = useState("ALL")
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null)

  useEffect(() => {
    fetchProjects()
  }, [])

  const fetchProjects = async () => {
    try {
      const token = localStorage.getItem("token")
      const res = await fetch(`${API_URL}/projects?limit=100`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setProjects(data.projects || [])
      }
    } catch (error) {
      console.error("Failed to fetch projects:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteProject = async () => {
    if (!projectToDelete) return

    try {
      const token = localStorage.getItem("token")
      const res = await fetch(`${API_URL}/projects/${projectToDelete.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })

      if (res.ok) {
        toast({ title: "Проект удалён" })
        fetchProjects()
      } else {
        const error = await res.json()
        toast({ 
          title: "Ошибка", 
          description: error.error || "Не удалось удалить проект", 
          variant: "destructive" 
        })
      }
    } catch (error) {
      toast({ title: "Ошибка", description: "Не удалось удалить проект", variant: "destructive" })
    } finally {
      setDeleteDialogOpen(false)
      setProjectToDelete(null)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "UNDER_CONSTRUCTION":
        return <Badge className="bg-orange-500">Строится</Badge>
      case "COMPLETED":
        return <Badge className="bg-green-500">Сдан</Badge>
      case "READY_TO_MOVE":
        return <Badge className="bg-blue-500">Заселение</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  // Get unique cities for filter
  const cities = [...new Set(projects.map(p => p.city))].filter(Boolean)

  // Filter projects
  const filteredProjects = projects.filter(project => {
    const matchesSearch = 
      project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.developerName?.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesStatus = statusFilter === "ALL" || project.buildingStatus === statusFilter
    const matchesCity = cityFilter === "ALL" || project.city === cityFilter

    return matchesSearch && matchesStatus && matchesCity
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Загрузка...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Все проекты</h1>
          <p className="text-muted-foreground">Управление всеми ЖК на платформе</p>
        </div>
        <Button onClick={() => router.push("/dashboard/projects/new")}>
          <Plus className="h-4 w-4 mr-2" />
          Добавить ЖК
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Всего проектов</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{projects.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Строятся</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {projects.filter(p => p.buildingStatus === "UNDER_CONSTRUCTION").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Заселение</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {projects.filter(p => p.buildingStatus === "READY_TO_MOVE").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Сданы</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {projects.filter(p => p.buildingStatus === "COMPLETED").length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Поиск по названию, адресу, застройщику..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={cityFilter} onValueChange={setCityFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Город" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Все города</SelectItem>
                {cities.map(city => (
                  <SelectItem key={city} value={city}>{city}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Статус" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Все статусы</SelectItem>
                <SelectItem value="UNDER_CONSTRUCTION">Строится</SelectItem>
                <SelectItem value="READY_TO_MOVE">Заселение</SelectItem>
                <SelectItem value="COMPLETED">Сдан</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Projects Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Название</TableHead>
              <TableHead>Город / Район</TableHead>
              <TableHead>Застройщик</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead>Квартиры</TableHead>
              <TableHead>Создан</TableHead>
              <TableHead className="text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProjects.map((project) => (
              <TableRow key={project.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{project.name}</p>
                      <p className="text-sm text-muted-foreground">{project.class || "—"}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 text-sm">
                    <MapPin className="h-3 w-3 text-muted-foreground" />
                    {project.city}{project.district ? `, ${project.district}` : ""}
                  </div>
                </TableCell>
                <TableCell>
                  <div>
                    <p className="font-medium">{project.developerName || "—"}</p>
                    {project.developer && (
                      <p className="text-sm text-muted-foreground">
                        {project.developer.firstName} {project.developer.lastName}
                      </p>
                    )}
                  </div>
                </TableCell>
                <TableCell>{getStatusBadge(project.buildingStatus)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 text-sm">
                    <Home className="h-3 w-3" />
                    {project.apartmentStats?.total || project._count?.apartments || 0}
                    <span className="text-muted-foreground">
                      ({project.apartmentStats?.available || 0} своб.)
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(project.createdAt).toLocaleDateString("ru-RU")}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => router.push(`/dashboard/projects/${project.id}`)}>
                        <Eye className="h-4 w-4 mr-2" />
                        Просмотр
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => router.push(`/dashboard/projects/${project.id}/edit`)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Редактировать
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="text-red-600"
                        onClick={() => {
                          setProjectToDelete(project)
                          setDeleteDialogOpen(true)
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Удалить
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
            {filteredProjects.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  {searchQuery || statusFilter !== "ALL" || cityFilter !== "ALL" 
                    ? "Проекты не найдены" 
                    : "Нет проектов"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить проект?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить проект "{projectToDelete?.name}"? 
              Это действие нельзя отменить. Все квартиры и брони будут также удалены.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-red-600 hover:bg-red-700"
              onClick={handleDeleteProject}
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
