"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { getToken, isTokenExpired } from "@/lib/auth-utils"
import { StrategyProvider } from "@/lib/strategy-context"
import { Skeleton } from "@/components/ui/skeleton"

function DashboardSkeleton() {
  return (
    <div className="flex h-screen w-full overflow-hidden">
      {/* Sidebar skeleton */}
      <div className="hidden md:flex w-64 flex-col border-r border-border/40 bg-sidebar p-4 gap-6 shrink-0">
        <div className="flex items-center gap-3 px-1">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-2.5 w-16" />
          </div>
        </div>
        <div className="space-y-1.5 mt-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full rounded-lg" />
          ))}
        </div>
        <div className="mt-auto space-y-2">
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-8 w-full rounded-lg" />
        </div>
      </div>
      {/* Content skeleton */}
      <div className="flex-1 p-8 space-y-6">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-5 w-96" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-6">
          <Skeleton className="h-80 col-span-2 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    </div>
  )
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = getToken()
    if (!token || isTokenExpired(token)) {
      localStorage.removeItem("token")
      localStorage.removeItem("user")
      router.push("/login")
    } else {
      setLoading(false)
    }
  }, [router])

  if (loading) {
    return <DashboardSkeleton />
  }

  return (
    <SidebarProvider defaultOpen={true} open={true}>
      <StrategyProvider>
      <div className="flex h-screen w-full overflow-hidden">
        <AppSidebar />
        <main className="flex-1 flex flex-col overflow-hidden bg-background">
          <div className="flex items-center p-4 md:hidden border-b border-border/40 bg-background sticky top-0 z-20 shrink-0">
            <SidebarTrigger />
            <span className="ml-2 font-semibold text-foreground">Casa Pro</span>
          </div>
          <div className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">{children}</div>
        </main>
      </div>
      </StrategyProvider>
    </SidebarProvider>
  )
}
