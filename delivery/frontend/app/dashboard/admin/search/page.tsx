"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getApiUrl, getAuthHeaders } from "@/lib/api-client"

interface SearchResults {
  clients: { id: string; firstName: string; lastName: string; phone: string }[]
  properties: { id: string; residentialComplex: string; district: string; address: string | null }[]
  apartments: { id: string; number: string; project: { id: string; name: string } }[]
  projects: { id: string; name: string; developerName: string | null; city: string }[]
  fixations: { id: string; status: string; client: { id: string; firstName: string; lastName: string }; project: { id: string; name: string } }[]
}

const EMPTY_RESULTS: SearchResults = { clients: [], properties: [], apartments: [], projects: [], fixations: [] }

export default function GlobalSearchPage() {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResults>(EMPTY_RESULTS)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults(EMPTY_RESULTS)
      return
    }
    setLoading(true)
    const timeout = setTimeout(() => {
      fetch(getApiUrl(`admin/search?q=${encodeURIComponent(query)}`), { headers: getAuthHeaders() })
        .then((r) => (r.ok ? r.json() : EMPTY_RESULTS))
        .then(setResults)
        .finally(() => setLoading(false))
    }, 300)
    return () => clearTimeout(timeout)
  }, [query])

  const totalResults =
    results.clients.length + results.properties.length + results.apartments.length + results.projects.length + results.fixations.length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Глобальный поиск</h1>
        <p className="text-muted-foreground">Клиенты, объекты, квартиры, ЖК и фиксации в одном месте</p>
      </div>

      <div className="relative max-w-xl">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Имя, телефон, ИИН, ЖК, застройщик, номер квартиры..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {loading && <p className="text-sm text-muted-foreground">Ищем...</p>}

      {!loading && query.trim().length >= 2 && totalResults === 0 && (
        <p className="text-sm text-muted-foreground">Ничего не найдено.</p>
      )}

      {results.clients.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Клиенты</h3>
          <div className="space-y-2">
            {results.clients.map((c) => (
              <Card key={c.id} className="cursor-pointer hover:border-primary" onClick={() => router.push(`/dashboard/clients/${c.id}`)}>
                <CardContent className="p-3 text-sm">
                  {c.firstName} {c.lastName} · {c.phone}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {results.properties.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Объекты вторички</h3>
          <div className="space-y-2">
            {results.properties.map((p) => (
              <Card key={p.id}>
                <CardContent className="p-3 text-sm">
                  {p.residentialComplex} — {p.district}{p.address ? `, ${p.address}` : ""}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {results.projects.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-muted-foreground">ЖК</h3>
          <div className="space-y-2">
            {results.projects.map((p) => (
              <Card key={p.id} className="cursor-pointer hover:border-primary" onClick={() => router.push(`/dashboard/projects/${p.id}`)}>
                <CardContent className="p-3 text-sm">
                  {p.name}{p.developerName ? ` — ${p.developerName}` : ""} · {p.city}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {results.apartments.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Квартиры</h3>
          <div className="space-y-2">
            {results.apartments.map((a) => (
              <Card key={a.id} className="cursor-pointer hover:border-primary" onClick={() => router.push(`/dashboard/projects/${a.project.id}`)}>
                <CardContent className="p-3 text-sm">
                  {a.project.name} — № {a.number}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {results.fixations.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Фиксации</h3>
          <div className="space-y-2">
            {results.fixations.map((f) => (
              <Card key={f.id}>
                <CardContent className="flex items-center justify-between p-3 text-sm">
                  <span>{f.client.firstName} {f.client.lastName} — {f.project.name}</span>
                  <Badge variant="outline">{f.status}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
