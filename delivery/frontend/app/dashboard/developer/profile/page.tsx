"use client"

import { useEffect, useState } from "react"
import { Building2, Loader2, User } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { FileUpload } from "@/components/file-upload"
import { getApiUrl, getAuthHeaders } from "@/lib/api-client"
import { toast } from "sonner"

// Логотип может прийти относительным путём (/uploads/...), к превью нужен полный URL.
const BACKEND_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001").replace(/\/api\/?$/, "")
const resolveUrl = (url: string) => {
  if (!url) return ""
  return url.startsWith("http") ? url : `${BACKEND_BASE}${url}`
}

interface ProfileData {
  companyName: string
  bin: string
  companyPhone: string
  companyLogo: string
  companyWebsite: string
  companyDescription: string
  firstName: string
  lastName: string
  email: string
  role: string
}

const EMPTY: ProfileData = {
  companyName: "",
  bin: "",
  companyPhone: "",
  companyLogo: "",
  companyWebsite: "",
  companyDescription: "",
  firstName: "",
  lastName: "",
  email: "",
  role: "",
}

export default function DeveloperProfilePage() {
  const [data, setData] = useState<ProfileData>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(getApiUrl("/auth/me"), { headers: getAuthHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((me) => {
        if (me) {
          setData({
            companyName: me.companyName ?? "",
            bin: me.bin ?? "",
            companyPhone: me.companyPhone ?? "",
            companyLogo: me.companyLogo ?? "",
            companyWebsite: me.companyWebsite ?? "",
            companyDescription: me.companyDescription ?? "",
            firstName: me.firstName ?? "",
            lastName: me.lastName ?? "",
            email: me.email ?? "",
            role: me.role ?? "",
          })
        }
      })
      .catch(() => toast.error("Не удалось загрузить профиль"))
      .finally(() => setLoading(false))
  }, [])

  const set = (key: keyof ProfileData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => setData((prev) => ({ ...prev, [key]: e.target.value }))

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(getApiUrl("/auth/developer-profile"), {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          companyName: data.companyName,
          bin: data.bin,
          companyPhone: data.companyPhone,
          companyWebsite: data.companyWebsite,
          companyDescription: data.companyDescription,
          companyLogo: data.companyLogo,
        }),
      })
      if (!res.ok) throw new Error("save failed")
      toast.success("Профиль сохранён")
    } catch {
      toast.error("Не удалось сохранить профиль")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6 max-w-2xl">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Профиль компании</h1>
        <p className="text-muted-foreground">
          Данные о застройщике, которые видят брокеры
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Реквизиты компании
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="companyName">Название компании</Label>
            <Input
              id="companyName"
              value={data.companyName}
              onChange={set("companyName")}
              placeholder="Например: BI Group"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bin">БИН</Label>
            <Input
              id="bin"
              value={data.bin}
              onChange={set("bin")}
              placeholder="12 цифр"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="companyPhone">Телефон компании</Label>
            <Input
              id="companyPhone"
              value={data.companyPhone}
              onChange={set("companyPhone")}
              placeholder="+7..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="companyWebsite">Сайт</Label>
            <Input
              id="companyWebsite"
              value={data.companyWebsite}
              onChange={set("companyWebsite")}
              placeholder="https://..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="companyDescription">Описание</Label>
            <Textarea
              id="companyDescription"
              value={data.companyDescription}
              onChange={set("companyDescription")}
              placeholder="Коротко о компании..."
              className="min-h-[100px]"
            />
          </div>

          <div className="space-y-2">
            <Label>Логотип</Label>
            {data.companyLogo && (
              <div className="flex items-center gap-3">
                <img
                  src={resolveUrl(data.companyLogo)}
                  alt="Логотип компании"
                  className="h-20 w-20 rounded-lg border object-contain bg-muted"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setData((prev) => ({ ...prev, companyLogo: "" }))}
                >
                  Удалить
                </Button>
              </div>
            )}
            <FileUpload
              category="images"
              multiple={false}
              maxFiles={1}
              maxSize={10}
              onUpload={(files) => {
                if (files[0]?.url) {
                  setData((prev) => ({ ...prev, companyLogo: files[0].url }))
                }
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Контактное лицо
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Имя</p>
              <p className="font-medium">{data.firstName || "—"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Фамилия</p>
              <p className="font-medium">{data.lastName || "—"}</p>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Email</p>
            <p className="font-medium">{data.email || "—"}</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Сохранение...
            </>
          ) : (
            "Сохранить"
          )}
        </Button>
      </div>
    </div>
  )
}
