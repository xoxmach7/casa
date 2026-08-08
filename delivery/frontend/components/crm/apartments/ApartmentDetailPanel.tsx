'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Home } from 'lucide-react';

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
  RESERVED: 'Забронировано',
  SOLD: 'Продано',
};

const STATUS_BADGE: Record<ApartmentDetail['status'], string> = {
  AVAILABLE: 'bg-green-500',
  RESERVED: 'bg-yellow-500',
  SOLD: 'bg-gray-500',
};

export function ApartmentDetailPanel({ apartment, onFixate, children }: ApartmentDetailPanelProps) {
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
        <CardTitle>Квартира №{apartment.number}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {apartment.rooms}-комнатная, {apartment.floor} этаж
        </p>
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

        {children}
      </CardContent>
    </Card>
  );
}
