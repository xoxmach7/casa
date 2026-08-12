"use client"

import { useEffect, useState } from "react"
import { Check, X, Building2, Globe } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { getApiUrl, getAuthHeaders } from "@/lib/api-client"

interface Developer {
  id: string
  email: string
  firstName: string
  lastName: string
  phone: string
  status: string
  isActive: boolean
  companyName: string
  bin: string
  companyPhone: string
  companyWebsite: string
  companyDescription: string
  companyLogo: string
  createdAt: string
  _count: { projects: number }
}

type StatusValue = "PENDING" | "ACTIVE" | "REJECTED"

const TABS: { value: StatusValue; label: string; empty: string }[] = [
  { value: "PENDING", label: "Заявки", empty: "Нет заявок" },
  { value: "ACTIVE", label: "Активные", empty: "Нет застройщиков" },
  { value: "REJECTED", label: "Отклонённые", empty: "Нет застройщиков" },
]

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

function DeveloperCard({
  dev,
  showActions,
  acting,
  onApprove,
  onReject,
}: {
  dev: Developer
  showActions: boolean
  acting: boolean
  onApprove: () => void
  onReject: () => void
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            {dev.companyName}
          </CardTitle>
          <Badge variant="secondary">ЖК: {dev._count?.projects ?? 0}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
          <p>БИН: {dev.bin}</p>
          <p>Контакт: {dev.firstName} {dev.lastName}</p>
          <p>Email: {dev.email}</p>
          <p>Телефон: {dev.phone}</p>
          {dev.companyWebsite && (
            <p className="flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5" />
              <a href={dev.companyWebsite} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                {dev.companyWebsite}
              </a>
            </p>
          )}
        </div>
        <p className="text-xs text-muted-foreground">Заявка от {formatDate(dev.createdAt)}</p>
        {showActions && (
          <div className="flex gap-2">
            <Button size="sm" disabled={acting} onClick={onApprove}>
              <Check className="mr-1.5 h-4 w-4" />
              Одобрить
            </Button>
            <Button size="sm" variant="destructive" disabled={acting} onClick={onReject}>
              <X className="mr-1.5 h-4 w-4" />
              Отклонить
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function DevelopersTab({ status, empty }: { status: StatusValue; empty: string }) {
  const [developers, setDevelopers] = useState<Developer[]>([])
  const [loading, setLoading] = useState(true)
  const [actingId, setActingId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(getApiUrl(`/admin/developers?status=${status}`), { headers: getAuthHeaders() })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (!cancelled) setDevelopers(Array.isArray(data) ? data : [])
      })
      .catch(() => {
        if (!cancelled) setDevelopers([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [status])

  async function decide(id: string, action: "approve" | "reject") {
    setActingId(id)
    const previous = developers
    setDevelopers((list) => list.filter((d) => d.id !== id))
    try {
      const res = await fetch(getApiUrl(`/admin/developers/${id}/${action}`), {
        method: "POST",
        headers: getAuthHeaders(),
      })
      if (!res.ok) throw new Error()
      toast.success(action === "approve" ? "Застройщик одобрен" : "Заявка отклонена")
    } catch {
      setDevelopers(previous)
      toast.error("Не удалось выполнить действие")
    } finally {
      setActingId(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    )
  }

  if (developers.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">{empty}</CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {developers.map((dev) => (
        <DeveloperCard
          key={dev.id}
          dev={dev}
          showActions={status === "PENDING"}
          acting={actingId === dev.id}
          onApprove={() => decide(dev.id, "approve")}
          onReject={() => decide(dev.id, "reject")}
        />
      ))}
    </div>
  )
}

export default function AdminDevelopersPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Застройщики</h1>
        <p className="text-muted-foreground">Заявки на регистрацию и активные застройщики</p>
      </div>

      <Tabs defaultValue="PENDING" className="space-y-4">
        <TabsList>
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {TABS.map((t) => (
          <TabsContent key={t.value} value={t.value}>
            <DevelopersTab status={t.value} empty={t.empty} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
