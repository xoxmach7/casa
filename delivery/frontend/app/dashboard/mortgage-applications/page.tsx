"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import api from "@/lib/api-client"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import {
  MortgageApplicationsTable,
  type MortgageApplication,
} from "@/components/mortgage/MortgageApplicationsTable"
import { MortgageApplicationForm } from "@/components/mortgage/MortgageApplicationForm"
import { StatusChangeDialog } from "@/components/mortgage/StatusChangeDialog"

export default function MortgageApplicationsPage() {
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [selectedApplication, setSelectedApplication] =
    useState<MortgageApplication | null>(null)
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false)

  const { data: applications, isLoading } = useQuery<MortgageApplication[]>({
    queryKey: ["mortgage-applications"],
    queryFn: () => api.get("/mortgage-applications").then((r) => r.data),
  })

  const handleRowClick = (application: MortgageApplication) => {
    setSelectedApplication(application)
    setIsStatusDialogOpen(true)
  }

  if (isLoading) {
    return <PageSkeleton heading stats={0} rows={6} />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Заявки в банки</h1>
          <p className="text-muted-foreground">
            Управление ипотечными заявками
          </p>
        </div>
        <Button onClick={() => setIsFormOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Новая заявка
        </Button>
      </div>

      <Card>
        <MortgageApplicationsTable
          applications={applications ?? []}
          onRowClick={handleRowClick}
        />
      </Card>

      <MortgageApplicationForm open={isFormOpen} onOpenChange={setIsFormOpen} />

      <StatusChangeDialog
        open={isStatusDialogOpen}
        onOpenChange={setIsStatusDialogOpen}
        application={selectedApplication}
      />
    </div>
  )
}
