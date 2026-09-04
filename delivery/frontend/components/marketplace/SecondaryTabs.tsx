"use client";

/**
 * Вкладки раздела «Вторичка».
 *
 * Сущности раздела живут ВНУТРИ страницы, а не отдельными пунктами сайдбара:
 * четыре строки в панели перегружали навигацию. Тот же приём уже применён к
 * «Ипотеке» и CRM — один пункт меню, вкладки внутри.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Store, BadgeCheck, Handshake, Ruler } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { title: "Площадка", url: "/dashboard/marketplace", icon: Store, exact: true },
  { title: "Мои фиксации", url: "/dashboard/marketplace/fixations", icon: BadgeCheck },
  { title: "Сделки", url: "/dashboard/deal-room", icon: Handshake },
  { title: "Оценка объектов", url: "/dashboard/valuations", icon: Ruler },
];

export function SecondaryTabs() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Разделы вторички"
      className="mb-4 flex flex-wrap gap-1 border-b border-border pb-2"
    >
      {TABS.map((tab) => {
        const active = tab.exact ? pathname === tab.url : pathname.startsWith(tab.url);
        return (
          <Link
            key={tab.url}
            href={tab.url}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <tab.icon className="h-4 w-4 shrink-0" />
            {tab.title}
          </Link>
        );
      })}
    </nav>
  );
}
