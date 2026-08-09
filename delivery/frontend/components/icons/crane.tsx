import type { SVGProps } from "react"

/**
 * Башенный кран — иконки крана нет в lucide-react, а для срока сдачи ЖК
 * календарь читается как «событие в календаре», а не как «дом ещё строится».
 * Нарисована в стиле lucide: 24×24, stroke currentColor, width 2, round caps.
 */
export function Crane({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {/* мачта и основание */}
      <path d="M7 21V6" />
      <path d="M4 21h6" />
      {/* стрела и противовесная консоль */}
      <path d="M3 6h18" />
      {/* оголовок с расчалками */}
      <path d="M7 3 3 6" />
      <path d="M7 3l9 3" />
      {/* грузовой трос и груз */}
      <path d="M17 6v4" />
      <rect x="15" y="10" width="4" height="3" rx="0.5" />
    </svg>
  )
}
