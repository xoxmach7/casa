"use client"

import { useState } from "react"
import { MessageSquarePlus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import api from "@/lib/api-client"

// Кнопка «Оставить обратную связь» в шапке сайдбара → диалог → POST /api/feedback.
export function FeedbackButton() {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState("")
  const [contact, setContact] = useState("")
  const [loading, setLoading] = useState(false)

  async function submit() {
    if (!message.trim() || loading) return
    setLoading(true)
    try {
      await api.post("/feedback", { message: message.trim(), contact: contact.trim() || undefined })
      toast.success("Спасибо! Обратная связь отправлена.")
      setMessage("")
      setContact("")
      setOpen(false)
    } catch {
      toast.error("Не удалось отправить. Попробуйте ещё раз.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
          title="Оставить обратную связь"
          aria-label="Оставить обратную связь"
        >
          <MessageSquarePlus className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Оставить обратную связь</DialogTitle>
          <DialogDescription>
            Расскажите, что улучшить или что работает не так — мы прочитаем каждое сообщение.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Textarea
            placeholder="Ваше сообщение…"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            autoFocus
          />
          <Input
            placeholder="Как с вами связаться для ответа (необязательно)"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={loading || !message.trim()}>
            {loading ? "Отправка…" : "Отправить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
