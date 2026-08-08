'use client';

import { Home } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

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

function getStatusColor(status: string) {
  switch (status) {
    case 'AVAILABLE':
      return 'bg-green-100 border-green-500 hover:bg-green-200 text-green-900';
    case 'RESERVED':
      return 'bg-yellow-100 border-yellow-500 hover:bg-yellow-200 text-yellow-900';
    case 'SOLD':
      return 'bg-gray-100 border-gray-500 hover:bg-gray-200 text-gray-900';
    default:
      return 'bg-gray-100 border-gray-300';
  }
}

export function ApartmentCardsView({ apartments, selectedId, onSelect }: ApartmentCardsViewProps) {
  const byFloor = apartments.reduce((acc, apt) => {
    if (!acc[apt.floor]) acc[apt.floor] = [];
    acc[apt.floor].push(apt);
    return acc;
  }, {} as Record<number, Apartment[]>);

  const floors = Object.keys(byFloor).map(Number).sort((a, b) => b - a);

  if (floors.length === 0) {
    return (
      <div className="py-12 text-center">
        <Home className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">Квартиры не найдены. Попробуйте изменить фильтры.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {floors.map((floor) => (
        <div key={floor} className="rounded-lg border p-4">
          <div className="mb-3 flex items-center gap-2">
            <Badge variant="outline" className="text-base">{floor} этаж</Badge>
            <span className="text-sm text-muted-foreground">({byFloor[floor].length} квартир)</span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {byFloor[floor]
              .sort((a, b) => a.number.localeCompare(b.number))
              .map((apt) => (
                <button
                  key={apt.id}
                  onClick={() => onSelect(apt)}
                  className={`rounded-lg border-2 p-3 text-left transition-all ${getStatusColor(apt.status)} ${
                    selectedId === apt.id ? 'ring-2 ring-primary' : ''
                  }`}
                >
                  <div className="text-lg font-bold">{apt.number}</div>
                  <div className="text-xs opacity-75">{apt.rooms}-комн</div>
                  <div className="text-xs opacity-75">{apt.area} м²</div>
                </button>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
