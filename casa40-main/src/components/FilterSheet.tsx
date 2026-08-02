import { useState, useMemo, useEffect } from 'react';
import { X } from 'lucide-react';
import { districts, roomOptions, layoutFromDb } from '@/data/constants';
import type { PublicProperty } from '@/hooks/useProperties';

export interface Filters {
  districts: string[];
  rooms: number[];
  areaMin: number | null;
  areaMax: number | null;
  isolatedOnly: boolean;
}

export const defaultFilters: Filters = {
  districts: [],
  rooms: [],
  areaMin: null,
  areaMax: null,
  isolatedOnly: false,
};

interface FilterSheetProps {
  open: boolean;
  onClose: () => void;
  filters: Filters;
  onApply: (filters: Filters) => void;
  availableProperties?: PublicProperty[];
}

/** Count occurrences of each value in the budget-filtered set */
function computeAvailability(properties: PublicProperty[]) {
  const districtCounts: Record<string, number> = {};
  const roomCounts: Record<number, number> = {};
  let isolatedCount = 0;

  for (const p of properties) {
    if (p.district) districtCounts[p.district] = (districtCounts[p.district] ?? 0) + 1;
    if (p.rooms != null) roomCounts[p.rooms] = (roomCounts[p.rooms] ?? 0) + 1;
    if (p.layout === 'isolated_rooms') isolatedCount++;
  }

  return { districtCounts, roomCounts, isolatedCount };
}

const FilterSheet = ({ open, onClose, filters, onApply, availableProperties = [] }: FilterSheetProps) => {
  const [draft, setDraft] = useState<Filters>(filters);

  // Sync draft when sheet opens
  useEffect(() => {
    if (open) setDraft(filters);
  }, [open]);

  const { districtCounts, roomCounts, isolatedCount } = useMemo(
    () => computeAvailability(availableProperties),
    [availableProperties],
  );

  const toggleDistrict = (d: string) =>
    setDraft(prev => ({
      ...prev,
      districts: prev.districts.includes(d) ? prev.districts.filter(x => x !== d) : [...prev.districts, d],
    }));

  const toggleRoom = (r: number) =>
    setDraft(prev => ({
      ...prev,
      rooms: prev.rooms.includes(r) ? prev.rooms.filter(x => x !== r) : [...prev.rooms, r],
    }));

  const handleReset = () => {
    const reset = { ...defaultFilters };
    setDraft(reset);
    onApply(reset);
  };

  const handleApply = () => {
    onApply(draft);
    onClose();
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[60] bg-foreground/20 backdrop-blur-[2px]" onClick={onClose} />

      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-[70] bg-card rounded-t-3xl max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-300">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-9 h-1 rounded-full bg-border" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-4 pt-1">
          <h2 className="text-[17px] font-semibold text-foreground">Уточнить на карте</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-accent transition-colors">
            <X className="w-4.5 h-4.5 text-muted-foreground" />
          </button>
        </div>

        <div className="px-5 space-y-5 pb-5">
          {/* Район */}
          <div>
            <p className="text-[13px] font-medium text-muted-foreground mb-2.5">Район</p>
            <div className="flex flex-wrap gap-2">
              {districts.map(d => {
                const count = districtCounts[d] ?? 0;
                const disabled = count === 0;
                const selected = draft.districts.includes(d);
                return (
                  <button
                    key={d}
                    disabled={disabled}
                    onClick={() => !disabled && toggleDistrict(d)}
                    className={`px-3 py-[7px] rounded-xl text-[13px] font-medium transition-colors ${
                      disabled
                        ? 'bg-accent/50 text-muted-foreground/40 cursor-not-allowed'
                        : selected
                          ? 'bg-foreground text-primary-foreground'
                          : 'bg-accent text-foreground'
                    }`}
                  >
                    {d}{count > 0 && <span className="ml-1 opacity-50">{count}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Комнаты */}
          <div>
            <p className="text-[13px] font-medium text-muted-foreground mb-2.5">Комнаты</p>
            <div className="flex gap-2">
              {roomOptions.map(r => {
                const count = roomCounts[r] ?? 0;
                const disabled = count === 0;
                const selected = draft.rooms.includes(r);
                return (
                  <button
                    key={r}
                    disabled={disabled}
                    onClick={() => !disabled && toggleRoom(r)}
                    className={`min-w-11 h-11 px-2 rounded-xl text-[14px] font-semibold transition-colors flex items-center justify-center gap-0.5 ${
                      disabled
                        ? 'bg-accent/50 text-muted-foreground/40 cursor-not-allowed'
                        : selected
                          ? 'bg-foreground text-primary-foreground'
                          : 'bg-accent text-foreground'
                    }`}
                  >
                    {r}{count > 0 && <span className="text-[11px] font-normal opacity-50">{count}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Площадь */}
          <div>
            <p className="text-[13px] font-medium text-muted-foreground mb-2.5">Площадь, м²</p>
            <div className="flex gap-3">
              <input
                type="number"
                placeholder="от"
                value={draft.areaMin ?? ''}
                onChange={e => setDraft(p => ({ ...p, areaMin: e.target.value ? Number(e.target.value) : null }))}
                className="casa-input flex-1"
              />
              <input
                type="number"
                placeholder="до"
                value={draft.areaMax ?? ''}
                onChange={e => setDraft(p => ({ ...p, areaMax: e.target.value ? Number(e.target.value) : null }))}
                className="casa-input flex-1"
              />
            </div>
          </div>

          {/* Изолированные комнаты */}
          <div className="flex items-center justify-between py-1">
            <p className={`text-[14px] font-medium ${isolatedCount === 0 ? 'text-muted-foreground/40' : 'text-foreground'}`}>
              Изолированные комнаты
              {isolatedCount > 0 && <span className="ml-1.5 text-[12px] opacity-50">{isolatedCount}</span>}
            </p>
            <button
              disabled={isolatedCount === 0}
              onClick={() => isolatedCount > 0 && setDraft(p => ({ ...p, isolatedOnly: !p.isolatedOnly }))}
              className={`w-[46px] h-[28px] rounded-full transition-colors relative ${
                isolatedCount === 0
                  ? 'bg-border/50 cursor-not-allowed'
                  : draft.isolatedOnly ? 'bg-foreground' : 'bg-border'
              }`}
            >
              <div
                className={`absolute top-[3px] w-[22px] h-[22px] rounded-full bg-card shadow-sm transition-transform ${
                  draft.isolatedOnly ? 'left-[21px]' : 'left-[3px]'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 pb-6 pt-2 flex gap-3 border-t border-border">
          <button onClick={handleReset} className="casa-btn-secondary flex-1">
            Сбросить
          </button>
          <button onClick={handleApply} className="casa-btn-primary flex-[2]">
            Показать варианты
          </button>
        </div>
      </div>
    </>
  );
};

export default FilterSheet;
