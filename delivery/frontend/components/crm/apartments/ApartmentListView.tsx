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

interface ApartmentListViewProps {
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

const STATUS_DOT: Record<Apartment['status'], string> = {
  AVAILABLE: 'text-green-600',
  RESERVED: 'text-yellow-600',
  SOLD: 'text-gray-500',
};

export function ApartmentListView({ apartments, selectedId, onSelect }: ApartmentListViewProps) {
  if (apartments.length === 0) {
    return <p className="py-8 text-center text-muted-foreground">Квартиры не найдены.</p>;
  }

  return (
    <div className="max-h-[600px] space-y-1.5 overflow-y-auto">
      {apartments.map((apt) => (
        <button
          key={apt.id}
          onClick={() => onSelect(apt)}
          className={`flex w-full items-center justify-between rounded-md border p-2.5 text-left text-sm transition-colors hover:bg-muted ${
            selectedId === apt.id ? 'border-primary bg-muted' : ''
          }`}
        >
          <span>
            {apt.rooms}-комн {apt.area}м² · №{apt.number}
          </span>
          <span className={apt.status === 'AVAILABLE' ? 'font-medium' : `font-medium ${STATUS_DOT[apt.status]}`}>
            {apt.status === 'AVAILABLE' ? formatPrice(apt.price) : apt.status === 'RESERVED' ? 'Бронь' : 'Продано'}
          </span>
        </button>
      ))}
    </div>
  );
}
