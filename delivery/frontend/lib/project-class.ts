// Класс ЖК хранится в базе латиницей (Comfort/Business/Premium/...), а показываем
// его по-русски (S15). Неизвестные значения отдаём как есть — не теряем данные.
const CLASS_LABELS: Record<string, string> = {
  economy: 'Эконом',
  comfort: 'Комфорт',
  business: 'Бизнес',
  premium: 'Премиум',
  elite: 'Элит',
  luxury: 'Люкс',
};

export function projectClassLabel(value?: string | null): string {
  if (!value) return '';
  return CLASS_LABELS[value.trim().toLowerCase()] ?? value;
}
