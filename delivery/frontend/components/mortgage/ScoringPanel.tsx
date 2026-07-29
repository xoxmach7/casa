"use client"

import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { getApiUrl, getAuthHeaders } from "@/lib/api-client"

interface ClientSummary {
  id: string
  firstName: string
  lastName: string
  phone: string
  monthlyIncome: number | null
}

interface MatchedProgram {
  id: string
  bankName: string
  programName: string
  interestRate: number
  maxTerm: number
  estimatedMonthlyPayment: number
}

interface ScoringResponse {
  scoreValue: number
  approvalLikelihood: "HIGH" | "MEDIUM" | "LOW"
  maxLoanAmount: number
  maxMonthlyPayment: number
  advice: string[]
  matchedPrograms: MatchedProgram[]
}

function formatPrice(price: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "KZT",
    maximumFractionDigits: 0,
  }).format(price)
}

function approvalLabel(level: ScoringResponse["approvalLikelihood"]) {
  switch (level) {
    case "HIGH":
      return { text: "Высокая вероятность одобрения", className: "bg-green-500" }
    case "MEDIUM":
      return { text: "Средняя вероятность одобрения", className: "bg-yellow-500 text-black" }
    case "LOW":
      return { text: "Низкая вероятность одобрения", className: "bg-red-500" }
  }
}

export function ScoringPanel() {
  const [clientSearch, setClientSearch] = useState("")
  const [clientResults, setClientResults] = useState<ClientSummary[]>([])
  const [selectedClient, setSelectedClient] = useState<ClientSummary | null>(null)

  const [creditHistoryStatus, setCreditHistoryStatus] = useState<"GOOD" | "HAS_DELAYS" | "BAD">("GOOD")
  const [avgMonthlyPension, setAvgMonthlyPension] = useState("")
  const [existingMonthlyDebt, setExistingMonthlyDebt] = useState("")

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ScoringResponse | null>(null)

  useEffect(() => {
    if (clientSearch.trim().length < 2) {
      setClientResults([])
      return
    }
    const timeout = setTimeout(() => {
      fetch(getApiUrl(`clients?search=${encodeURIComponent(clientSearch)}&limit=10`), {
        headers: getAuthHeaders(),
      })
        .then((r) => (r.ok ? r.json() : { clients: [] }))
        .then((data) => setClientResults(data.clients ?? data))
    }, 300)
    return () => clearTimeout(timeout)
  }, [clientSearch])

  async function handleCalculate() {
    if (!selectedClient) return
    setSubmitting(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch(getApiUrl("scoring"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          clientId: selectedClient.id,
          creditHistoryStatus,
          avgMonthlyPension: Number(avgMonthlyPension) || 0,
          existingMonthlyDebt: Number(existingMonthlyDebt) || 0,
        }),
      })
      if (!res.ok) throw new Error()
      setResult(await res.json())
    } catch {
      setError("Не удалось рассчитать скоринг")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardContent className="space-y-3 p-4">
          <h3 className="font-semibold">Данные клиента для скоринга</h3>
          <p className="text-sm text-muted-foreground">
            КИ и ПО вводятся вручную, пока нет интеграции с ЕНПФ/кредитным бюро.
          </p>

          <Input
            placeholder="Поиск клиента по имени, телефону, ИИН..."
            value={clientSearch}
            onChange={(e) => {
              setClientSearch(e.target.value)
              setSelectedClient(null)
              setResult(null)
            }}
          />
          {selectedClient ? (
            <div className="rounded-lg border px-3 py-2 text-sm">
              Клиент: <span className="font-medium">{selectedClient.firstName} {selectedClient.lastName}</span>
              <span className="block text-muted-foreground">
                Доход: {selectedClient.monthlyIncome ? formatPrice(selectedClient.monthlyIncome) : "не указан"}
              </span>
              <Button size="sm" variant="ghost" className="h-auto p-0 text-xs" onClick={() => setSelectedClient(null)}>
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

          <div>
            <label className="text-sm text-muted-foreground">Кредитная история (КИ)</label>
            <Select value={creditHistoryStatus} onValueChange={(v) => setCreditHistoryStatus(v as typeof creditHistoryStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GOOD">Хорошая, без просрочек</SelectItem>
                <SelectItem value="HAS_DELAYS">Были просрочки в прошлом</SelectItem>
                <SelectItem value="BAD">Плохая / активная просрочка</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-muted-foreground">Средние ПО в месяц</label>
              <Input
                type="number"
                min={0}
                value={avgMonthlyPension}
                onChange={(e) => setAvgMonthlyPension(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Текущие платежи по долгам</label>
              <Input
                type="number"
                min={0}
                value={existingMonthlyDebt}
                onChange={(e) => setExistingMonthlyDebt(e.target.value)}
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button disabled={!selectedClient || submitting} onClick={handleCalculate} className="w-full">
            {submitting ? "Расчёт..." : "Рассчитать скоринг"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-4">
          <h3 className="font-semibold">Результат</h3>
          {!result ? (
            <p className="text-sm text-muted-foreground">Заполните данные слева и нажмите «Рассчитать скоринг».</p>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <span className="text-3xl font-bold">{result.scoreValue}</span>
                <Badge className={approvalLabel(result.approvalLikelihood).className}>
                  {approvalLabel(result.approvalLikelihood).text}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border p-3">
                  <p className="text-muted-foreground">Макс. сумма кредита</p>
                  <p className="text-lg font-semibold">{formatPrice(result.maxLoanAmount)}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-muted-foreground">Макс. ежемесячный платёж</p>
                  <p className="text-lg font-semibold">{formatPrice(result.maxMonthlyPayment)}</p>
                </div>
              </div>

              <div>
                <p className="mb-1 text-sm font-medium">Советы</p>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {result.advice.map((a, i) => (
                    <li key={i}>• {a}</li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="mb-1 text-sm font-medium">Подходящие программы</p>
                {result.matchedPrograms.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Ни одна программа из каталога не подходит под этот расчёт.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {result.matchedPrograms.map((p) => (
                      <div key={p.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                        <span>{p.bankName} — {p.programName} ({p.interestRate}%)</span>
                        <span className="font-medium">{formatPrice(p.estimatedMonthlyPayment)}/мес</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
