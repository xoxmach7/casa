"use client"

import { useEffect, useState, lazy, Suspense } from "react"
import { ApartmentCard } from "@/components/apartments/ApartmentCard"
import { AddToSelectionDialog } from "@/components/apartments/AddToSelectionDialog"
import { MortgageQuickCalcDialog } from "@/components/apartments/MortgageQuickCalcDialog"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import {
  MapPin,
  Phone,
  Calendar,
  Building2,
  ArrowLeft,
  Search,
  Play,
  Calculator,
  Percent,
  Loader2,
  Image as ImageIcon,
  Grid3x3,
  X,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Video,
  Tag,
  BadgePercent,
  Landmark
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { API_URL } from "@/lib/config"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

// Динамический импорт карты
const ProjectMap = lazy(() => import("@/components/map/project-map"))

interface Apartment {
  id: string
  number: string
  floor: number
  rooms: number
  area: number
  price: number
  status: "AVAILABLE" | "RESERVED" | "SOLD"
  layoutImage?: string // Фото планировки
}

interface ProjectDetails {
  id: string
  name: string
  description: string
  city: string
  district: string
  address: string
  lat?: number
  lng?: number
  class: string
  buildingStatus: string
  deliveryDate: string
  developerName: string
  developerPhone: string
  crmUrl?: string
  bonus: string
  promotions?: string
  mortgagePrograms?: string[]
  images: string[]
  videoUrl?: string
  apartments: Apartment[]
  apartmentStats?: {
    total: number
    available: number
    reserved: number
    sold: number
    // Живые фиксации по ЖК — считаются по Fixation, а не по статусу квартир.
    activeFixations: number
  }
}

export default function ProjectDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [project, setProject] = useState<ProjectDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeImage, setActiveImage] = useState(0)
  const [apartmentSearch, setApartmentSearch] = useState("")
  const [selectedLayout, setSelectedLayout] = useState<Apartment | null>(null)
  const [selectionApartment, setSelectionApartment] = useState<Apartment | null>(null)
  const [mortgageApartment, setMortgageApartment] = useState<Apartment | null>(null)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  
  // Определяем начальную вкладку по параметру book=true
  const bookMode = searchParams.get("book") === "true"
  const [activeTab, setActiveTab] = useState(bookMode ? "apartments" : "about")

  useEffect(() => {
    fetchProjectDetails()
  }, [])

  const fetchProjectDetails = async () => {
    const token = localStorage.getItem("token")
    if (!token) return

    try {
      const response = await fetch(`${API_URL}/projects/${params.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        const data = await response.json()
        setProject(data)
      }
    } catch (error) {
      console.error("Failed to fetch project details:", error)
    } finally {
      setLoading(false)
    }
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: "KZT",
      maximumFractionDigits: 0,
    }).format(price)
  }

  const filteredApartments = project?.apartments.filter(apt =>
    apt.number.includes(apartmentSearch) ||
    apt.rooms.toString().includes(apartmentSearch)
  ) || []

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!project) {
    return <div className="flex justify-center py-12">Проект не найден</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        {/* Всегда ведёт в каталог новостроек, а не в историю браузера:
            router.back() мог выкинуть на логин или вообще за пределы CRM. */}
        <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard/projects')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
          <div className="flex items-center gap-2 text-muted-foreground mt-1">
            <MapPin className="h-4 w-4" />
            <span>{project.city}, {project.district}, {project.address}</span>
          </div>
        </div>
        <div className="ml-auto flex gap-2">
          {project.class && (
            <Badge variant="outline" className="text-lg px-4 py-1">
              {project.class}
            </Badge>
          )}
          <Badge className="text-lg px-4 py-1 bg-primary">
            {project.buildingStatus === "UNDER_CONSTRUCTION" ? "Строится" : 
             project.buildingStatus === "READY_TO_MOVE" ? "Заселение" : "Сдан"}
          </Badge>
        </div>
      </div>

      {/* Promo banner — только акция для покупателя; бонус брокера пока скрыт (см. PR) */}
      {project.promotions && (
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg shadow-green-500/25">
            <Tag className="h-4 w-4" />
            <span className="font-medium text-sm">🏷️ Акция: {project.promotions.length > 50 ? project.promotions.slice(0, 50) + '...' : project.promotions}</span>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Gallery */}
          <div className="space-y-4">
            <div className="aspect-video bg-muted rounded-lg overflow-hidden relative group cursor-pointer"
                 onClick={() => {
                   setLightboxIndex(activeImage)
                   setLightboxOpen(true)
                 }}>
              {project.images?.[activeImage] ? (
                <img
                  src={project.images[activeImage]}
                  alt={project.name}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <Building2 className="h-20 w-20 text-muted-foreground opacity-20" />
                </div>
              )}
              
              {/* Image counter badge */}
              {project.images && project.images.length > 0 && (
                <div className="absolute top-4 left-4 bg-black/60 text-white px-3 py-1 rounded-full text-sm flex items-center gap-1">
                  <ImageIcon className="h-4 w-4" />
                  {activeImage + 1} / {project.images.length}
                </div>
              )}

              {/* Fullscreen button */}
              <Button 
                className="absolute top-4 right-4 gap-2 opacity-0 group-hover:opacity-100 transition-opacity"
                variant="secondary"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  setLightboxIndex(activeImage)
                  setLightboxOpen(true)
                }}
              >
                <Maximize2 className="h-4 w-4" />
                Увеличить
              </Button>
              
              {/* Video Button Overlay */}
              {project.videoUrl && (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button 
                      className="absolute bottom-4 right-4 gap-2"
                      variant="secondary"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Play className="h-4 w-4" />
                      Смотреть видео
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl">
                    <DialogHeader>
                      <DialogTitle>Видео обзор — {project.name}</DialogTitle>
                    </DialogHeader>
                    <div className="aspect-video">
                      <iframe
                        src={project.videoUrl}
                        className="w-full h-full rounded-lg"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  </DialogContent>
                </Dialog>
              )}

              {/* Navigation arrows on main image */}
              {project.images && project.images.length > 1 && (
                <>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity h-10 w-10 bg-black/50 hover:bg-black/70"
                    onClick={(e) => {
                      e.stopPropagation()
                      setActiveImage((prev) => (prev > 0 ? prev - 1 : project.images.length - 1))
                    }}
                  >
                    <ChevronLeft className="h-6 w-6 text-white" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity h-10 w-10 bg-black/50 hover:bg-black/70"
                    onClick={(e) => {
                      e.stopPropagation()
                      setActiveImage((prev) => (prev < project.images.length - 1 ? prev + 1 : 0))
                    }}
                  >
                    <ChevronRight className="h-6 w-6 text-white" />
                  </Button>
                </>
              )}
            </div>
            {project.images && project.images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {project.images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImage(idx)}
                    className={`relative flex-none w-24 aspect-video rounded-md overflow-hidden border-2 transition-all ${activeImage === idx ? "border-primary ring-2 ring-primary/30" : "border-transparent hover:border-muted-foreground/50"
                      }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                    {idx === 0 && project.videoUrl && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <Video className="h-4 w-4 text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Lightbox Modal */}
          <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
            <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-none" aria-describedby={undefined}>
              <DialogTitle className="sr-only">Просмотр фото</DialogTitle>
              <div className="relative w-full h-[90vh] flex items-center justify-center">
                {/* Close button */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-4 right-4 text-white hover:bg-white/20 z-10"
                  onClick={() => setLightboxOpen(false)}
                >
                  <X className="h-6 w-6" />
                </Button>

                {/* Image counter */}
                <div className="absolute top-4 left-4 text-white text-sm bg-black/50 px-3 py-1 rounded-full z-10">
                  {lightboxIndex + 1} / {project.images?.length || 0}
                </div>

                {/* Previous button */}
                {project.images && lightboxIndex > 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 h-14 w-14 z-10"
                    onClick={() => setLightboxIndex((prev) => prev - 1)}
                  >
                    <ChevronLeft className="h-10 w-10" />
                  </Button>
                )}

                {/* Main image */}
                {project.images?.[lightboxIndex] && (
                  <img
                    src={project.images[lightboxIndex]}
                    alt={`${project.name} - фото ${lightboxIndex + 1}`}
                    className="max-w-full max-h-[85vh] object-contain"
                  />
                )}

                {/* Next button */}
                {project.images && lightboxIndex < project.images.length - 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 h-14 w-14 z-10"
                    onClick={() => setLightboxIndex((prev) => prev + 1)}
                  >
                    <ChevronRight className="h-10 w-10" />
                  </Button>
                )}

                {/* Thumbnails */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 bg-black/50 p-2 rounded-lg max-w-[90vw] overflow-x-auto z-10">
                  {project.images?.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setLightboxIndex(idx)}
                      className={`w-16 h-12 rounded overflow-hidden border-2 flex-shrink-0 transition-all ${
                        lightboxIndex === idx ? "border-white scale-110" : "border-transparent opacity-60 hover:opacity-100"
                      }`}
                    >
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Description & Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="about">О проекте</TabsTrigger>
              <TabsTrigger value="apartments">Квартиры ({project.apartments.length})</TabsTrigger>
              <TabsTrigger value="location">На карте</TabsTrigger>
              <TabsTrigger value="mortgage">Ипотека</TabsTrigger>
            </TabsList>

            <TabsContent value="about" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Описание</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground whitespace-pre-line">
                    {project.description || "Описание не указано"}
                  </p>
                </CardContent>
              </Card>

              {/* Акция для покупателя — бонус брокера пока скрыт (см. PR) */}
              {project.promotions && (
                <div className="grid gap-4 md:grid-cols-2">
                  {project.promotions && (
                    <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/30 overflow-hidden relative">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 rounded-full -mr-16 -mt-16" />
                      <CardHeader className="pb-2">
                        <div className="flex items-center gap-2">
                          <div className="p-2 rounded-lg bg-green-500/20">
                            <Tag className="h-5 w-5 text-green-600" />
                          </div>
                          <div>
                            <CardTitle className="text-lg text-green-700 dark:text-green-400">
                              🏷️ Акция для покупателя
                            </CardTitle>
                            <CardDescription className="text-green-600/70">
                              Специальные условия
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-green-800 dark:text-green-200 font-medium whitespace-pre-line">
                          {project.promotions}
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {/* Программы ипотеки */}
              {project.mortgagePrograms && project.mortgagePrograms.length > 0 && (
                <Card className="bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border-blue-500/30">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-blue-500/20">
                        <Landmark className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <CardTitle className="text-lg text-blue-700 dark:text-blue-400">
                          🏦 Доступные программы ипотеки
                        </CardTitle>
                        <CardDescription className="text-blue-600/70">
                          Партнерские банки и программы
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {project.mortgagePrograms.map((program, index) => (
                        <Badge 
                          key={index} 
                          variant="secondary"
                          className="bg-blue-500/20 text-blue-700 dark:text-blue-300 hover:bg-blue-500/30"
                        >
                          <BadgePercent className="h-3 w-3 mr-1" />
                          {program}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Location Map Tab */}
            <TabsContent value="location" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Расположение ЖК
                  </CardTitle>
                  <CardDescription>
                    {project.city}, {project.district}, {project.address}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {project.lat && project.lng ? (
                    <Suspense fallback={
                      <div className="h-[400px] flex items-center justify-center bg-muted rounded-lg">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      </div>
                    }>
                      <ProjectMap
                        projects={[{
                          id: project.id,
                          name: project.name,
                          address: project.address,
                          district: project.district,
                          lat: project.lat,
                          lng: project.lng,
                          class: project.class,
                        }]}
                        center={[project.lat, project.lng]}
                        zoom={15}
                        height="400px"
                      />
                    </Suspense>
                  ) : (
                    <div className="h-[400px] flex items-center justify-center bg-muted rounded-lg">
                      <div className="text-center">
                        <MapPin className="h-12 w-12 mx-auto text-muted-foreground/20 mb-2" />
                        <p className="text-muted-foreground">Координаты не указаны</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="mortgage" className="mt-4 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Percent className="h-5 w-5" />
                    Доступные ипотечные программы
                  </CardTitle>
                  <CardDescription>
                    Ипотечные программы, по которым можно приобрести квартиру в этом ЖК
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* 7-20-25 Program */}
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-semibold">Программа 7-20-25</h4>
                        <p className="text-sm text-muted-foreground">Государственная программа</p>
                      </div>
                      <Badge className="bg-green-500">7%</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm mt-3">
                      <div>
                        <span className="text-muted-foreground">Первый взнос:</span>
                        <span className="ml-2 font-medium">от 20%</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Срок:</span>
                        <span className="ml-2 font-medium">до 25 лет</span>
                      </div>
                    </div>
                  </div>

                  {/* Baspana Hit */}
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-semibold">Баспана Хит</h4>
                        <p className="text-sm text-muted-foreground">Отбасы Банк</p>
                      </div>
                      <Badge variant="secondary">5%</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm mt-3">
                      <div>
                        <span className="text-muted-foreground">Первый взнос:</span>
                        <span className="ml-2 font-medium">от 10%</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Срок:</span>
                        <span className="ml-2 font-medium">до 25 лет</span>
                      </div>
                    </div>
                  </div>

                  {/* Otau */}
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-semibold">Отау</h4>
                        <p className="text-sm text-muted-foreground">Для молодых семей</p>
                      </div>
                      <Badge variant="secondary">2%</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm mt-3">
                      <div>
                        <span className="text-muted-foreground">Первый взнос:</span>
                        <span className="ml-2 font-medium">от 10%</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Срок:</span>
                        <span className="ml-2 font-medium">до 20 лет</span>
                      </div>
                    </div>
                  </div>

                  <Button className="w-full" variant="outline" onClick={() => router.push('/dashboard/mortgage')}>
                    <Calculator className="mr-2 h-4 w-4" />
                    Рассчитать ипотеку
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="apartments" className="mt-4 space-y-4">
              <Card className="border-primary/40 bg-primary/5">
                <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div>
                    <p className="font-medium">Шахматка и фиксация клиента</p>
                    <p className="text-sm text-muted-foreground">
                      Плитка, список или шахматка по этажам — закрепите клиента за квартирой
                    </p>
                  </div>
                  <Button onClick={() => router.push(`/dashboard/projects/${project.id}/apartments`)}>
                    <Grid3x3 className="mr-2 h-4 w-4" />
                    Открыть шахматку
                  </Button>
                </CardContent>
              </Card>

              <div className="flex gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Поиск по номеру или комнатам..."
                    className="pl-8"
                    value={apartmentSearch}
                    onChange={(e) => setApartmentSearch(e.target.value)}
                  />
                </div>
              </div>

              {filteredApartments.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    Квартиры не найдены
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {filteredApartments.map((apt) => (
                    <ApartmentCard
                      key={apt.id}
                      apartment={apt}
                      onViewLayout={(a) => setSelectedLayout(a as Apartment)}
                      onBook={(a) => router.push(`/dashboard/bookings/new?apartmentId=${a.id}&projectId=${project.id}`)}
                      onAddToSelection={(a) => setSelectionApartment(a as Apartment)}
                      onCalculateMortgage={(a) => setMortgageApartment(a as Apartment)}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Информация</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Срок сдачи</span>
                <span className="font-medium">
                  {project.deliveryDate 
                    ? new Date(project.deliveryDate).toLocaleDateString("ru-RU", {
                        year: 'numeric',
                        month: 'long'
                      })
                    : "Не указан"}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Застройщик</span>
                <span className="font-medium">{project.developerName || "Не указан"}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Всего квартир</span>
                <span className="font-medium">{project.apartments.length}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Свободно</span>
                <span className="font-medium text-green-600">
                  {project.apartments.filter(a => a.status === "AVAILABLE").length}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Мин. цена</span>
                <span className="font-medium">
                  {project.apartments.filter(a => a.status === "AVAILABLE").length > 0
                    ? formatPrice(Math.min(...project.apartments.filter(a => a.status === "AVAILABLE").map(a => a.price)))
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Фиксации</span>
                <span className="font-medium text-orange-600">
                  {project.apartmentStats?.activeFixations ?? 0}
                </span>
              </div>
              <div className="pt-2 space-y-2">
                <Button className="w-full bg-green-600 hover:bg-green-700" size="lg" onClick={() => {
                  router.push(`/dashboard/projects/${project.id}/apartments`)
                }}>
                  <Grid3x3 className="mr-2 h-4 w-4" />
                  Шахматка квартир
                </Button>
                {/* Кнопка «Позвонить застройщику» убрана: она делала
                    tel:-переход, который на десктопе ничего не открывает.
                    Сам номер остаётся в карточке «Отдел продаж» ниже. */}
                {/* Ссылка на CRM застройщика - показывается только если указана */}
                {project.crmUrl && (
                  <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => {
                    window.open(project.crmUrl, '_blank')
                  }}>
                    <Building2 className="mr-2 h-4 w-4" />
                    CRM застройщика →
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {project.developerName && (
            <Card>
              <CardHeader>
                <CardTitle>Отдел продаж</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">{project.developerName}</p>
                    <p className="text-sm text-muted-foreground">Официальный офис</p>
                  </div>
                </div>
                {project.developerPhone && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    {project.developerPhone}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Mini Map */}
          {project.lat && project.lng && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Расположение</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Suspense fallback={
                  <div className="h-[200px] flex items-center justify-center bg-muted">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                }>
                  <ProjectMap
                    projects={[{
                      id: project.id,
                      name: project.name,
                      address: project.address,
                      lat: project.lat,
                      lng: project.lng,
                    }]}
                    center={[project.lat, project.lng]}
                    zoom={14}
                    height="200px"
                  />
                </Suspense>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Layout Image Dialog */}
      <Dialog open={!!selectedLayout} onOpenChange={() => setSelectedLayout(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              Планировка квартиры №{selectedLayout?.number}
            </DialogTitle>
          </DialogHeader>
          {selectedLayout && (
            <div className="space-y-4">
              <div className="aspect-square max-h-[60vh] bg-muted rounded-lg overflow-hidden">
                <img
                  src={selectedLayout.layoutImage}
                  alt={`Планировка ${selectedLayout.number}`}
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex gap-4">
                  <span><strong>{selectedLayout.rooms}</strong>-комнатная</span>
                  <span><strong>{selectedLayout.area}</strong> м²</span>
                  <span>Этаж: <strong>{selectedLayout.floor}</strong></span>
                </div>
                <div className="font-bold text-lg text-primary">
                  {formatPrice(selectedLayout.price)}
                </div>
              </div>
              {selectedLayout.status === "AVAILABLE" && (
                <Button
                  className="w-full bg-green-600 hover:bg-green-700"
                  onClick={() => {
                    setSelectedLayout(null)
                    router.push(`/dashboard/bookings/new?apartmentId=${selectedLayout.id}`)
                  }}
                >
                  Забронировать эту квартиру
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AddToSelectionDialog apartment={selectionApartment} onClose={() => setSelectionApartment(null)} />
      <MortgageQuickCalcDialog apartment={mortgageApartment} onClose={() => setMortgageApartment(null)} />
    </div>
  )
}
