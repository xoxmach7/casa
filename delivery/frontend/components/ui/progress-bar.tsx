import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

interface ProgressBarProps {
    value: number
    label?: string
    showPercentage?: boolean
    className?: string
    size?: "sm" | "md" | "lg"
}

export function ProgressBar({
    value,
    label,
    showPercentage = true,
    className,
    size = "md"
}: ProgressBarProps) {
    const sizeClasses = {
        sm: "h-2",
        md: "h-3",
        lg: "h-4"
    }

    return (
        <div className={cn("space-y-2", className)}>
            {(label || showPercentage) && (
                <div className="flex items-center justify-between text-sm">
                    {label && <span className="font-medium">{label}</span>}
                    {showPercentage && (
                        <span className="text-muted-foreground">{value}%</span>
                    )}
                </div>
            )}
            <Progress
                value={value}
                className={cn(sizeClasses[size])}
            />
        </div>
    )
}
