"use client"

import { useEffect, useState } from "react"
import { Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { getApiUrl, getAuthHeaders } from "@/lib/api-client"

interface LandingLead {
  id: string
  name: string
  phone: string
  role: string
  source: string
  status: string
  createdAt: string
}

const STATUS_OPTIONS = [
  { value: "NEW", label: "Новые" },
  { value: "CONTACTED", label: "Связались" },
  { value: "REJECTED", label: "Отклонённые" },
]

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
}

export default function LandingLeadsPage() {
  const [status, setStatus] = useState("NEW")
  const [leads, setLeads] = useState<LandingLead[]>([])
  const [loading, setLoading] = useState(true)
  const [actingId, setActingId] = useState<string | null>(null)

  useEffect(() => {
    fetchLeads()
  }, [status])

  function fetchLeads() {
    setLoading(true)
    fetch(getApiUrl(`admin/landing-leads?status=${status}`), { headers: getAuthHeaders() })
      .then((r) => (r.ok ? r.json() : []))
      .then(setLeads)
      .finally(() => setLoading(false))
  }

  async function decide(id: string, decision: "CONTACTED" | "REJECTED") {
    setActingId(id)
    await fetch(getApiUrl(`admin/landing-leads/${id}/decision`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ decision }),
    })
    setActingId(null)
    fetchLeads()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Заявки с лендинга</h1>
          <p className="text-muted-foreground">Запросы доступа к CASA Pro с публичного сайта</p>
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
      ) : leads.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Очередь пуста.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {leads.map((lead) => (
            <Card key={lead.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {lead.name} — {lead.role}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{lead.phone}</p>
                <p className="text-xs text-muted-foreground">
                  Источник: {lead.source === "gpt-taste" ? "/gpt-taste" : "/"} · {formatDate(lead.createdAt)}
                </p>
                {lead.status === "NEW" && (
                  <div className="flex gap-2">
                    <Button size="sm" disabled={actingId === lead.id} onClick={() => decide(lead.id, "CONTACTED")}>
                      <Check className="mr-1.5 h-4 w-4" />
                      Связались
                    </Button>
                    <Button size="sm" variant="destructive" disabled={actingId === lead.id} onClick={() => decide(lead.id, "REJECTED")}>
                      <X className="mr-1.5 h-4 w-4" />
                      Отклонить
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
