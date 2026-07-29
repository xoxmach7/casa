"use client"

import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { FileText, Upload, X } from "lucide-react"
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

interface ExtractionSummary {
  creditHistoryDetected: boolean
  creditHistoryMatchedPhrase: string | null
  pensionDetected: boolean
  pensionEntriesFound: number
  debtEntriesFound: number
}

interface ScoringResponse {
  scoreValue: number
  approvalLikelihood: "HIGH" | "MEDIUM" | "LOW"
  avgMonthlyPension: number
  existingMonthlyDebt: number
  maxLoanAmount: number
  maxMonthlyPayment: number
  advice: string[]
  matchedPrograms: MatchedProgram[]
  extraction: ExtractionSummary
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

function FileSlot({
  label,
  hint,
  file,
  onChange,
  onClear,
}: {
  label: string
  hint: string
  file: File | null
  onChange: (file: File) => void
  onClear: () => void
}) {
  return (
    <div>
      <label className="text-sm text-muted-foreground">{label}</label>
      <p className="text-xs text-muted-foreground mb-1">{hint}</p>
      {file ? (
        <div className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
          <span className="flex items-center gap-2 truncate">
            <FileText className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">{file.name}</span>
          </span>
          <Button size="icon" variant="ghost" className="h-6 w-6 flex-shrink-0" onClick={onClear}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-3 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors">
          <Upload className="h-4 w-4" />
          Загрузить PDF
          <input
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onChange(f)
            }}
          />
        </label>
      )}
    </div>
  )
}

export function ScoringPanel() {
  const [clientSearch, setClientSearch] = useState("")
  const [clientResults, setClientResults] = useState<ClientSummary[]>([])
  const [selectedClient, setSelectedClient] = useState<ClientSummary | null>(null)

  const [creditHistoryFile, setCreditHistoryFile] = useState<File | null>(null)
  const [pensionFile, setPensionFile] = useState<File | null>(null)

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
    if (!selectedClient || (!creditHistoryFile && !pensionFile)) return
    setSubmitting(true)
    setError(null)
    setResult(null)
    try {
      const formData = new FormData()
      formData.append("clientId", selectedClient.id)
      if (creditHistoryFile) formData.append("creditHistoryFile", creditHistoryFile)
      if (pensionFile) formData.append("pensionFile", pensionFile)

      const res = await fetch(getApiUrl("scoring"), {
        method: "POST",
        headers: getAuthHeaders(),
        body: formData,
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error || "Не удалось рассчитать скоринг")
      }
      setResult(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось рассчитать скоринг")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardContent className="space-y-3 p-4">
          <h3 className="font-semibold">Документы клиента для скоринга</h3>
          <p className="text-sm text-muted-foreground">
            Загрузите PDF-документы клиента — систем сама прочитает статус кредитной истории, текущие
            кредитные обязательства и пенсионные отчисления.
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

          <FileSlot
            label="Справка о кредитной истории (КИ)"
            hint="Из кредитного бюро — используется для статуса КИ и текущих кредитных обязательств"
            file={creditHistoryFile}
            onChange={setCreditHistoryFile}
            onClear={() => setCreditHistoryFile(null)}
          />

          <FileSlot
            label="Выписка ЕНПФ (ПО)"
            hint="Используется для расчёта среднемесячных пенсионных отчислений"
            file={pensionFile}
            onChange={setPensionFile}
            onClear={() => setPensionFile(null)}
          />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button
            disabled={!selectedClient || (!creditHistoryFile && !pensionFile) || submitting}
            onClick={handleCalculate}
            className="w-full"
          >
            {submitting ? "Читаем документы и считаем..." : "Рассчитать скоринг"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-4">
          <h3 className="font-semibold">Результат</h3>
          {!result ? (
            <p className="text-sm text-muted-foreground">Загрузите документы слева и нажмите «Рассчитать скоринг».</p>
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

              <div className="rounded-lg border p-3 text-sm space-y-1">
                <p className="font-medium">Что удалось прочитать из документов</p>
                {result.extraction.creditHistoryDetected ? (
                  <p className="text-muted-foreground">
                    КИ: {result.extraction.creditHistoryMatchedPhrase
                      ? `найдена фраза «${result.extraction.creditHistoryMatchedPhrase}»`
                      : "явных признаков просрочки не найдено"}
                    , обязательства по кредитам: {formatPrice(result.existingMonthlyDebt)}/мес
                    ({result.extraction.debtEntriesFound} найдено)
                  </p>
                ) : (
                  <p className="text-muted-foreground">Справка КИ не загружена</p>
                )}
                {result.extraction.pensionDetected ? (
                  <p className="text-muted-foreground">
                    ПО: среднемесячные отчисления {formatPrice(result.avgMonthlyPension)}
                    ({result.extraction.pensionEntriesFound} записей найдено)
                  </p>
                ) : (
                  <p className="text-muted-foreground">Выписка ЕНПФ не загружена</p>
                )}
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
