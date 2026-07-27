"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import api from "@/lib/api-client"
import { toast } from "sonner"
import { PriceInput } from "@/components/ui/price-input"

interface Client {
  id: string
  firstName: string
  lastName: string
  phone: string
}

interface MortgageApplicationFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MortgageApplicationForm({ open, onOpenChange }: MortgageApplicationFormProps) {
  const queryClient = useQueryClient()

  const [clientId, setClientId] = useState("")
  const [bankName, setBankName] = useState("")
  const [programName, setProgramName] = useState("")
  const [loanAmount, setLoanAmount] = useState("")
  const [termMonths, setTermMonths] = useState("")
  const [interestRate, setInterestRate] = useState("")

  const [errors, setErrors] = useState<Record<string, string>>({})

  const { data: rawClients } = useQuery({
    queryKey: ["mortgage-clients"],
    queryFn: () => api.get("/clients", { params: { limit: 100 } }).then((r) => {
      const d = r.data;
      return Array.isArray(d) ? d : (d.clients ?? d.data ?? []);
    }),
    enabled: open,
  })
  const clients: Client[] = Array.isArray(rawClients) ? rawClients : []

  const mutation = useMutation({
    mutationFn: (data: {
      clientId: string
      bankName: string
      programName?: string
      loanAmount: number
      termMonths: number
      interestRate?: number
    }) => api.post("/mortgage-applications", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mortgage-applications"] })
      toast.success("Заявка создана")
      resetAndClose()
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || "Ошибка создания заявки")
    },
  })

  const resetAndClose = () => {
    setClientId("")
    setBankName("")
    setProgramName("")
    setLoanAmount("")
    setTermMonths("")
    setInterestRate("")
    setErrors({})
    onOpenChange(false)
  }

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}
    if (!clientId) newErrors.clientId = "Выберите клиента"
    if (!bankName.trim()) newErrors.bankName = "Укажите название банка"
    if (!loanAmount || Number(loanAmount) <= 0) newErrors.loanAmount = "Сумма должна быть больше 0"
    if (!termMonths || Number(termMonths) <= 0 || !Number.isInteger(Number(termMonths)))
      newErrors.termMonths = "Срок должен быть целым числом больше 0"
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    mutation.mutate({
      clientId,
      bankName: bankName.trim(),
      programName: programName.trim() || undefined,
      loanAmount: Number(loanAmount),
      termMonths: Number(termMonths),
      interestRate: interestRate ? Number(interestRate) : undefined,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Новая заявка в банк</DialogTitle>
          <DialogDescription>
            Заполните данные для подачи ипотечной заявки.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Клиент</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите клиента" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.firstName} {c.lastName} ({c.phone})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.clientId && (
              <p className="text-sm text-destructive">{errors.clientId}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Название банка</Label>
            <Input
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="Например: Kaspi Bank"
            />
            {errors.bankName && (
              <p className="text-sm text-destructive">{errors.bankName}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Программа</Label>
            <Input
              value={programName}
              onChange={(e) => setProgramName(e.target.value)}
              placeholder="Название программы (необязательно)"
            />
          </div>

          <div className="space-y-2">
            <Label>Сумма кредита (₸)</Label>
            <PriceInput
              value={loanAmount}
              onChange={setLoanAmount}
              placeholder="0"
            />
            {errors.loanAmount && (
              <p className="text-sm text-destructive">{errors.loanAmount}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Срок (месяцев)</Label>
            <Input
              type="number"
              min="1"
              step="1"
              value={termMonths}
              onChange={(e) => setTermMonths(e.target.value)}
              placeholder="0"
            />
            {errors.termMonths && (
              <p className="text-sm text-destructive">{errors.termMonths}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Процентная ставка (%)</Label>
            <Input
              type="number"
              min="0"
              step="0.1"
              value={interestRate}
              onChange={(e) => setInterestRate(e.target.value)}
              placeholder="Необязательно"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={resetAndClose}
            >
              Отмена
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? "Отправка..." : "Отправить"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
