'use client';

import { useMemo, useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Apartment {
  id: string;
  number: string;
  floor: number;
  rooms: number;
  area: string;
  price: string;
  status: 'AVAILABLE' | 'RESERVED' | 'SOLD';
  buildingId?: string | null;
  entrance?: number | null;
}

interface Building {
  id: string;
  name: string;
}

interface ApartmentTableViewProps {
  apartments: Apartment[];
  buildings: Building[];
  selectedId: string | null;
  onSelect: (apartment: Apartment) => void;
}

const STATUS_STYLE: Record<Apartment['status'], string> = {
  AVAILABLE: 'bg-green-50 border-green-300 text-green-900 hover:bg-green-100',
  // Фиксация — жёлтым (S10). Продано — серым, тем самым, что раньше был у фиксации (S9).
  RESERVED: 'bg-yellow-100 border-yellow-400 text-yellow-800 hover:bg-yellow-200',
  SOLD: 'bg-gray-100 border-gray-300 text-gray-500 opacity-70',
};

function groupForTable(apartments: Apartment[]) {
  const byFloor = new Map<number, Apartment[]>();
  for (const apt of apartments) {
    const list = byFloor.get(apt.floor) ?? [];
    list.push(apt);
    byFloor.set(apt.floor, list);
  }
  for (const list of byFloor.values()) {
    list.sort((a, b) => a.number.localeCompare(b.number));
  }
  const floors = Array.from(byFloor.keys()).sort((a, b) => b - a);
  const columns = Math.max(0, ...Array.from(byFloor.values()).map((l) => l.length));
  return { floors, byFloor, columns };
}

export function ApartmentTableView({ apartments, buildings, selectedId, onSelect }: ApartmentTableViewProps) {
  const [buildingId, setBuildingId] = useState<string>(buildings[0]?.id ?? '');
  const [entrance, setEntrance] = useState<string>('');

  useEffect(() => {
    if (!buildingId && buildings.length > 0) setBuildingId(buildings[0].id);
  }, [buildings, buildingId]);

  const inBuilding = useMemo(
    () => (buildingId ? apartments.filter((a) => a.buildingId === buildingId) : apartments),
    [apartments, buildingId]
  );

  const entrances = useMemo(() => {
    const set = new Set<number>();
    for (const a of inBuilding) {
      if (a.entrance != null) set.add(a.entrance);
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [inBuilding]);

  useEffect(() => {
    if (entrances.length > 0 && !entrances.includes(Number(entrance))) {
      setEntrance(String(entrances[0]));
    }
  }, [entrances, entrance]);

  const inEntrance = useMemo(
    () => (entrances.length > 0 ? inBuilding.filter((a) => a.entrance === Number(entrance)) : inBuilding),
    [inBuilding, entrances, entrance]
  );

  const { floors, byFloor, columns } = useMemo(() => groupForTable(inEntrance), [inEntrance]);

  if (apartments.length === 0) {
    return <p className="py-8 text-center text-muted-foreground">Квартиры не найдены.</p>;
  }

  return (
    <div>
      <div className="mb-3 flex gap-2">
        {buildings.length > 0 && (
          <Select value={buildingId} onValueChange={setBuildingId}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Здание" /></SelectTrigger>
            <SelectContent>
              {buildings.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {entrances.length > 0 && (
          <Select value={entrance} onValueChange={setEntrance}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Подъезд" /></SelectTrigger>
            <SelectContent>
              {entrances.map((e) => (
                <SelectItem key={e} value={String(e)}>Подъезд {e}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {floors.length === 0 || columns === 0 ? (
        <p className="py-8 text-center text-muted-foreground">
          Нет квартир с заданным зданием/подъездом. Заполните их в карточке квартиры.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="w-8 pr-2 pb-2 text-left align-bottom text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Этаж
                </th>
              </tr>
            </thead>
            <tbody>
              {floors.map((floor) => (
                <tr key={floor}>
                  <td className="w-8 pr-2 align-middle font-semibold">{floor}</td>
                  {Array.from({ length: columns }).map((_, col) => {
                    const apt = byFloor.get(floor)?.[col];
                    if (!apt) return <td key={col} className="p-1" />;
                    return (
                      <td key={col} className="p-1">
                        <button
                          onClick={() => onSelect(apt)}
                          className={`w-full rounded border p-1.5 text-left ${STATUS_STYLE[apt.status]} ${
                            selectedId === apt.id ? 'ring-2 ring-primary' : ''
                          }`}
                        >
                          <div>{apt.rooms}к {apt.area}м²</div>
                          <div className="font-semibold">№{apt.number}</div>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
