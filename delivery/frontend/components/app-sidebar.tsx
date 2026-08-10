"use client"

import { useRouter, usePathname } from "next/navigation"
import { useState, useEffect } from "react"
import {
  Users,
  Building2,
  Calculator,
  Calendar,
  BarChart3,
  LogOut,
  Shield,
  DollarSign,
  Building,
  ChevronRight,
  Briefcase,
  GraduationCap,
  Wallet,
  MessageCircle,
  Scale,
  Settings,
  LayoutList,
  Upload,
  CreditCard,
  Pencil,
  ClipboardCheck,
  Search,
  Inbox,
  Handshake,
  Ruler,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { NotificationBell } from "@/components/notification-bell"
import { cn } from "@/lib/utils"
import { clearAuthAndRedirect } from "@/lib/auth-utils"

// Menu structure according to Casa PRO v1 ТЗ (5 main sections for broker)
interface MenuItem {
  title: string
  icon: any
  url?: string
  roles: string[]
  subItems?: {
    title: string
    url: string
    icon?: any
    roles?: string[]
  }[]
}

interface MenuSection {
  title: string
  icon: any
  url?: string
  roles: string[]
  subItems?: {
    title: string
    url: string
    icon?: any
    roles?: string[]
  }[]
}

const menuItems: MenuSection[] = [
  // 1. Сделки (CRM) - единая страница с вкладками; Воронки/Поля (бывшие
  // "Настройки") теперь иконки внутри самой этой страницы, не свой пункт меню.
  {
    title: "Сделки (CRM)",
    icon: Briefcase,
    url: "/dashboard/crm",
    roles: ["ADMIN", "BROKER", "DEVELOPER", "REALTOR", "AGENCY"],
  },
  // 2. Новостройки - единая ссылка на каталог (фильтры уже внутри),
  // шахматка открывается из карточки конкретного ЖК.
  {
    title: "Новостройки",
    icon: Building2,
    url: "/dashboard/projects",
    roles: ["ADMIN", "BROKER", "DEVELOPER", "REALTOR", "AGENCY"],
  },
  // 3. Ипотека - единая ссылка, калькулятор/заявки/программы — вкладки внутри страницы
  {
    title: "Ипотека",
    icon: Calculator,
    url: "/dashboard/mortgage",
    roles: ["ADMIN", "BROKER", "DEVELOPER", "REALTOR", "AGENCY"],
  },
  // 4. Клиенты брокера (покупатели — Client, отдельная сущность от Seller
  // ниже) — раньше не было пункта меню вообще, страница была недостижима.
  {
    title: "Клиенты",
    icon: Users,
    url: "/dashboard/clients",
    roles: ["BROKER"],
  },
  // 5. Подборки для клиентов (квартиры из новостроек)
  {
    title: "Мои подборки",
    icon: LayoutList,
    url: "/dashboard/selections",
    roles: ["ADMIN", "BROKER", "REALTOR", "AGENCY"],
  },
  // 6. Клиенты (Sellers List) — для агентств/риелторов/застройщиков это
  // означает продавцов недвижимости, отдельная сущность Seller.
  {
    title: "Клиенты",
    icon: Users,
    url: "/dashboard/sellers",
    roles: ["AGENCY", "REALTOR", "DEVELOPER"],
  },
  // Команда (Agency only)
  {
    title: "Команда",
    icon: Users,
    url: "/dashboard/agency/team",
    roles: ["AGENCY"],
  },
  // Контур вторички. Отдельный от брокерского Kanban процесс: комната сделки
  // со своими Green-гейтами и внутренний пайплайн оценки, где цену
  // подтверждает человек. Видны только ролям этого контура.
  {
    title: "Сделки (вторичка)",
    icon: Handshake,
    url: "/dashboard/deal-room",
    roles: ["ADMIN", "COORDINATOR", "ANALYST"],
  },
  {
    title: "Оценка объектов",
    icon: Ruler,
    url: "/dashboard/valuations",
    roles: ["ADMIN", "COORDINATOR", "ANALYST"],
  },
  // Профиль и Архив убраны из меню: профиль открывается иконкой-карандашом
  // у карточки пользователя внизу сайдбара; архив пока скрыт.
]

// Admin-only menu item
const adminMenuItem: MenuSection = {
  title: "Управление",
  icon: Shield,
  roles: ["ADMIN"],
  subItems: [
    { title: "Пользователи", url: "/dashboard/users", icon: Users },
    { title: "Глобальный поиск", url: "/dashboard/admin/search", icon: Search },
    { title: "Модерация каталога", url: "/dashboard/admin/moderation", icon: ClipboardCheck },
    { title: "Заявки с лендинга", url: "/dashboard/admin/landing-leads", icon: Inbox },
    { title: "Курсы", url: "/dashboard/courses", icon: GraduationCap },
    { title: "Все проекты", url: "/dashboard/admin/projects", icon: Building2 },
    { title: "Настройки AI", url: "/dashboard/admin/settings", icon: Settings },
    { title: "Импорт amoCRM", url: "/dashboard/admin/import", icon: Upload },
    { title: "Подписки", url: "/dashboard/admin/subscriptions", icon: CreditCard },
  ],
}

export function AppSidebar() {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<any>({})
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({})

  // Load user and open menus state from localStorage
  useEffect(() => {
    const userData = localStorage.getItem("user")
    if (userData) {
      setUser(JSON.parse(userData))
    }

    // Load saved open menus state
    const savedOpenMenus = localStorage.getItem("openMenus")
    if (savedOpenMenus) {
      setOpenMenus(JSON.parse(savedOpenMenus))
    } else {
      // Default: open menu that contains current page
      const defaultOpen: Record<string, boolean> = {}
      menuItems.forEach(item => {
        if (item.subItems?.some(sub => pathname.startsWith(sub.url.split("?")[0]))) {
          defaultOpen[item.title] = true
        }
      })
      setOpenMenus(defaultOpen)
    }
  }, [])

  // Toggle menu open state and save to localStorage
  const toggleMenu = (title: string) => {
    const newOpenMenus = { ...openMenus, [title]: !openMenus[title] }
    setOpenMenus(newOpenMenus)
    localStorage.setItem("openMenus", JSON.stringify(newOpenMenus))
  }

  const handleLogout = () => {
    // Гасим серверную httpOnly-cookie (POST /auth/logout), чистим локальный
    // профиль и уходим на логин — всё внутри clearAuthAndRedirect.
    localStorage.removeItem("openMenus")
    clearAuthAndRedirect()
  }

  const getUserInitials = () => {
    if (!user.firstName || !user.lastName) return "U"
    return `${user.firstName[0]}${user.lastName[0]}`
  }

  // Get visible menu items based on user role
  const getVisibleItems = () => {
    const items = [...menuItems]
    if (user.role === "ADMIN") {
      items.push(adminMenuItem)
    }
    return items.filter(item => item.roles.includes(user.role || "BROKER"))
  }

  const visibleItems = getVisibleItems()

  return (
    <Sidebar className="border-r border-sidebar-border">
      {/* Header — Logo */}
      <SidebarHeader className="border-b border-sidebar-border px-5 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="Casa Pro"
              className="h-9 w-9 rounded-lg object-contain"
            />
            <div>
              <h2 className="text-sm font-bold tracking-tight text-sidebar-foreground">
                Casa Pro
              </h2>
              <p className="text-[10px] font-medium uppercase tracking-widest text-sidebar-foreground/40">
                CRM Platform
              </p>
            </div>
          </div>
          {user.role !== "ADMIN" && <NotificationBell />}
        </div>
      </SidebarHeader>

      {/* Navigation */}
      <SidebarContent className="px-3 py-4">
        <SidebarGroup>
          <SidebarGroupLabel className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
            Навигация
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-0.5">
              {visibleItems.map((item) => {
                const isActive = item.url
                  ? pathname === item.url
                  : item.subItems?.some(sub => pathname === sub.url || pathname.startsWith(sub.url.split("?")[0]))

                return item.subItems ? (
                  <Collapsible
                    key={item.title}
                    asChild
                    open={openMenus[item.title] ?? false}
                    onOpenChange={() => toggleMenu(item.title)}
                    className="group/collapsible"
                  >
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton
                          tooltip={item.title}
                          className={cn(
                            "relative h-9 rounded-lg px-3 text-sidebar-foreground/70 transition-all duration-200 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                            isActive && "bg-sidebar-accent text-sidebar-foreground"
                          )}
                        >
                          {isActive && (
                            <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[#FFD700]" />
                          )}
                          <item.icon className={cn(
                            "h-4 w-4 shrink-0",
                            isActive && "text-[#FFD700]"
                          )} />
                          <span className="text-[13px] font-medium">{item.title}</span>
                          <ChevronRight className="ml-auto h-3.5 w-3.5 shrink-0 text-sidebar-foreground/30 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub className="ml-5 mt-1 space-y-0.5 border-l border-sidebar-border pl-3">
                          {item.subItems.filter((subItem) => !subItem.roles || subItem.roles.includes(user?.role || "BROKER")).map((subItem) => {
                            const isSubActive = pathname === subItem.url || pathname.startsWith(subItem.url.split("?")[0])
                            return (
                              <SidebarMenuSubItem key={subItem.title}>
                                <SidebarMenuSubButton
                                  asChild
                                  isActive={isSubActive}
                                  className={cn(
                                    "h-8 rounded-md px-2 text-sidebar-foreground/50 transition-colors duration-150 hover:text-sidebar-foreground",
                                    isSubActive && "text-[#FFD700] hover:text-[#FFD700]"
                                  )}
                                >
                                  <a href={subItem.url}>
                                    {subItem.icon && <subItem.icon className="mr-2 h-3.5 w-3.5 shrink-0" />}
                                    <span className="text-[12px] font-medium">{subItem.title}</span>
                                  </a>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            )
                          })}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                ) : (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === item.url}
                      tooltip={item.title}
                      className={cn(
                        "relative h-9 rounded-lg px-3 text-sidebar-foreground/70 transition-all duration-200 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                        pathname === item.url && "bg-sidebar-accent text-sidebar-foreground"
                      )}
                    >
                      <a href={item.url}>
                        {pathname === item.url && (
                          <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[#FFD700]" />
                        )}
                        <item.icon className={cn(
                          "h-4 w-4 shrink-0",
                          pathname === item.url && "text-[#FFD700]"
                        )} />
                        <span className="text-[13px] font-medium">{item.title}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer — User info + Logout */}
      <SidebarFooter className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3 rounded-lg bg-sidebar-accent/50 p-2.5">
          <Avatar className="h-8 w-8 shrink-0 ring-2 ring-[#2E7D5E]">
            <AvatarFallback className="bg-[#2E7D5E] text-[10px] font-bold text-white">
              {getUserInitials()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="truncate text-[13px] font-semibold text-sidebar-foreground">
              {user.firstName} {user.lastName}
            </p>
            <p className="truncate text-[10px] font-medium text-[#FFD700]/70">
              {user.role === "ADMIN" && "Администратор"}
              {user.role === "BROKER" && "Брокер"}
              {user.role === "DEVELOPER" && "Застройщик"}
              {user.role === "REALTOR" && "Риелтор"}
              {user.role === "AGENCY" && "Агентство"}
              {user.role === "COORDINATOR" && "Координатор сделок"}
              {user.role === "ANALYST" && "Аналитик оценки"}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-sidebar-foreground/50 hover:text-sidebar-foreground"
            onClick={() => router.push("/dashboard/profile")}
            title="Редактировать профиль"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="mt-1 w-full justify-start rounded-lg px-3 text-[13px] font-medium text-sidebar-foreground/50 transition-colors duration-200 hover:bg-sidebar-accent hover:text-red-400"
          onClick={handleLogout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Выйти
        </Button>
      </SidebarFooter>
    </Sidebar>
  )
}
