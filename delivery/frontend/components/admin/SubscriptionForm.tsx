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

interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  role: string
}

interface SubscriptionFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const plans = ["FREE", "BASIC", "PRO", "ENTERPRISE"] as const

const planLabels: Record<string, string> = {
  FREE: "Бесплатный",
  BASIC: "Базовый",
  PRO: "Про",
  ENTERPRISE: "Корпоративный",
}

export function SubscriptionForm({ open, onOpenChange }: SubscriptionFormProps) {
  const queryClient = useQueryClient()

  const [userId, setUserId] = useState("")
  const [plan, setPlan] = useState<string>("")
  const [expiresAt, setExpiresAt] = useState("")
  const [amount, setAmount] = useState("")

  const { data: rawUsers } = useQuery({
    queryKey: ["subscription-users"],
    queryFn: () => api.get("/users").then((r) => {
      const d = r.data;
      return Array.isArray(d) ? d : (d.users ?? d.data ?? []);
    }),
    enabled: open,
  })
  const users: User[] = Array.isArray(rawUsers) ? rawUsers : []

  const mutation = useMutation({
    mutationFn: (data: { userId: string; plan: string; expiresAt?: string; amount?: number }) =>
      api.post("/subscriptions", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] })
      toast.success("Подписка назначена")
      resetAndClose()
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || "Ошибка назначения подписки")
    },
  })

  const resetAndClose = () => {
    setUserId("")
    setPlan("")
    setExpiresAt("")
    setAmount("")
    onOpenChange(false)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId || !plan) return

    mutation.mutate({
      userId,
      plan,
      expiresAt: expiresAt || undefined,
      amount: amount ? Number(amount) : undefined,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Назначить подписку</DialogTitle>
          <DialogDescription>
            Выберите пользователя и настройте параметры подписки.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Пользователь</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите пользователя" />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.firstName} {u.lastName} ({u.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>План</Label>
            <Select value={plan} onValueChange={setPlan}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите план" />
              </SelectTrigger>
              <SelectContent>
                {plans.map((p) => (
                  <SelectItem key={p} value={p}>
                    {planLabels[p] || p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Дата окончания</Label>
            <Input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Сумма (₸)</Label>
            <PriceInput
              value={amount}
              onChange={setAmount}
              placeholder="0"
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
              disabled={!userId || !plan || mutation.isPending}
            >
              {mutation.isPending ? "Сохранение..." : "Сохранить"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
