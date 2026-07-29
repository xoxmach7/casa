"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getApiUrl, getAuthHeaders } from "@/lib/api-client"
import type { ApartmentCardData } from "./ApartmentCard"

interface SelectionSummary {
  id: string
  name: string | null
  client: { id: string; firstName: string; lastName: string; phone: string }
  _count: { apartments: number }
}

interface ClientSummary {
  id: string
  firstName: string
  lastName: string
  phone: string
}

interface AddToSelectionDialogProps {
  apartment: ApartmentCardData | null
  onClose: () => void
}

export function AddToSelectionDialog({ apartment, onClose }: AddToSelectionDialogProps) {
  const open = !!apartment

  const [selections, setSelections] = useState<SelectionSummary[]>([])
  const [loadingSelections, setLoadingSelections] = useState(false)
  const [mode, setMode] = useState<"existing" | "new">("existing")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [clientSearch, setClientSearch] = useState("")
  const [clientResults, setClientResults] = useState<ClientSummary[]>([])
  const [selectedClient, setSelectedClient] = useState<ClientSummary | null>(null)
  const [newSelectionName, setNewSelectionName] = useState("")

  useEffect(() => {
    if (!open) return
    setError(null)
    setMode("existing")
    setSelectedClient(null)
    setClientSearch("")
    setClientResults([])
    setNewSelectionName("")
    fetchSelections()
  }, [open])

  useEffect(() => {
    if (mode !== "new" || clientSearch.trim().length < 2) {
      setClientResults([])
      return
    }
    const timeout = setTimeout(() => fetchClients(clientSearch), 300)
    return () => clearTimeout(timeout)
  }, [clientSearch, mode])

  async function fetchSelections() {
    setLoadingSelections(true)
    try {
      const res = await fetch(getApiUrl("selections"), { headers: getAuthHeaders() })
      if (res.ok) setSelections(await res.json())
    } finally {
      setLoadingSelections(false)
    }
  }

  async function fetchClients(search: string) {
    const res = await fetch(getApiUrl(`clients?search=${encodeURIComponent(search)}&limit=10`), {
      headers: getAuthHeaders(),
    })
    if (res.ok) {
      const data = await res.json()
      setClientResults(data.clients ?? data)
    }
  }

  async function addToSelection(selectionId: string) {
    if (!apartment) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(getApiUrl(`selections/${selectionId}/apartments`), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ apartmentId: apartment.id }),
      })
      if (!res.ok) throw new Error()
      onClose()
    } catch {
      setError("Не удалось добавить квартиру в подборку")
    } finally {
      setSubmitting(false)
    }
  }

  async function createSelectionAndAdd() {
    if (!apartment || !selectedClient) return
    setSubmitting(true)
    setError(null)
    try {
      const createRes = await fetch(getApiUrl("selections"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ clientId: selectedClient.id, name: newSelectionName || undefined }),
      })
      if (!createRes.ok) throw new Error()
      const selection = await createRes.json()
      await addToSelection(selection.id)
    } catch {
      setError("Не удалось создать подборку")
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {apartment ? `Добавить квартиру № ${apartment.number} в подборку` : "Добавить в подборку"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 border-b pb-3">
          <Button size="sm" variant={mode === "existing" ? "default" : "outline"} onClick={() => setMode("existing")}>
            В существующую
          </Button>
          <Button size="sm" variant={mode === "new" ? "default" : "outline"} onClick={() => setMode("new")}>
            Создать новую
          </Button>
        </div>

        {mode === "existing" ? (
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {loadingSelections && <p className="text-sm text-muted-foreground">Загрузка...</p>}
            {!loadingSelections && selections.length === 0 && (
              <p className="text-sm text-muted-foreground">У вас пока нет подборок. Создайте новую.</p>
            )}
            {selections.map((s) => (
              <button
                key={s.id}
                disabled={submitting}
                onClick={() => addToSelection(s.id)}
                className="w-full rounded-lg border px-3 py-2 text-left text-sm hover:border-primary transition-colors disabled:opacity-50"
              >
                <span className="font-medium">
                  {s.name || `Подборка для ${s.client.firstName} ${s.client.lastName}`}
                </span>
                <span className="block text-muted-foreground">
                  {s.client.firstName} {s.client.lastName} · {s.client.phone} · {s._count.apartments} кв.
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            <Input
              placeholder="Поиск клиента по имени, телефону, ИИН..."
              value={clientSearch}
              onChange={(e) => {
                setClientSearch(e.target.value)
                setSelectedClient(null)
              }}
            />
            {selectedClient ? (
              <div className="rounded-lg border px-3 py-2 text-sm">
                Клиент: <span className="font-medium">{selectedClient.firstName} {selectedClient.lastName}</span> ({selectedClient.phone})
                <Button size="sm" variant="ghost" className="ml-2 h-auto p-0 text-xs" onClick={() => setSelectedClient(null)}>
                  изменить
                </Button>
              </div>
            ) : (
              clientResults.length > 0 && (
                <div className="max-h-40 space-y-1 overflow-y-auto">
                  {clientResults.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedClient(c)}
                      className="w-full rounded border px-3 py-1.5 text-left text-sm hover:border-primary transition-colors"
                    >
                      {c.firstName} {c.lastName} · {c.phone}
                    </button>
                  ))}
                </div>
              )
            )}
            <Input
              placeholder="Название подборки (необязательно)"
              value={newSelectionName}
              onChange={(e) => setNewSelectionName(e.target.value)}
            />
            <Button disabled={!selectedClient || submitting} onClick={createSelectionAndAdd} className="w-full">
              Создать и добавить квартиру
            </Button>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
      </DialogContent>
    </Dialog>
  )
}
