'use client';

interface Apartment {
  id: string;
  number: string;
  floor: number;
  rooms: number;
  area: string;
  price: string;
  status: 'AVAILABLE' | 'RESERVED' | 'SOLD';
}

interface ApartmentCardsViewProps {
  apartments: Apartment[];
  selectedId: string | null;
  onSelect: (apartment: Apartment) => void;
}

function formatPrice(price: string) {
  return new Intl.NumberFormat('ru-KZ', {
    style: 'currency',
    currency: 'KZT',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(parseFloat(price));
}

const STATUS_LABEL: Record<Apartment['status'], { text: string; cls: string }> = {
  AVAILABLE: { text: 'Доступно', cls: 'bg-emerald-100 text-emerald-700' },
  RESERVED: { text: 'Фиксация', cls: 'bg-yellow-100 text-yellow-700' },
  SOLD: { text: 'Продано', cls: 'bg-gray-100 text-gray-600' },
};

export function ApartmentCardsView({ apartments, selectedId, onSelect }: ApartmentCardsViewProps) {
  if (apartments.length === 0) {
    return <p className="py-8 text-center text-muted-foreground">Квартиры не найдены.</p>;
  }

  return (
    <div className="grid max-h-[600px] grid-cols-2 gap-3 overflow-y-auto">
      {apartments.map((apt) => {
        const st = STATUS_LABEL[apt.status];
        return (
          <button
            key={apt.id}
            onClick={() => onSelect(apt)}
            className={`flex flex-col items-start rounded-lg border p-3 text-left transition-colors hover:bg-muted ${
              selectedId === apt.id ? 'border-primary ring-1 ring-primary/30 bg-muted' : ''
            }`}
          >
            <div className="flex w-full items-center justify-between">
              <span className="font-semibold">№{apt.number}</span>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${st.cls}`}>{st.text}</span>
            </div>
            <span className="mt-1 text-sm text-muted-foreground">
              {apt.rooms}-комн · {apt.area} м² · {apt.floor} этаж
            </span>
            <span className="mt-2 text-base font-bold text-[#15325B] tabular-nums">
              {formatPrice(apt.price)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
