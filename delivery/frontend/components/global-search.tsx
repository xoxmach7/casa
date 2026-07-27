"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Home,
  Briefcase,
  Building2,
  Calculator,
  User,
  Grid3x3,
  Users,
  FileText,
  Settings,
  Target,
  LayoutList,
  Archive,
  Search,
} from "lucide-react"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"

const pages = [
  { title: "Главная", icon: Home, url: "/dashboard", keywords: ["dashboard", "главная", "home"] },
  { title: "Сделки (CRM)", icon: Briefcase, url: "/dashboard/crm", keywords: ["crm", "сделки", "deals"] },
  { title: "Стратегии (CASA)", icon: Target, url: "/dashboard/strategies", keywords: ["стратегии", "strategies", "casa"] },
  { title: "Мои объекты", icon: LayoutList, url: "/dashboard/properties", keywords: ["объекты", "properties", "недвижимость"] },
  { title: "Клиенты", icon: Users, url: "/dashboard/sellers", keywords: ["клиенты", "sellers", "продавцы"] },
  { title: "Каталог ЖК", icon: Building2, url: "/dashboard/projects", keywords: ["жк", "проекты", "новостройки", "catalog"] },
  { title: "Шахматка", icon: Grid3x3, url: "/dashboard/chess", keywords: ["шахматка", "chess", "квартиры"] },
  { title: "Ипотека", icon: Calculator, url: "/dashboard/mortgage", keywords: ["ипотека", "mortgage", "калькулятор"] },
  { title: "Профиль", icon: User, url: "/dashboard/profile", keywords: ["профиль", "profile", "настройки"] },
  { title: "Формы", icon: FileText, url: "/dashboard/forms", keywords: ["формы", "forms"] },
  { title: "Настройки воронок", icon: Settings, url: "/dashboard/settings/funnels", keywords: ["воронки", "funnels", "настройки"] },
  { title: "Архив", icon: Archive, url: "/dashboard/archives", keywords: ["архив", "archive"] },
]

export function GlobalSearch() {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }

    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  const runCommand = useCallback(
    (command: () => void) => {
      setOpen(false)
      command()
    },
    []
  )

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-sm text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        <Search className="h-4 w-4" />
        <span className="hidden md:inline-flex">Поиск...</span>
        <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 md:inline-flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Поиск по страницам..." />
        <CommandList>
          <CommandEmpty>Ничего не найдено.</CommandEmpty>
          <CommandGroup heading="Навигация">
            {pages.map((page) => (
              <CommandItem
                key={page.url}
                value={[page.title, ...page.keywords].join(" ")}
                onSelect={() => runCommand(() => router.push(page.url))}
              >
                <page.icon className="mr-2 h-4 w-4" />
                <span>{page.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  )
}
