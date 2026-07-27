"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import api from "@/lib/api-client"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import { SubscriptionsTable, type Subscription } from "@/components/admin/SubscriptionsTable"
import { SubscriptionForm } from "@/components/admin/SubscriptionForm"

export default function SubscriptionsPage() {
  const [isFormOpen, setIsFormOpen] = useState(false)

  const { data: subscriptions, isLoading } = useQuery<Subscription[]>({
    queryKey: ["subscriptions"],
    queryFn: () => api.get("/subscriptions").then((r) => r.data),
  })

  if (isLoading) {
    return <PageSkeleton heading stats={0} rows={6} />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Подписки</h1>
          <p className="text-muted-foreground">Управление подписками пользователей</p>
        </div>
        <Button onClick={() => setIsFormOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Назначить подписку
        </Button>
      </div>

      <Card>
        <SubscriptionsTable subscriptions={subscriptions ?? []} />
      </Card>

      <SubscriptionForm open={isFormOpen} onOpenChange={setIsFormOpen} />
    </div>
  )
}
