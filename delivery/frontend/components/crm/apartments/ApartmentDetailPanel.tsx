'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Home, Bookmark, Calculator, Image as ImageIcon, FileDown } from 'lucide-react';
import { AddToSelectionDialog } from '@/components/apartments/AddToSelectionDialog';
import type { ApartmentCardData } from '@/components/apartments/ApartmentCard';
import { getStoredUser } from '@/lib/auth-utils';
import { useToast } from '@/hooks/use-toast';

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
  /** Данные ЖК — попадают в квартирный лист, который брокер отдаёт клиенту. */
  projectName?: string;
  projectCity?: string;
  projectAddress?: string;
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
  AVAILABLE: 'bg-[#15325B]',
  RESERVED: 'bg-yellow-500',
  SOLD: 'bg-gray-500',
};

export function ApartmentDetailPanel({
  apartment,
  onFixate,
  projectName,
  projectCity,
  projectAddress,
  children,
}: ApartmentDetailPanelProps) {
  const router = useRouter();
  const { toast } = useToast();
  // Квартира, для которой открыт диалог «В подборку» (null = закрыт).
  const [selectionApartment, setSelectionApartment] = useState<ApartmentCardData | null>(null);
  const [sheetBusy, setSheetBusy] = useState(false);

  const downloadSheet = async (apt: ApartmentDetail) => {
    setSheetBusy(true);
    try {
      const user = getStoredUser();
      const { generateApartmentSheetPdf } = await import('@/lib/apartment-sheet-pdf');
      await generateApartmentSheetPdf({
        projectName: projectName ?? '',
        projectCity,
        projectAddress,
        number: apt.number,
        floor: apt.floor,
        rooms: apt.rooms,
        area: apt.area,
        price: apt.price,
        statusLabel: STATUS_LABEL[apt.status],
        layoutImage: apt.layoutImage,
        agentName: [user?.firstName, user?.lastName].filter(Boolean).join(' ') || undefined,
        agentPhone: typeof user?.phone === 'string' ? user.phone : undefined,
      });
    } catch {
      toast({
        title: 'Не удалось собрать квартирный лист',
        description: 'Попробуйте ещё раз.',
        variant: 'destructive',
      });
    } finally {
      setSheetBusy(false);
    }
  };

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
        <div>
          <CardTitle>Квартира №{apartment.number}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {apartment.rooms}-комнатная, {apartment.floor} этаж
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {apartment.layoutImage ? (
          <img
            src={apartment.layoutImage}
            alt="Планировка"
            className="max-h-64 w-full rounded-lg border object-contain"
          />
        ) : (
          <div className="flex h-40 w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/40 text-muted-foreground">
            <ImageIcon className="h-8 w-8 opacity-50" />
            <span className="text-xs">Нет изображения планировки</span>
          </div>
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

        {/* Квартирный лист — то, что брокер отдаёт клиенту после показа. */}
        <Button
          variant="outline"
          className="w-full"
          disabled={sheetBusy}
          onClick={() => void downloadSheet(apartment)}
        >
          <FileDown className="mr-2 h-4 w-4" />
          {sheetBusy ? 'Готовим…' : 'Скачать квартирный лист'}
        </Button>

        {children}
      </CardContent>

      <AddToSelectionDialog
        apartment={selectionApartment}
        onClose={() => setSelectionApartment(null)}
      />
    </Card>
  );
}
