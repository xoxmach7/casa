"use client"

import { useState, useEffect, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface PriceInputProps {
  value: string | number
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  min?: string
  step?: string
  disabled?: boolean
}

function formatWithThousands(val: string): string {
  const num = val.replace(/[^\d]/g, "")
  if (!num) return ""
  return Number(num).toLocaleString("ru-RU")
}

function stripFormatting(val: string): string {
  return val.replace(/[^\d]/g, "")
}

export function PriceInput({
  value,
  onChange,
  placeholder = "0",
  className,
  min,
  step,
  disabled,
}: PriceInputProps) {
  const [display, setDisplay] = useState("")

  useEffect(() => {
    const raw = String(value).replace(/[^\d]/g, "")
    setDisplay(raw ? formatWithThousands(raw) : "")
  }, [value])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = stripFormatting(e.target.value)
      setDisplay(raw ? formatWithThousands(raw) : "")
      onChange(raw)
    },
    [onChange]
  )

  return (
    <Input
      type="text"
      inputMode="numeric"
      value={display}
      onChange={handleChange}
      placeholder={placeholder}
      className={cn(className)}
      disabled={disabled}
    />
  )
}
