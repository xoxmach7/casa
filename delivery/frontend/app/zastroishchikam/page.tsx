"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { getApiUrl, getAuthHeaders } from "@/lib/api-client"

type DeveloperForm = {
  companyName: string
  bin: string
  firstName: string
  lastName: string
  email: string
  phone: string
  password: string
}

const EMPTY_FORM: DeveloperForm = {
  companyName: "",
  bin: "",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  password: "",
}

export default function Page() {
  const [form, setForm] = useState<DeveloperForm>(EMPTY_FORM)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const update =
    (field: keyof DeveloperForm) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }))
    }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const res = await fetch(getApiUrl("/auth/register-developer"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          companyName: form.companyName,
          bin: form.bin,
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          phone: form.phone,
          password: form.password,
        }),
      })

      if (res.status === 201) {
        setSubmitted(true)
        toast.success("Заявка отправлена")
        return
      }

      const data = await res.json().catch(() => ({}))

      if (res.status === 409) {
        const msg = data.error || "Пользователь с таким email уже существует"
        setError(msg)
        toast.error(msg)
        return
      }

      if (res.status === 400) {
        const msg = "Проверьте правильность заполнения полей"
        setError(msg)
        toast.error(msg)
        return
      }

      const msg = data.error || "Не удалось отправить заявку"
      setError(msg)
      toast.error(msg)
    } catch {
      const msg = "Не удалось подключиться к серверу"
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-md">
        {submitted ? (
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="space-y-2 text-center">
              <CardTitle className="text-2xl font-semibold tracking-tight">
                Заявка отправлена
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                После одобрения администратором вы сможете войти.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full h-10">
                <a href="/login">Перейти ко входу</a>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="space-y-2 text-center">
              <h1 className="text-2xl font-semibold tracking-tight">
                Разместите свои ЖК на платформе CASA Pro
              </h1>
              <p className="text-sm text-muted-foreground">
                После одобрения ваши жилые комплексы станут доступны брокерам всей
                платформы.
              </p>
            </div>

            <Card className="border-border/50 shadow-sm">
              <CardHeader className="space-y-2 text-center">
                <CardTitle className="text-xl font-semibold tracking-tight">
                  Заявка застройщика
                </CardTitle>
                <CardDescription className="text-sm text-muted-foreground">
                  Заполните данные компании и контактного лица
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit}>
                  <FieldGroup>
                    {error && (
                      <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                        {error}
                      </div>
                    )}
                    <Field>
                      <FieldLabel htmlFor="companyName">
                        Название компании
                      </FieldLabel>
                      <Input
                        id="companyName"
                        type="text"
                        value={form.companyName}
                        onChange={update("companyName")}
                        required
                        className="h-10"
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="bin">БИН</FieldLabel>
                      <Input
                        id="bin"
                        type="text"
                        inputMode="numeric"
                        value={form.bin}
                        onChange={update("bin")}
                        required
                        className="h-10"
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="firstName">Имя</FieldLabel>
                      <Input
                        id="firstName"
                        type="text"
                        value={form.firstName}
                        onChange={update("firstName")}
                        required
                        className="h-10"
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="lastName">Фамилия</FieldLabel>
                      <Input
                        id="lastName"
                        type="text"
                        value={form.lastName}
                        onChange={update("lastName")}
                        required
                        className="h-10"
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="email">Email</FieldLabel>
                      <Input
                        id="email"
                        type="email"
                        placeholder="email@example.com"
                        value={form.email}
                        onChange={update("email")}
                        required
                        className="h-10"
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="phone">Телефон</FieldLabel>
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="+7 700 000 00 00"
                        value={form.phone}
                        onChange={update("phone")}
                        required
                        className="h-10"
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="password">Пароль</FieldLabel>
                      <Input
                        id="password"
                        type="password"
                        placeholder="••••••••"
                        value={form.password}
                        onChange={update("password")}
                        required
                        minLength={6}
                        className="h-10"
                      />
                    </Field>
                    <Field>
                      <Button
                        type="submit"
                        className="w-full h-10"
                        disabled={loading}
                      >
                        {loading ? "Отправка..." : "Отправить заявку"}
                      </Button>
                    </Field>
                  </FieldGroup>
                </form>
              </CardContent>
            </Card>

            <p className="text-center text-sm text-muted-foreground">
              Уже есть аккаунт?{" "}
              <a
                href="/login"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Войти
              </a>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
