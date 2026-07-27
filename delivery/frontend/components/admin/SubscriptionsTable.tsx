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

interface Subscription {
  id: string
  userId: string
  plan: "FREE" | "BASIC" | "PRO" | "ENTERPRISE"
  status: "ACTIVE" | "EXPIRED" | "CANCELLED"
  startsAt: string
  expiresAt: string | null
  amount: number | null
  createdAt: string
  updatedAt: string
  user: {
    id: string
    email: string
    firstName: string
    lastName: string
    role: string
  }
}

const planBadgeColors: Record<Subscription["plan"], string> = {
  FREE: "bg-gray-100 text-gray-700",
  BASIC: "bg-blue-100 text-blue-700",
  PRO: "bg-yellow-100 text-yellow-700",
  ENTERPRISE: "bg-green-100 text-green-700",
}

const statusBadgeColors: Record<Subscription["status"], string> = {
  ACTIVE: "bg-green-100 text-green-700",
  EXPIRED: "bg-red-100 text-red-700",
  CANCELLED: "bg-gray-100 text-gray-700",
}

const planLabels: Record<Subscription["plan"], string> = {
  FREE: "Бесплатный",
  BASIC: "Базовый",
  PRO: "Про",
  ENTERPRISE: "Корпоративный",
}

const statusLabels: Record<Subscription["status"], string> = {
  ACTIVE: "Активна",
  EXPIRED: "Истекла",
  CANCELLED: "Отменена",
}

const roleLabels: Record<string, string> = {
  ADMIN: "Админ",
  BROKER: "Брокер",
  DEVELOPER: "Застройщик",
  REALTOR: "Риелтор",
  AGENCY: "Агентство",
}

interface SubscriptionsTableProps {
  subscriptions: Subscription[]
}

export type { Subscription }

export function SubscriptionsTable({ subscriptions }: SubscriptionsTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Пользователь</TableHead>
          <TableHead>Роль</TableHead>
          <TableHead>План</TableHead>
          <TableHead>Статус</TableHead>
          <TableHead>Дата начала</TableHead>
          <TableHead>Дата окончания</TableHead>
          <TableHead>Сумма</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {subscriptions.map((sub) => (
          <TableRow key={sub.id}>
            <TableCell>
              <div>
                <p className="font-medium">
                  {sub.user.firstName} {sub.user.lastName}
                </p>
                <p className="text-sm text-muted-foreground">{sub.user.email}</p>
              </div>
            </TableCell>
            <TableCell>{roleLabels[sub.user.role] || sub.user.role}</TableCell>
            <TableCell>
              <Badge className={`border-transparent ${planBadgeColors[sub.plan]}`}>
                {planLabels[sub.plan]}
              </Badge>
            </TableCell>
            <TableCell>
              <Badge className={`border-transparent ${statusBadgeColors[sub.status]}`}>
                {statusLabels[sub.status]}
              </Badge>
            </TableCell>
            <TableCell>
              {new Date(sub.startsAt).toLocaleDateString("ru-RU")}
            </TableCell>
            <TableCell>
              {sub.expiresAt
                ? new Date(sub.expiresAt).toLocaleDateString("ru-RU")
                : "—"}
            </TableCell>
            <TableCell>
              {sub.amount != null
                ? sub.amount.toLocaleString("ru-RU") + " ₸"
                : "—"}
            </TableCell>
          </TableRow>
        ))}
        {subscriptions.length === 0 && (
          <TableRow>
            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
              Нет подписок
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  )
}
