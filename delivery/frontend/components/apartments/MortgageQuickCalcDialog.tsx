"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getApiUrl, getAuthHeaders } from "@/lib/api-client"
import { getQuote, type Quote } from "@/lib/mortgage/calc-tools-api"
import type { ApartmentCardData } from "./ApartmentCard"

interface MortgageProgram {
  id: string
  bankName: string
  programName: string
  interestRate: number
  minDownPayment: number
  maxTerm: number
}

interface ClientSummary {
  id: string
  firstName: string
  lastName: string
  phone: string
}

interface MortgageQuickCalcDialogProps {
  apartment: ApartmentCardData | null
  onClose: () => void
}

function formatPrice(price: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "KZT",
    maximumFractionDigits: 0,
  }).format(price)
}

/** Показ денежной строки сервера: группировка разрядов, без пересчёта. */
function formatKzt(serverValue: string): string {
  const [whole, fraction] = serverValue.split(".")
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ")
  return `${grouped}${fraction && fraction !== "00" ? `,${fraction}` : ""} ₸`
}

export function MortgageQuickCalcDialog({ apartment, onClose }: MortgageQuickCalcDialogProps) {
  const open = !!apartment

  const [programs, setPrograms] = useState<MortgageProgram[]>([])
  const [selectedProgramId, setSelectedProgramId] = useState<string>("")
  const [initialPayment, setInitialPayment] = useState("")
  const [termYears, setTermYears] = useState("20")

  const [clientSearch, setClientSearch] = useState("")
  const [clientResults, setClientResults] = useState<ClientSummary[]>([])
  const [selectedClient, setSelectedClient] = useState<ClientSummary | null>(null)

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Результат серверного расчёта M06. Локальной арифметики в этом диалоге нет.
  const [quote, setQuote] = useState<Quote | null>(null)
  const [quoteError, setQuoteError] = useState(false)

  useEffect(() => {
    if (!open) return
    setSelectedProgramId("")
    setInitialPayment("")
    setTermYears("20")
    setClientSearch("")
    setClientResults([])
    setSelectedClient(null)
    setSaved(false)
    setError(null)
    fetch(getApiUrl("mortgage-programs"), { headers: getAuthHeaders() })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setPrograms(Array.isArray(data) ? data : data.programs ?? []))
  }, [open])

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

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (!apartment) return
    const rateNow = programs.find((p) => p.id === selectedProgramId)?.interestRate ?? 15
    const monthsNow = (Number(termYears) || 20) * 12
    let alive = true
    setQuoteError(false)
    getQuote({
      target_price: String(apartment.price),
      available_now_down_payment: String(Number(initialPayment) || 0),
      annual_nominal_rate_percent: String(rateNow),
      term_months: monthsNow,
    })
      .then((q) => { if (alive) setQuote(q) })
      .catch(() => { if (alive) { setQuote(null); setQuoteError(true) } })
    return () => { alive = false }
  }, [apartment, programs, selectedProgramId, initialPayment, termYears])

  if (!apartment) return null

  const program = programs.find((p) => p.id === selectedProgramId)
  const rate = program?.interestRate ?? 15
  const price = apartment.price
  const down = Number(initialPayment) || 0
  const principal = Math.max(price - down, 0)
  const months = (Number(termYears) || 20) * 12

  // Платёж считает СЕРВЕР утверждёнными формулами M06. Прежняя версия считала
  // аннуитет здесь же через Math.pow — это запрещено: единственный numeric
  // authority — детерминированный движок. Если сервер недоступен, показываем
  // «—», а не приблизительное число.
  const monthlyPaymentText = quoteError
    ? "Расчёт временно недоступен"
    : quote?.annuity_payment.value
      ? formatKzt(quote.annuity_payment.value)
      : "—"
  const loanAmountText = quote?.required_financing.value
    ? formatKzt(quote.required_financing.value)
    : "—"

  async function handleSave() {
    if (!selectedClient) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(getApiUrl("mortgage/calculate"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          clientId: selectedClient.id,
          apartmentId: apartment!.id,
          propertyPrice: price,
          initialPayment: down,
          loanAmount: principal,
          interestRate: rate,
          termMonths: months,
          // Отправляем ровно то, что вернул движок; локально ничего не считаем.
          monthlyPayment: quote?.annuity_payment.display_kzt ?? null,
          bankName: program?.bankName,
          programName: program?.programName,
          apartmentInfo: `№ ${apartment!.number}, ${apartment!.rooms}-комн., ${apartment!.area} м²`,
        }),
      })
      if (!res.ok) throw new Error()
      setSaved(true)
    } catch {
      setError("Не удалось сохранить расчёт")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ипотека для квартиры № {apartment.number}</DialogTitle>
        </DialogHeader>

        {saved ? (
          <p className="text-sm text-green-600">Расчёт сохранён в карточке клиента.</p>
        ) : (
          <div className="space-y-3">
            <Select value={selectedProgramId} onValueChange={setSelectedProgramId}>
              <SelectTrigger>
                <SelectValue placeholder="Банк / программа" />
              </SelectTrigger>
              <SelectContent>
                {programs.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.bankName} — {p.programName} ({p.interestRate}%)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-muted-foreground">Первоначальный взнос</label>
                <Input
                  type="number"
                  min={0}
                  value={initialPayment}
                  onChange={(e) => setInitialPayment(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Срок (лет)</label>
                <Input type="number" min={1} max={30} value={termYears} onChange={(e) => setTermYears(e.target.value)} />
              </div>
            </div>

            <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ежемесячный платёж</span>
                <span className="font-semibold">{monthlyPaymentText}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Сумма кредита</span>
                <span>{loanAmountText}</span>
              </div>
              {/* «Переплата» не показывается: такой формулы нет в утверждённом
                  реестре M06, а выводить её на клиенте — то же нарушение, из-за
                  которого этот диалог и переделан. Вернётся, когда владелец
                  утвердит формулу в реестре. */}
              <p className="pt-1 text-[11px] text-muted-foreground">
                Расчёт предварительный, выполнен на сервере. Не является решением банка.
              </p>
            </div>

            <Input
              placeholder="Поиск клиента, для которого сохранить расчёт..."
              value={clientSearch}
              onChange={(e) => {
                setClientSearch(e.target.value)
                setSelectedClient(null)
              }}
            />
            {selectedClient ? (
              <div className="rounded-lg border px-3 py-2 text-sm">
                Клиент: <span className="font-medium">{selectedClient.firstName} {selectedClient.lastName}</span>
                <Button size="sm" variant="ghost" className="ml-2 h-auto p-0 text-xs" onClick={() => setSelectedClient(null)}>
                  изменить
                </Button>
              </div>
            ) : (
              clientResults.length > 0 && (
                <div className="max-h-32 space-y-1 overflow-y-auto">
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

            {error && <p className="text-sm text-red-600">{error}</p>}

            <Button disabled={!selectedClient || saving} onClick={handleSave} className="w-full">
              Сохранить расчёт клиенту
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
