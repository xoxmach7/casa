'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Home, Bookmark, Calculator, Star } from 'lucide-react';
import { AddToSelectionDialog } from '@/components/apartments/AddToSelectionDialog';
import type { ApartmentCardData } from '@/components/apartments/ApartmentCard';
import { getApiUrl, getAuthHeaders } from '@/lib/api-client';

export interface ApartmentDetail {
  id: string;
  number: string;
  floor: number;
  rooms: number;
  area: string;
  price: string;
  status: 'AVAILABLE' | 'RESERVED' | 'SOLD';
  layoutImage?: string;
}

interface ApartmentDetailPanelProps {
  apartment: ApartmentDetail | null;
  onFixate: (apartment: ApartmentDetail) => void;
  children?: React.ReactNode;
}

function formatPrice(price: string) {
  return new Intl.NumberFormat('ru-KZ', {
    style: 'currency',
    currency: 'KZT',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(parseFloat(price));
}

const STATUS_LABEL: Record<ApartmentDetail['status'], string> = {
  AVAILABLE: 'Доступно',
  RESERVED: 'Фиксация',
  SOLD: 'Продано',
};

const STATUS_BADGE: Record<ApartmentDetail['status'], string> = {
  AVAILABLE: 'bg-green-500',
  RESERVED: 'bg-yellow-500',
  SOLD: 'bg-gray-500',
};

export function ApartmentDetailPanel({ apartment, onFixate, children }: ApartmentDetailPanelProps) {
  const router = useRouter();
  // Квартира, для которой открыт диалог «В подборку» (null = закрыт).
  const [selectionApartment, setSelectionApartment] = useState<ApartmentCardData | null>(null);
  // Личное избранное (без клиента): в нём ли выбранная квартира.
  const [isFavorite, setIsFavorite] = useState(false);
  const apartmentId = apartment?.id ?? null;

  useEffect(() => {
    if (!apartmentId) return;
    let cancelled = false;
    fetch(getApiUrl('favorites'), { headers: getAuthHeaders() })
      .then((r) => (r.ok ? r.json() : []))
      .then((list: { apartmentId: string }[]) => {
        if (!cancelled) setIsFavorite(list.some((f) => f.apartmentId === apartmentId));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [apartmentId]);

  async function toggleFavorite() {
    if (!apartmentId) return;
    const next = !isFavorite;
    setIsFavorite(next); // оптимистично
    try {
      if (next) {
        await fetch(getApiUrl('favorites'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify({ apartmentId }),
        });
      } else {
        await fetch(getApiUrl(`favorites/${apartmentId}`), { method: 'DELETE', headers: getAuthHeaders() });
      }
    } catch {
      setIsFavorite(!next); // откат при ошибке
    }
  }

  if (!apartment) {
    return (
      <Card className="h-full">
        <CardContent className="flex h-full min-h-[300px] flex-col items-center justify-center text-muted-foreground">
          <Home className="mb-3 h-10 w-10" />
          <p>Выберите квартиру слева</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle>Квартира №{apartment.number}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {apartment.rooms}-комнатная, {apartment.floor} этаж
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            title={isFavorite ? 'Убрать из избранного' : 'В избранное'}
            onClick={toggleFavorite}
          >
            <Star className={isFavorite ? 'h-5 w-5 fill-[#f0b429] text-[#f0b429]' : 'h-5 w-5 text-muted-foreground'} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {apartment.layoutImage && (
          <img
            src={apartment.layoutImage}
            alt="Планировка"
            className="max-h-64 w-full rounded-lg border object-contain"
          />
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Площадь</p>
            <p className="text-lg font-medium">{apartment.area} м²</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Цена</p>
            <p className="text-lg font-medium">{formatPrice(apartment.price)}</p>
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm text-muted-foreground">Статус</p>
          <Badge className={STATUS_BADGE[apartment.status]}>{STATUS_LABEL[apartment.status]}</Badge>
        </div>

        {apartment.status === 'AVAILABLE' && (
          <Button className="w-full" onClick={() => onFixate(apartment)}>
            Фиксировать клиента
          </Button>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            onClick={() =>
              setSelectionApartment({
                id: apartment.id,
                number: apartment.number,
                floor: apartment.floor,
                rooms: apartment.rooms,
                area: parseFloat(apartment.area) || 0,
                price: parseFloat(apartment.price) || 0,
                status: apartment.status,
                layoutImage: apartment.layoutImage,
              })
            }
          >
            <Bookmark className="mr-2 h-4 w-4" />
            В подборку
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push(`/dashboard/mortgage?price=${encodeURIComponent(apartment.price)}`)}
          >
            <Calculator className="mr-2 h-4 w-4" />
            Рассчитать ипотеку
          </Button>
        </div>

        {children}
      </CardContent>

      <AddToSelectionDialog
        apartment={selectionApartment}
        onClose={() => setSelectionApartment(null)}
      />
    </Card>
  );
}
