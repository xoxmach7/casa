'use client';

/**
 * Вид «Карточки» на шахматке.
 *
 * Показывает не сжатые плитки, а РОВНО ту карточку, которая раньше открывалась
 * в правом блоке при выборе квартиры: планировка, площадь, цена, статус и все
 * действия — фиксация, подборка, ипотека, квартирный лист. Отсюда и два
 * столбца: карточка большая, а брокеру нужно видеть несколько квартир разом,
 * не кликая по каждой.
 *
 * Единственный источник разметки — ApartmentDetailPanel: если карточка меняется
 * там, она меняется и здесь, второй копии не существует.
 */

import { ApartmentDetailPanel, type ApartmentDetail } from './ApartmentDetailPanel';

interface ApartmentCardsViewProps {
  apartments: ApartmentDetail[];
  selectedId: string | null;
  onSelect: (apartment: ApartmentDetail) => void;
  onFixate: (apartment: ApartmentDetail) => void;
  projectName?: string;
  projectCity?: string;
  projectAddress?: string;
  /** Действия владельца каталога (правка, удаление) — по одной на карточку. */
  renderActions?: (apartment: ApartmentDetail) => React.ReactNode;
}

export function ApartmentCardsView({
  apartments,
  selectedId,
  onSelect,
  onFixate,
  projectName,
  projectCity,
  projectAddress,
  renderActions,
}: ApartmentCardsViewProps) {
  if (apartments.length === 0) {
    return <p className="py-8 text-center text-muted-foreground">Квартиры не найдены.</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {apartments.map((apt) => (
        <div
          key={apt.id}
          onClick={() => onSelect(apt)}
          className={
            selectedId === apt.id
              ? 'rounded-xl ring-2 ring-primary/50'
              : 'rounded-xl'
          }
        >
          <ApartmentDetailPanel
            apartment={apt}
            onFixate={onFixate}
            projectName={projectName}
            projectCity={projectCity}
            projectAddress={projectAddress}
          >
            {renderActions?.(apt)}
          </ApartmentDetailPanel>
        </div>
      ))}
    </div>
  );
}
