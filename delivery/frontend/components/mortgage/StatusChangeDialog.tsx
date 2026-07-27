"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
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
import { Textarea } from "@/components/ui/textarea"
import api from "@/lib/api-client"
import { toast } from "sonner"
import type { MortgageApplication } from "./MortgageApplicationsTable"

const statuses: MortgageApplication["status"][] = [
  "DRAFT",
  "SUBMITTED",
  "REVIEWING",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
]

const statusLabels: Record<MortgageApplication["status"], string> = {
  DRAFT: "Черновик",
  SUBMITTED: "Отправлена",
  REVIEWING: "На рассмотрении",
  APPROVED: "Одобрена",
  REJECTED: "Отклонена",
  CANCELLED: "Отменена",
}

interface StatusChangeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  application: MortgageApplication | null
}

export function StatusChangeDialog({ open, onOpenChange, application }: StatusChangeDialogProps) {
  const queryClient = useQueryClient()

  const [status, setStatus] = useState<string>("")
  const [responseNotes, setResponseNotes] = useState("")

  const mutation = useMutation({
    mutationFn: (data: { status: string; responseNotes?: string }) =>
      api.put(`/mortgage-applications/${application?.id}/status`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mortgage-applications"] })
      toast.success("Статус заявки обновлён")
      resetAndClose()
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || "Ошибка обновления статуса")
    },
  })

  const resetAndClose = () => {
    setStatus("")
    setResponseNotes("")
    onOpenChange(false)
  }

  const handleOpenChange = (value: boolean) => {
    if (value && application) {
      setStatus(application.status)
      setResponseNotes(application.responseNotes || "")
    }
    onOpenChange(value)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!status || !application) return

    mutation.mutate({
      status,
      responseNotes: responseNotes.trim() || undefined,
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Изменить статус заявки</DialogTitle>
          <DialogDescription>
            {application
              ? `${application.client.firstName} ${application.client.lastName} — ${application.bankName}`
              : "Выберите новый статус заявки"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Статус</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите статус" />
              </SelectTrigger>
              <SelectContent>
                {statuses.map((s) => (
                  <SelectItem key={s} value={s}>
                    {statusLabels[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Комментарий</Label>
            <Textarea
              value={responseNotes}
              onChange={(e) => setResponseNotes(e.target.value)}
              placeholder="Комментарий к решению (необязательно)"
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={resetAndClose}>
              Отмена
            </Button>
            <Button type="submit" disabled={!status || mutation.isPending}>
              {mutation.isPending ? "Сохранение..." : "Сохранить"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
