// Фирменный знак CASA как в Figma: открытая «C» (толстая внешняя дуга + тонкая
// внутренняя, обе с проёмом справа) и словесный знак CASA. Без скруглённого
// квадрата, который был у растрового casa-logo.png. Рисуется вектором —
// чёткий на любом экране, цвет наследуется через currentColor.
//
// Дуги заданы явными путями: внешняя — мажорная дуга R=27 с проёмом ~84° справа,
// внутренняя — её тонкое эхо R=15.
export function CasaLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 250 72"
      className={className}
      role="img"
      aria-label="CASA Pro"
      fill="none"
    >
      <g stroke="currentColor" strokeLinecap="round" fill="none">
        {/* толстая внешняя «C» */}
        <path d="M 56.1 17.9 A 27 27 0 1 0 56.1 54.1" strokeWidth="9.5" />
        {/* тонкая внутренняя дуга — эхо основной формы */}
        <path d="M 46.4 25.2 A 15 15 0 1 0 46.4 46.8" strokeWidth="3.2" />
      </g>
      <text
        x="82"
        y="49"
        fill="currentColor"
        fontFamily="var(--font-geist-sans), system-ui, sans-serif"
        fontSize="34"
        fontWeight="600"
        letterSpacing="5"
      >
        CASA
      </text>
    </svg>
  );
}
