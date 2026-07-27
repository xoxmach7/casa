"use client"

import { useState } from "react"
import { ArrowLeftRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TradeInForm } from "./forms/TradeInForm"
import type { CrmProperty } from "@/types/kanban"

interface TradeInButtonProps {
  property: CrmProperty
}

export function TradeInButton({ property }: TradeInButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-muted-foreground hover:text-primary"
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
        }}
        title="TradeIn"
      >
        <ArrowLeftRight className="h-3.5 w-3.5" />
      </Button>

      <TradeInForm open={open} onOpenChange={setOpen} property={property} />
    </>
  )
}
