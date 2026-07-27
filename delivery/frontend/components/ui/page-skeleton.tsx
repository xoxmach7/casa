import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

interface PageSkeletonProps {
  /** Number of stat cards at top */
  stats?: number
  /** Number of table rows */
  rows?: number
  /** Show a heading skeleton */
  heading?: boolean
  className?: string
}

export function PageSkeleton({
  stats = 4,
  rows = 5,
  heading = true,
  className,
}: PageSkeletonProps) {
  return (
    <div className={cn("space-y-6 animate-fade-in", className)}>
      {heading && (
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-32" />
        </div>
      )}

      {stats > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: stats }).map((_, i) => (
            <div key={i} className="rounded-lg border bg-card p-6 space-y-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-7 w-16" />
              <Skeleton className="h-3 w-32" />
            </div>
          ))}
        </div>
      )}

      <div className="rounded-lg border bg-card">
        <div className="flex items-center justify-between p-4 border-b">
          <Skeleton className="h-5 w-32" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-24" />
          </div>
        </div>
        <div className="p-4 space-y-3">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-[60%]" />
                <Skeleton className="h-3 w-[40%]" />
              </div>
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
