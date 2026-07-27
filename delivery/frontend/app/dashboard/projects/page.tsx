"use client"

import { useEffect, useState, lazy, Suspense, useMemo } from "react"
import { useRouter } from "next/navigation"
import {
  Building2,
  MapPin,
  Filter,
  Search,
  LayoutGrid,
  List,
  Map as MapIcon,
  Calendar,
  Loader2,
  Edit,
  Trash2,
  MoreHorizontal
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { API_URL } from "@/lib/config"
import { useToast } from "@/hooks/use-toast"

const BACKEND_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/api\/?$/, '')
const getFileUrl = (url: string) => {
  if (!url) return ''
  if (url.startsWith('http')) return url
  return `${BACKEND_BASE}${url}`
}
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import type { MapProject } from "@/components/map/project-map"

// Динамический импорт карты
const ProjectMap = lazy(() => import("@/components/map/project-map"))

interface Project {
  id: string
  name: string
  district: string
  address: string
  class: string
  buildingStatus: string
  deliveryDate: string
  images: string[]
  lat?: number
  lng?: number
  apartmentStats?: {
    minPrice?: number
  }
}

export default function ProjectsCatalogPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<"grid" | "list" | "map">("grid")
  const [showAllFilters, setShowAllFilters] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)

  // Check user role on mount
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    setUserRole(user.role || null)
  }, [])

  // Filters
  const [district, setDistrict] = useState("ALL")
  const [status, setStatus] = useState("ALL")
  const [housingClass, setHousingClass] = useState("ALL")
  const [minPrice, setMinPrice] = useState("")
  const [maxPrice, setMaxPrice] = useState("")
  const [rooms, setRooms] = useState("ALL")
  const [mortgageProgram, setMortgageProgram] = useState("ALL")

  useEffect(() => {
    fetchProjects()
  }, [district, status, housingClass, minPrice, maxPrice, rooms, mortgageProgram])

  const fetchProjects = async () => {
    const token = localStorage.getItem("token")
    if (!token) return

    try {
      const params = new URLSearchParams()
      if (district !== "ALL") params.append("district", district)
      if (status !== "ALL") params.append("buildingStatus", status)
      if (housingClass !== "ALL") params.append("class", housingClass)
      if (minPrice) params.append("minPrice", String(Number(minPrice) * 1000000))
      if (maxPrice) params.append("maxPrice", String(Number(maxPrice) * 1000000))
      if (rooms !== "ALL") params.append("rooms", rooms)
      if (mortgageProgram !== "ALL") params.append("mortgageProgram", mortgageProgram)

      const response = await fetch(`${API_URL}/projects?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        const data = await response.json()
        setProjects(data.projects)
      }
    } catch (error) {
      console.error("Failed to fetch projects:", error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "UNDER_CONSTRUCTION":
        return <Badge variant="secondary">Строится</Badge>
      case "COMPLETED":
        return <Badge className="bg-green-600">Сдан</Badge>
      case "READY_TO_MOVE":
        return <Badge className="bg-blue-600">Заселение</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const canManageProjects = userRole === 'DEVELOPER' || userRole === 'ADMIN'

  const handleDeleteProject = async () => {
    if (!deleteProjectId) return
    
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_URL}/projects/${deleteProjectId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to delete project')
      }

      toast({
        title: "✅ Проект удалён",
        description: "Объект успешно удалён из системы",
      })

      // Refresh projects list
      fetchProjects()
    } catch (error) {
      console.error('Error deleting project:', error)
      toast({
        title: "❌ Ошибка",
        description: "Не удалось удалить проект",
        variant: "destructive",
      })
    } finally {
      setDeleteProjectId(null)
    }
  }

  // Фильтрация по поиску
  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects
    const query = searchQuery.toLowerCase()
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.address?.toLowerCase().includes(query) ||
        p.district?.toLowerCase().includes(query)
    )
  }, [projects, searchQuery])

  // Преобразование проектов для карты
  const mapProjects: MapProject[] = useMemo(() => {
    return filteredProjects
      .filter((p) => p.lat && p.lng)
      .map((p) => ({
        id: p.id,
        name: p.name,
        address: p.address,
        district: p.district,
        lat: p.lat!,
        lng: p.lng!,
        minPrice: p.apartmentStats?.minPrice,
        class: p.class,
        buildingStatus: p.buildingStatus,
        images: p.images,
      }))
  }, [filteredProjects])

  const handleProjectClickOnMap = (project: MapProject) => {
    router.push(`/dashboard/projects/${project.id}`)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Каталог новостроек</h1>
          <p className="text-muted-foreground">
            Жилые комплексы от проверенных застройщиков ({filteredProjects.length})
          </p>
        </div>
        <div className="flex gap-2">
          {/* Show Add Project button for Developer/Admin */}
          {canManageProjects && (
            <Button onClick={() => router.push("/dashboard/projects/new")}>
              <Building2 className="mr-2 h-4 w-4" />
              Добавить объект
            </Button>
          )}
          
          {/* View mode toggle */}
          <div className="flex border rounded-lg">
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="icon"
              onClick={() => setViewMode("grid")}
              className="rounded-r-none"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="icon"
              onClick={() => setViewMode("list")}
              className="rounded-none border-x"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "map" ? "secondary" : "ghost"}
              size="icon"
              onClick={() => setViewMode("map")}
              className="rounded-l-none"
            >
              <MapIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Поиск ЖК..." 
                className="pl-8" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <Select value={district} onValueChange={setDistrict}>
              <SelectTrigger>
                <SelectValue placeholder="Район" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Все районы</SelectItem>
                <SelectItem value="Алматинский">Алматинский</SelectItem>
                <SelectItem value="Есильский">Есильский</SelectItem>
                <SelectItem value="Сарыарка">Сарыаркинский</SelectItem>
                <SelectItem value="Байконур">Байконур</SelectItem>
                <SelectItem value="Нура">Нура</SelectItem>
              </SelectContent>
            </Select>

            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Статус строительства" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Любой статус</SelectItem>
                <SelectItem value="UNDER_CONSTRUCTION">Строится</SelectItem>
                <SelectItem value="COMPLETED">Сдан</SelectItem>
                <SelectItem value="READY_TO_MOVE">Готов к заселению</SelectItem>
              </SelectContent>
            </Select>

            <Select value={housingClass} onValueChange={setHousingClass}>
              <SelectTrigger>
                <SelectValue placeholder="Класс жилья" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Любой класс</SelectItem>
                <SelectItem value="эконом">Эконом</SelectItem>
                <SelectItem value="комфорт">Комфорт</SelectItem>
                <SelectItem value="бизнес">Бизнес</SelectItem>
                <SelectItem value="премиум">Премиум</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Extended Filters */}
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setShowAllFilters(!showAllFilters)}
            className="text-muted-foreground"
          >
            <Filter className="mr-2 h-4 w-4" />
            {showAllFilters ? "Скрыть фильтры" : "Больше фильтров"}
          </Button>

          {showAllFilters && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2 border-t">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Цена от (млн ₸)</label>
                <Input 
                  type="number" 
                  placeholder="от" 
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Цена до (млн ₸)</label>
                <Input 
                  type="number" 
                  placeholder="до"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                />
              </div>

              <Select value={rooms} onValueChange={setRooms}>
                <SelectTrigger>
                  <SelectValue placeholder="Комнатность" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Любая</SelectItem>
                  <SelectItem value="1">1-комнатная</SelectItem>
                  <SelectItem value="2">2-комнатная</SelectItem>
                  <SelectItem value="3">3-комнатная</SelectItem>
                  <SelectItem value="4">4+ комнаты</SelectItem>
                </SelectContent>
              </Select>

              <Select value={mortgageProgram} onValueChange={setMortgageProgram}>
                <SelectTrigger>
                  <SelectValue placeholder="Ипотека" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Все программы</SelectItem>
                  <SelectItem value="7-20-25">7-20-25</SelectItem>
                  <SelectItem value="baspana">Баспана Хит</SelectItem>
                  <SelectItem value="otau">Отау</SelectItem>
                  <SelectItem value="standard">Стандартная</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Content based on view mode */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Building2 className="h-12 w-12 mx-auto mb-4 opacity-20" />
          <p>Объекты не найдены</p>
        </div>
      ) : viewMode === "map" ? (
        /* Map View */
        <Card className="overflow-hidden">
          <Suspense fallback={
            <div className="h-[600px] flex items-center justify-center bg-muted">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          }>
            <ProjectMap
              projects={mapProjects}
              height="600px"
              onProjectClick={handleProjectClickOnMap}
            />
          </Suspense>
          {mapProjects.length === 0 && (
            <div className="p-4 text-center text-muted-foreground border-t">
              У проектов не указаны координаты. Для отображения на карте добавьте координаты при создании/редактировании проекта.
            </div>
          )}
        </Card>
      ) : viewMode === "list" ? (
        /* List View */
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ЖК</TableHead>
                <TableHead>Район</TableHead>
                <TableHead>Класс</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Срок сдачи</TableHead>
                <TableHead>Цена от</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProjects.map((project) => (
                <TableRow 
                  key={project.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => router.push(`/dashboard/projects/${project.id}`)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-14 bg-muted rounded overflow-hidden shrink-0">
                        {project.images?.[0] ? (
                          <img
                            src={getFileUrl(project.images[0])}
                            alt={project.name}
                            className="object-cover w-full h-full"
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            <Building2 className="h-4 w-4 opacity-20" />
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="font-medium">{project.name}</div>
                        <div className="text-xs text-muted-foreground">{project.address}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{project.district || "—"}</TableCell>
                  <TableCell>{project.class || "—"}</TableCell>
                  <TableCell>{getStatusBadge(project.buildingStatus)}</TableCell>
                  <TableCell>
                    {project.deliveryDate
                      ? new Date(project.deliveryDate).toLocaleDateString("ru-RU", {
                          year: "numeric",
                          month: "short",
                        })
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {project.apartmentStats?.minPrice
                      ? `${(project.apartmentStats.minPrice / 1000000).toFixed(1)} млн ₸`
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation()
                          router.push(`/dashboard/projects/${project.id}`)
                        }}
                      >
                        Подробнее
                      </Button>
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                        onClick={(e) => {
                          e.stopPropagation()
                          router.push(`/dashboard/projects/${project.id}?book=true`)
                        }}
                      >
                        Забронировать
                      </Button>
                      {canManageProjects && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="outline" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation()
                              router.push(`/dashboard/projects/${project.id}/edit`)
                            }}>
                              <Edit className="mr-2 h-4 w-4" />
                              Редактировать
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="text-red-600"
                              onClick={(e) => {
                                e.stopPropagation()
                                setDeleteProjectId(project.id)
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Удалить
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        /* Grid View (default) */
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((project) => (
            <Card
              key={project.id}
              className="overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer group border-0 shadow-md bg-card flex flex-col h-full"
              onClick={() => router.push(`/dashboard/projects/${project.id}`)}
            >
              {/* Image */}
              <div className="aspect-[16/10] relative bg-gradient-to-br from-muted to-muted/60 overflow-hidden">
                {project.images?.[0] ? (
                  <img
                    src={getFileUrl(project.images[0])}
                    alt={project.name}
                    className="object-cover w-full h-full group-hover:scale-110 transition-transform duration-500 ease-out"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900">
                    <Building2 className="h-16 w-16 opacity-15" />
                  </div>
                )}
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                {/* Status badge */}
                <div className="absolute top-3 right-3">
                  {getStatusBadge(project.buildingStatus)}
                </div>
                {/* Class badge */}
                {project.class && (
                  <div className="absolute top-3 left-3">
                    <Badge variant="secondary" className="bg-white/90 dark:bg-black/70 backdrop-blur-sm text-xs font-semibold shadow-sm">
                      {project.class}
                    </Badge>
                  </div>
                )}
                {/* Price overlay */}
                {project.apartmentStats?.minPrice && (
                  <div className="absolute bottom-3 left-3">
                    <span className="bg-white/95 dark:bg-black/80 backdrop-blur-sm text-sm font-bold px-3 py-1.5 rounded-lg shadow-sm text-[#2E7D5E]">
                      от {(project.apartmentStats.minPrice / 1000000).toFixed(1)} млн ₸
                    </span>
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex flex-col flex-1 p-4">
                <h3 className="font-semibold text-base leading-tight line-clamp-1 mb-1.5" title={project.name}>
                  {project.name}
                </h3>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mb-3 line-clamp-1">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">{project.district ? `${project.district}, ` : ""}{project.address}</span>
                </p>

                {/* Info row */}
                <div className="flex items-center gap-3 text-xs text-muted-foreground mb-4 mt-auto">
                  {project.deliveryDate && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(project.deliveryDate).toLocaleDateString("ru-RU", {
                        year: "numeric",
                        month: "short",
                      })}
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      router.push(`/dashboard/projects/${project.id}`)
                    }}
                  >
                    Подробнее
                  </Button>
                  <Button
                    className="flex-1 bg-[#2E7D5E] hover:bg-[#256B4F] text-white"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      router.push(`/dashboard/projects/${project.id}?book=true`)
                    }}
                  >
                    Забронировать
                  </Button>
                  {canManageProjects && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation()
                          router.push(`/dashboard/projects/${project.id}/edit`)
                        }}>
                          <Edit className="mr-2 h-4 w-4" />
                          Редактировать
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="text-red-600"
                          onClick={(e) => {
                            e.stopPropagation()
                            setDeleteProjectId(project.id)
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Удалить
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteProjectId} onOpenChange={() => setDeleteProjectId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить проект?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие нельзя отменить. Проект и все связанные с ним квартиры будут удалены.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteProject} className="bg-red-600 hover:bg-red-700">
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
