"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FileUpload } from "@/components/file-upload"
import { API_URL } from "@/lib/config"
import { toast } from "@/hooks/use-toast"

interface Client {
  id: string
  firstName: string
  lastName: string
  phone: string
}

export default function EditPropertyPage() {
  const router = useRouter()
  const params = useParams()
  const propertyId = params.id as string
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [sellers, setSellers] = useState<Client[]>([])
  const [formData, setFormData] = useState({
    title: "",
    propertyType: "APARTMENT",
    city: "Астана",
    district: "",
    address: "",
    floor: "",
    rooms: "",
    area: "",
    price: "",
    sellerId: "",
    description: "",
    features: "",
    images: [] as string[],
    status: "AVAILABLE",
  })

  useEffect(() => {
    fetchProperty()
    fetchSellers()
  }, [propertyId])

  const fetchProperty = async () => {
    const token = localStorage.getItem("token")
    if (!token) return

    try {
      const res = await fetch(`${API_URL}/properties/${propertyId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (res.ok) {
        const data = await res.json()
        setFormData({
          title: data.title || "",
          propertyType: data.propertyType || "APARTMENT",
          city: data.city || "Астана",
          district: data.district || "",
          address: data.address || "",
          floor: data.floor?.toString() || "",
          rooms: data.rooms?.toString() || "",
          area: data.area?.toString() || "",
          price: data.price?.toString() || "",
          sellerId: data.sellerId || "",
          description: data.description || "",
          features: data.features?.join(", ") || "",
          images: data.images || [],
          status: data.status || "AVAILABLE",
        })
      } else {
        toast({ title: "Ошибка", description: "Не удалось загрузить объект", variant: "destructive" })
        router.push("/dashboard/properties")
      }
    } catch (error) {
      console.error("Failed to fetch property:", error)
      toast({ title: "Ошибка", description: "Ошибка загрузки", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const fetchSellers = async () => {
    const token = localStorage.getItem("token")
    if (!token) return

    try {
      const res = await fetch(`${API_URL}/clients?clientType=SELLER&limit=100`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (res.ok) {
        const data = await res.json()
        setSellers(data.clients || [])
      }
    } catch (error) {
      console.error("Failed to fetch sellers:", error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    const token = localStorage.getItem("token")
    if (!token) return

    try {
      const payload = {
        ...formData,
        floor: formData.floor ? parseInt(formData.floor) : null,
        rooms: formData.rooms ? parseInt(formData.rooms) : null,
        area: parseFloat(formData.area),
        price: parseFloat(formData.price),
        features: formData.features ? formData.features.split(",").map(f => f.trim()) : [],
      }

      const res = await fetch(`${API_URL}/properties/${propertyId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        toast({ title: "Успешно", description: "Объект обновлен" })
        router.push(`/dashboard/properties/${propertyId}`)
      } else {
        const error = await res.json()
        toast({ title: "Ошибка", description: error.message || "Не удалось обновить", variant: "destructive" })
      }
    } catch (error) {
      console.error("Failed to update property:", error)
      toast({ title: "Ошибка", description: "Ошибка при сохранении", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleFilesUploaded = (files: { url: string }[]) => {
    const newUrls = files.map(f => f.url)
    setFormData({
      ...formData,
      images: [...formData.images, ...newUrls],
    })
  }

  const handleFileRemove = (url: string) => {
    setFormData({
      ...formData,
      images: formData.images.filter(img => img !== url),
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-3xl font-bold tracking-tight">Редактирование объекта</h2>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Основная информация</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="title">Название объекта *</Label>
                <Input
                  id="title"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Например: 3-комнатная квартира в центре"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="propertyType">Тип объекта *</Label>
                <Select
                  value={formData.propertyType}
                  onValueChange={(value) => setFormData({ ...formData, propertyType: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="APARTMENT">Квартира</SelectItem>
                    <SelectItem value="HOUSE">Дом</SelectItem>
                    <SelectItem value="COMMERCIAL">Коммерческая</SelectItem>
                    <SelectItem value="LAND">Участок</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Статус *</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AVAILABLE">Доступен</SelectItem>
                    <SelectItem value="RESERVED">Забронирован</SelectItem>
                    <SelectItem value="SOLD">Продан</SelectItem>
                    <SelectItem value="CANCELLED">Снят с продажи</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="city">Город *</Label>
                <Select
                  value={formData.city}
                  onValueChange={(value) => setFormData({ ...formData, city: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Астана">Астана</SelectItem>
                    <SelectItem value="Алматы">Алматы</SelectItem>
                    <SelectItem value="Шымкент">Шымкент</SelectItem>
                    <SelectItem value="Актобе">Актобе</SelectItem>
                    <SelectItem value="Караганда">Караганда</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="district">Район</Label>
                <Input
                  id="district"
                  value={formData.district}
                  onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                  placeholder="Например: Есильский"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="address">Адрес *</Label>
                <Input
                  id="address"
                  required
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Например: ул. Кабанбай батыра, 58"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sellerId">Продавец</Label>
                <Select
                  value={formData.sellerId || "none"}
                  onValueChange={(value) => setFormData({ ...formData, sellerId: value === "none" ? "" : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите продавца" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Не выбран</SelectItem>
                    {sellers.map((seller) => (
                      <SelectItem key={seller.id} value={seller.id}>
                        {seller.firstName} {seller.lastName} ({seller.phone})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Характеристики</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="rooms">Комнат</Label>
                <Input
                  id="rooms"
                  type="number"
                  min="0"
                  value={formData.rooms}
                  onChange={(e) => setFormData({ ...formData, rooms: e.target.value })}
                  placeholder="Количество комнат"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="area">Площадь (м²) *</Label>
                <Input
                  id="area"
                  type="number"
                  step="0.1"
                  min="0"
                  required
                  value={formData.area}
                  onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                  placeholder="Общая площадь"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="floor">Этаж</Label>
                <Input
                  id="floor"
                  type="number"
                  min="0"
                  value={formData.floor}
                  onChange={(e) => setFormData({ ...formData, floor: e.target.value })}
                  placeholder="Номер этажа"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="price">Цена (₸) *</Label>
                <Input
                  id="price"
                  type="number"
                  min="0"
                  required
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="Цена объекта"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Дополнительно</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="description">Описание</Label>
                <Textarea
                  id="description"
                  rows={4}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Подробное описание объекта..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="features">Особенности (через запятую)</Label>
                <Input
                  id="features"
                  value={formData.features}
                  onChange={(e) => setFormData({ ...formData, features: e.target.value })}
                  placeholder="ремонт, мебель, техника"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Фотографии</CardTitle>
            </CardHeader>
            <CardContent>
              <FileUpload
                onUpload={handleFilesUploaded}
                onRemove={handleFileRemove}
                existingFiles={formData.images}
                category="images"
                multiple={true}
                maxFiles={20}
                maxSize={10}
              />
              <p className="text-sm text-muted-foreground mt-2">
                Загрузите фотографии объекта (до 20 фото, макс. 10MB каждая)
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end gap-4 mt-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
          >
            Отмена
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Сохранение..." : "Сохранить изменения"}
          </Button>
        </div>
      </form>
    </div>
  )
}
