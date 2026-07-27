"use client"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

export interface MortgageApplication {
  id: string
  clientId: string
  bankName: string
  programName: string | null
  loanAmount: number
  termMonths: number
  interestRate: number | null
  status: "DRAFT" | "SUBMITTED" | "REVIEWING" | "APPROVED" | "REJECTED" | "CANCELLED"
  responseDate: string | null
  responseNotes: string | null
  brokerId: string
  createdAt: string
  updatedAt: string
  client: {
    id: string
    firstName: string
    lastName: string
    phone: string
  }
}

const statusBadgeColors: Record<MortgageApplication["status"], string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  SUBMITTED: "bg-blue-100 text-blue-700",
  REVIEWING: "bg-yellow-100 text-yellow-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  CANCELLED: "bg-gray-100 text-gray-700",
}

const statusLabels: Record<MortgageApplication["status"], string> = {
  DRAFT: "Черновик",
  SUBMITTED: "Отправлена",
  REVIEWING: "На рассмотрении",
  APPROVED: "Одобрена",
  REJECTED: "Отклонена",
  CANCELLED: "Отменена",
}

interface MortgageApplicationsTableProps {
  applications: MortgageApplication[]
  onRowClick?: (application: MortgageApplication) => void
}

export function MortgageApplicationsTable({
  applications,
  onRowClick,
}: MortgageApplicationsTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Клиент</TableHead>
          <TableHead>Банк</TableHead>
          <TableHead>Программа</TableHead>
          <TableHead>Сумма кредита</TableHead>
          <TableHead>Срок (мес.)</TableHead>
          <TableHead>Ставка (%)</TableHead>
          <TableHead>Статус</TableHead>
          <TableHead>Дата создания</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {applications.map((app) => (
          <TableRow
            key={app.id}
            className={onRowClick ? "cursor-pointer hover:bg-muted/50" : ""}
            onClick={() => onRowClick?.(app)}
          >
            <TableCell>
              <div>
                <p className="font-medium">
                  {app.client.firstName} {app.client.lastName}
                </p>
                <p className="text-sm text-muted-foreground">{app.client.phone}</p>
              </div>
            </TableCell>
            <TableCell>{app.bankName}</TableCell>
            <TableCell>{app.programName || "—"}</TableCell>
            <TableCell>
              {app.loanAmount.toLocaleString("ru-RU")} ₸
            </TableCell>
            <TableCell>{app.termMonths}</TableCell>
            <TableCell>
              {app.interestRate != null ? `${app.interestRate}%` : "—"}
            </TableCell>
            <TableCell>
              <Badge className={`border-transparent ${statusBadgeColors[app.status]}`}>
                {statusLabels[app.status]}
              </Badge>
            </TableCell>
            <TableCell>
              {new Date(app.createdAt).toLocaleDateString("ru-RU")}
            </TableCell>
          </TableRow>
        ))}
        {applications.length === 0 && (
          <TableRow>
            <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
              Нет заявок
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  )
}
