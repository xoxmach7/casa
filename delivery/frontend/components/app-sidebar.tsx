"use client"

import { useRouter, usePathname } from "next/navigation"
import { useState, useEffect } from "react"
import {
  Home,
  Users,
  Building2,
  Calculator,
  User,
  Calendar,
  Grid3x3,
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
  FileText,
  Scale,
  Settings,
  Target,
  LayoutList,
  Archive,
  Upload,
  CreditCard,
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
  }[]
}

const menuItems: MenuSection[] = [
  // 1. Главная - Dashboard
  {
    title: "Главная",
    icon: Home,
    url: "/dashboard",
    roles: ["ADMIN", "BROKER", "DEVELOPER", "REALTOR", "AGENCY"],
  },
  // 2. Сделки (CRM) - единая страница с вкладками
  {
    title: "Сделки (CRM)",
    icon: Briefcase,
    url: "/dashboard/crm",
    roles: ["ADMIN", "BROKER", "DEVELOPER", "REALTOR", "AGENCY"],
  },
  // 2.1 Стратегии - справочник
  {
    title: "Стратегии (CASA)",
    icon: Target,
    url: "/dashboard/strategies",
    roles: ["ADMIN", "BROKER", "DEVELOPER"],
  },
  // 2.2 Команда (Agency only)
  {
    title: "Команда",
    icon: Users,
    url: "/dashboard/agency/team",
    roles: ["AGENCY"],
  },
  // 2.3 Список объектов (List View)
  {
    title: "Мои объекты",
    icon: LayoutList,
    url: "/dashboard/properties",
    roles: ["ADMIN", "BROKER", "REALTOR", "AGENCY"],
  },
  // 2.4 Клиенты (Sellers List)
  {
    title: "Клиенты",
    icon: Users,
    url: "/dashboard/sellers",
    roles: ["AGENCY", "REALTOR", "DEVELOPER"],
  },
  // 3. Новостройки - collapsible
  {
    title: "Новостройки",
    icon: Building2,
    roles: ["ADMIN", "BROKER", "DEVELOPER", "REALTOR", "AGENCY"],
    subItems: [
      { title: "Каталог ЖК", url: "/dashboard/projects", icon: Building2 },
      { title: "Шахматка", url: "/dashboard/chess", icon: Grid3x3 },
    ],
  },
  // 4. Ипотека - collapsible с подразделами
  {
    title: "Ипотека",
    icon: Calculator,
    roles: ["ADMIN", "BROKER", "DEVELOPER", "REALTOR", "AGENCY"],
    subItems: [
      { title: "Калькулятор", url: "/dashboard/mortgage", icon: Calculator },
      { title: "Программы", url: "/dashboard/mortgage-programs", icon: CreditCard, roles: ["ADMIN"] },
      { title: "Заявки в банки", url: "/dashboard/mortgage-applications", icon: FileText },
    ],
  },
  // 5. Профиль - одна кнопка без подразделов (табы внутри страницы)
  {
    title: "Профиль",
    icon: User,
    url: "/dashboard/profile",
    roles: ["ADMIN", "BROKER", "DEVELOPER", "REALTOR", "AGENCY"],
  },
  // 6. Формы (Admin)
  {
    title: "Формы",
    icon: FileText,
    url: "/dashboard/forms",
    roles: ["ADMIN", "BROKER", "AGENCY"], // Maybe Realtors too? restricted for now
  },
  // 7. Настройки (CRM)
  {
    title: "Настройки",
    icon: Settings,
    url: "/dashboard/settings",
    roles: ["ADMIN", "BROKER", "DEVELOPER", "REALTOR", "AGENCY"],
    subItems: [
      { title: "Воронки", url: "/dashboard/settings/funnels", icon: Settings },
      { title: "Поля", url: "/dashboard/settings/fields", icon: LayoutList } // NEW
    ]
  },
  // 8. Архив
  {
    title: "Архив",
    icon: Archive,
    url: "/dashboard/archives",
    roles: ["ADMIN", "BROKER", "DEVELOPER", "REALTOR", "AGENCY"],
  },
]

// Admin-only menu item
const adminMenuItem: MenuSection = {
  title: "Управление",
  icon: Shield,
  roles: ["ADMIN"],
  subItems: [
    { title: "Пользователи", url: "/dashboard/users", icon: Users },
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
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    localStorage.removeItem("openMenus")
    router.push("/login")
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
            </p>
          </div>
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
