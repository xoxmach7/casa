"use client"

import { useState, useMemo, lazy, Suspense } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { ArrowLeft, Building2, MapPin, Loader2, ImagePlus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { FileUpload } from "@/components/file-upload"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { API_URL } from "@/lib/config"
import { useToast } from "@/hooks/use-toast"
import { Checkbox } from "@/components/ui/checkbox"

// Динамический импорт карты
const ProjectMap = lazy(() => import("@/components/map/project-map"))

// Список программ ипотеки
const MORTGAGE_PROGRAMS = [
  { id: "7-20-25", label: "7-20-25" },
  { id: "baspana-hit", label: "Баспана Хит" },
  { id: "otau", label: "Отау" },
  { id: "military", label: "Военная ипотека" },
  { id: "standard", label: "Стандартная ипотека" },
  { id: "commercial", label: "Коммерческая ипотека" },
]

const formSchema = z.object({
  name: z.string().min(1, "Название обязательно"),
  city: z.string().min(1, "Город обязателен"),
  district: z.string().optional(),
  address: z.string().min(1, "Адрес обязателен"),
  lat: z.number().optional(),
  lng: z.number().optional(),
  class: z.string().optional(),
  buildingStatus: z.string().optional(),
  deliveryDate: z.string().optional(),
  description: z.string().optional(),
  developerName: z.string().optional(),
  developerPhone: z.string().optional(),
  crmUrl: z.string().optional(),
  bonus: z.string().optional(),
  promotions: z.string().optional(),
  videoUrl: z.string().optional(),
})

type FormValues = z.infer<typeof formSchema>

// Координаты Астаны
const ASTANA_CENTER: [number, number] = [51.1694, 71.4491]

export default function NewProjectPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [projectImages, setProjectImages] = useState<string[]>([])
  const [selectedMortgagePrograms, setSelectedMortgagePrograms] = useState<string[]>([])

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      city: "Astana",
      district: "",
      address: "",
      class: "",
      buildingStatus: "",
      deliveryDate: "",
      description: "",
      developerName: "",
      developerPhone: "",
      crmUrl: "",
      bonus: "",
      promotions: "",
      videoUrl: "",
    },
  })

  const selectedCity = form.watch("city")
  
  // Карта только для Астаны
  const mapCenter = ASTANA_CENTER

  const handleLocationSelect = (lat: number, lng: number, address: string) => {
    setSelectedLocation({ lat, lng })
    form.setValue("lat", lat)
    form.setValue("lng", lng)
    // Если адрес пустой, заполняем из карты
    if (!form.getValues("address")) {
      // Извлекаем краткий адрес
      const shortAddress = address.split(",").slice(0, 3).join(",")
      form.setValue("address", shortAddress)
    }
  }

  async function onSubmit(values: FormValues) {
    setLoading(true)
    const token = localStorage.getItem("token")

    try {
      const response = await fetch(`${API_URL}/projects`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...values,
          lat: values.lat || selectedLocation?.lat,
          lng: values.lng || selectedLocation?.lng,
          images: projectImages,
          mortgagePrograms: selectedMortgagePrograms,
        }),
      })

      if (response.ok) {
        toast({
          title: "Проект создан",
          description: "Новый ЖК успешно добавлен в каталог",
        })
        router.push("/dashboard/projects")
      } else {
        const error = await response.json()
        toast({
          title: "Ошибка",
          description: error.error || "Не удалось создать проект",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Failed to create project:", error)
      toast({
        title: "Ошибка",
        description: "Произошла ошибка при создании проекта",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Новый проект</h1>
          <p className="text-muted-foreground">
            Добавление нового жилого комплекса в каталог
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Основная информация</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Название ЖК</FormLabel>
                    <FormControl>
                      <Input placeholder="Например: Nova City" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Город</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Выберите город" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Astana">Астана</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="district"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Район</FormLabel>
                      <FormControl>
                        <Input placeholder="Например: Есильский" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Адрес</FormLabel>
                    <FormControl>
                      <Input placeholder="Улица, дом (или выберите на карте)" {...field} />
                    </FormControl>
                    <FormDescription>
                      Можете указать вручную или выбрать на карте ниже
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Карта для выбора местоположения */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Местоположение на карте
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Suspense fallback={
                <div className="h-[400px] flex items-center justify-center bg-muted rounded-lg">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              }>
                <ProjectMap
                  center={mapCenter}
                  zoom={12}
                  height="400px"
                  selectMode={true}
                  onLocationSelect={handleLocationSelect}
                  selectedLocation={selectedLocation}
                />
              </Suspense>
              {selectedLocation && (
                <div className="mt-2 text-sm text-muted-foreground">
                  Выбрано: {selectedLocation.lat.toFixed(6)}, {selectedLocation.lng.toFixed(6)}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Фотографии проекта */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImagePlus className="h-5 w-5" />
                Фотографии ЖК
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FileUpload
                onUpload={(files) => {
                  const newUrls = files.map(f => f.url)
                  setProjectImages(prev => [...prev, ...newUrls])
                }}
                onRemove={(url) => {
                  setProjectImages(prev => prev.filter(img => img !== url))
                }}
                existingFiles={projectImages}
                category="images"
                multiple={true}
                maxFiles={20}
                maxSize={10}
              />
              
              {projectImages.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                  {projectImages.map((url, index) => (
                    <div key={index} className="relative group aspect-video rounded-lg overflow-hidden border">
                      <img
                        src={url}
                        alt={`Фото ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => setProjectImages(prev => prev.filter(img => img !== url))}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Характеристики</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="class"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Класс жилья</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Выберите класс" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="эконом">Эконом</SelectItem>
                          <SelectItem value="комфорт">Комфорт</SelectItem>
                          <SelectItem value="бизнес">Бизнес</SelectItem>
                          <SelectItem value="премиум">Премиум</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="buildingStatus"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Статус строительства</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Выберите статус" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="UNDER_CONSTRUCTION">Строится</SelectItem>
                          <SelectItem value="COMPLETED">Сдан</SelectItem>
                          <SelectItem value="READY_TO_MOVE">Готов к заселению</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="deliveryDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Срок сдачи</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Описание</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Подробное описание проекта..."
                        className="min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="videoUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ссылка на видео (YouTube)</FormLabel>
                    <FormControl>
                      <Input placeholder="https://youtube.com/..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Застройщик</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="developerName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Название компании</FormLabel>
                      <FormControl>
                        <Input placeholder="Название компании застройщика" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="developerPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Телефон отдела продаж</FormLabel>
                      <FormControl>
                        <Input placeholder="+7..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="crmUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ссылка на CRM застройщика</FormLabel>
                    <FormControl>
                      <Input placeholder="https://crm.example.kz/..." {...field} />
                    </FormControl>
                    <FormDescription>
                      Эта ссылка будет доступна брокерам для перехода в CRM
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="bonus"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Бонусная программа для брокеров</FormLabel>
                    <FormControl>
                      <Input placeholder="Например: 2% от сделки" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Программы и акции */}
          <Card>
            <CardHeader>
              <CardTitle>Программы ипотеки и акции</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <FormLabel>Доступные программы ипотеки</FormLabel>
                <FormDescription className="mb-3">
                  Выберите программы, по которым можно приобрести квартиры в этом ЖК
                </FormDescription>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {MORTGAGE_PROGRAMS.map((program) => (
                    <div key={program.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={program.id}
                        checked={selectedMortgagePrograms.includes(program.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedMortgagePrograms([...selectedMortgagePrograms, program.id])
                          } else {
                            setSelectedMortgagePrograms(selectedMortgagePrograms.filter(p => p !== program.id))
                          }
                        }}
                      />
                      <label
                        htmlFor={program.id}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {program.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <FormField
                control={form.control}
                name="promotions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Специальные акции и условия</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Например: Скидка 5% при 100% оплате, Рассрочка 0% на 12 месяцев, Паркинг в подарок..."
                        className="min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Опишите текущие акции и специальные условия для покупателей
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button variant="outline" type="button" onClick={() => router.back()}>
              Отмена
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Создание...
                </>
              ) : (
                <>
                  <Building2 className="mr-2 h-4 w-4" />
                  Создать проект
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
