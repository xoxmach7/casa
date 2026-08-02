import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, CheckCircle, SlidersHorizontal, Loader2, Maximize2 } from 'lucide-react';
import { formatPrice } from '@/components/PropertyCard';
import TrustLabel from '@/components/TrustLabel';
import FilterSheet, { defaultFilters, type Filters } from '@/components/FilterSheet';
import PublicMap from '@/components/PublicMap';
import casaLogo from '@/assets/casa-logo.png';
import { usePublishedProperties } from '@/hooks/useProperties';

const FALLBACK_MAX = 80000000;
const SLIDER_MIN = 10000000;
const SLIDER_STEP = 1000000;

const BuyerHome = () => {
  const navigate = useNavigate();
  const [budget, setBudget] = useState<number | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const fitAllRef = useRef<(() => void) | null>(null);

  const { data: published = [], isLoading } = usePublishedProperties();

  // Derive max price from real data
  const maxPrice = useMemo(() => {
    const prices = published.map(p => p.price ?? 0).filter(p => p > 0);
    if (prices.length === 0) return FALLBACK_MAX;
    const raw = Math.max(...prices);
    return Math.ceil(raw / SLIDER_STEP) * SLIDER_STEP; // round up to step
  }, [published]);

  // Auto-set budget to max when data loads or when it's null
  useEffect(() => {
    if (budget === null && published.length > 0) {
      setBudget(maxPrice);
    }
  }, [published, maxPrice, budget]);

  const effectiveBudget = budget ?? maxPrice;
  const sliderMax = Math.max(maxPrice, effectiveBudget);

  // Step 1: budget filter
  const budgetFiltered = useMemo(
    () => published.filter(p => {
      const price = p.price ?? 0;
      return price > 0 && price <= effectiveBudget;
    }),
    [effectiveBudget, published],
  );

  // Step 2: apply "Уточнить" filters on top of budget result, sort by price desc
  const filtered = useMemo(() => {
    let result = budgetFiltered;

    if (filters.districts.length > 0) {
      result = result.filter(p => p.district && filters.districts.includes(p.district));
    }
    if (filters.rooms.length > 0) {
      result = result.filter(p => p.rooms != null && filters.rooms.includes(p.rooms));
    }
    if (filters.areaMin != null) {
      result = result.filter(p => (p.area ?? 0) >= filters.areaMin!);
    }
    if (filters.areaMax != null) {
      result = result.filter(p => (p.area ?? 0) <= filters.areaMax!);
    }
    if (filters.isolatedOnly) {
      result = result.filter(p => p.layout === 'isolated_rooms');
    }

    return [...result].sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
  }, [budgetFiltered, filters]);

  const mapMarkers = useMemo(
    () =>
      filtered
        .filter((p) => p.lat != null && p.lng != null)
        .map((p) => {
          const priceM = (p.price ?? 0) / 1000000;
          const priceLabel = priceM % 1 === 0
            ? `${Math.round(priceM)} млн ₸`
            : `${priceM.toFixed(1)} млн ₸`;
          const location = p.residential_complex
            ? `ЖК ${p.residential_complex}`
            : p.address
              ? `ул. ${[p.address, p.house_number].filter(Boolean).join(' ')}`
              : '—';
          return {
            id: p.id,
            lat: p.lat!,
            lng: p.lng!,
            priceLabel,
            popupPrice: new Intl.NumberFormat('ru-RU').format(p.price ?? 0) + ' ₸',
            popupRooms: p.rooms,
            popupArea: p.area,
            popupLocation: location,
          };
        }),
    [filtered],
  );

  const active = selectedPropertyId
    ? filtered.find(p => p.id === selectedPropertyId) || filtered[0]
    : filtered[0];

  const formatBudget = (val: number) =>
    new Intl.NumberFormat('ru-RU').format(val) + ' ₸';

  const pluralVariant = (n: number) => {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return 'вариант';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'варианта';
    return 'вариантов';
  };

  const sliderPercent = ((effectiveBudget - SLIDER_MIN) / (sliderMax - SLIDER_MIN)) * 100;

  const handleApplyFilters = (f: Filters) => {
    setFilters(f);
    // If all filters reset, also reset budget to show everything
    const isDefault = f.districts.length === 0 && f.rooms.length === 0 &&
      f.areaMin == null && f.areaMax == null && !f.isolatedOnly;
    if (isDefault) setBudget(maxPrice);
  };

  const handlePinClick = (propertyId: string) => {
    setSelectedPropertyId(propertyId);
    requestAnimationFrame(() => {
      const el = document.getElementById(`property-card-${propertyId}`);
      if (el) {
        const y = el.getBoundingClientRect().top + window.scrollY - 120;
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
    });
  };

  const getPhotoUrl = (p: typeof published[0]) => {
    if (p.photo_urls && p.photo_urls.length > 0 && p.photo_urls[0]) return p.photo_urls[0];
    return '/placeholder.svg';
  };

  const hasActiveFilters = filters.districts.length > 0 || filters.rooms.length > 0 ||
    filters.areaMin != null || filters.areaMax != null || filters.isolatedOnly;

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between h-[52px] px-4">
        <button onClick={() => navigate('/')} className="active:scale-95 transition-transform">
          <img src={casaLogo} alt="CASA" className="h-[22px] object-contain" />
        </button>
        <div className="flex items-center">
          <button
            onClick={() => navigate('/sell')}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-accent transition-colors"
          >
            <Plus className="w-5 h-5 text-foreground" strokeWidth={1.5} />
          </button>
        </div>
      </header>

      <div className="px-4 space-y-3 pb-6">
        {/* Budget Card */}
        <div className="casa-card p-4 pb-3.5">
          <p className="text-[13px] font-medium text-muted-foreground mb-3">
            Бюджет покупки квартиры
          </p>
          <div className="flex items-baseline justify-between mb-3">
            <p className="text-[22px] font-bold text-foreground tabular-nums tracking-tight leading-none">
              {formatBudget(effectiveBudget)}
            </p>
            <p className="text-[13px] text-muted-foreground/70 tabular-nums">
              {formatBudget(sliderMax)}
            </p>
          </div>
          <div className="relative h-5 flex items-center mb-3">
            <div className="w-full h-[3px] bg-border rounded-full relative">
              <div
                className="absolute left-0 top-0 h-full bg-foreground rounded-full"
                style={{ width: `${sliderPercent}%` }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-[18px] h-[18px] rounded-full bg-foreground shadow-md cursor-pointer"
                style={{ left: `${sliderPercent}%`, transform: `translate(-50%, -50%)` }}
              />
            </div>
            <input
              type="range"
              min={SLIDER_MIN}
              max={sliderMax}
              step={SLIDER_STEP}
              value={effectiveBudget}
              onChange={(e) => setBudget(Number(e.target.value))}
              className="absolute inset-0 w-full opacity-0 cursor-pointer"
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {isLoading ? (
                <Loader2 className="w-[15px] h-[15px] animate-spin text-muted-foreground" />
              ) : (
                <CheckCircle className="w-[15px] h-[15px] text-casa-success" />
              )}
              <span className="text-[13px] text-foreground">
                <strong>{filtered.length}</strong> {pluralVariant(filtered.length)} для просмотра
              </span>
            </div>
            <button
              onClick={() => setFilterOpen(true)}
              className={`flex items-center gap-1 text-[12px] font-medium transition-colors ${
                hasActiveFilters
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <SlidersHorizontal className="w-3 h-3" />
              Уточнить
              {hasActiveFilters && (
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              )}
            </button>
          </div>
        </div>

        {/* Map + Property Card */}
        <div className="rounded-2xl overflow-hidden border border-border relative z-0" style={{ boxShadow: 'var(--shadow-card)' }}>
          <div className="relative" style={{ aspectRatio: '4/4.5' }}>
            <PublicMap
              properties={mapMarkers}
              onMarkerClick={handlePinClick}
              selectedId={active?.id}
              onFitAllRef={fitAllRef}
            />
            <button
              onClick={() => fitAllRef.current?.()}
              className="absolute top-2.5 right-2.5 z-[1000] flex items-center gap-1 px-2 py-1 rounded-md bg-card/90 backdrop-blur-sm border border-border text-[11px] font-medium text-foreground shadow-sm hover:bg-card transition-colors"
            >
              <Maximize2 className="w-3 h-3" />
              Все
            </button>
          </div>

          {active && (
            <div
              id={`property-card-${active.id}`}
              className={`bg-card border-t border-border p-3.5 cursor-pointer transition-all duration-300 ${
                selectedPropertyId === active.id
                  ? 'ring-2 ring-primary/30 bg-primary/[0.03]'
                  : ''
              }`}
              onClick={() => navigate(`/property/${active.id}`)}
            >
              <div className="flex gap-3">
                <img
                  src={getPhotoUrl(active)}
                  alt=""
                  className="w-[76px] h-[76px] rounded-xl object-cover shrink-0"
                />
                <div className="flex-1 min-w-0 space-y-0.5 py-0.5">
                  <p className="text-[18px] font-bold text-foreground tabular-nums tracking-tight leading-tight">
                    {formatPrice(active.price ?? 0)}
                  </p>
                  <p className="text-[12px] text-muted-foreground truncate">
                    Астана, {active.residential_complex ? `ЖК ${active.residential_complex}` : active.address ? `ул. ${[active.address, active.house_number].filter(Boolean).join(' ')}` : '—'}
                  </p>
                  <p className="text-[12px] text-muted-foreground">
                    {active.rooms} комн · {active.area} м² · {active.floor}/{active.total_floors} этаж
                  </p>
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-casa-success">
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
                    Проверенная квартира
                  </span>
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); navigate(`/property/${active.id}`); }}
                className="casa-btn-primary mt-3"
              >
                Смотреть квартиру
              </button>
            </div>
          )}

          {!active && !isLoading && (
            <div className="bg-card border-t border-border p-6 text-center">
              <p className="text-sm text-muted-foreground">Нет квартир в этом бюджете</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="px-4 py-6 border-t border-border/50">
        <div className="flex items-center justify-between">
          <p className="text-[12px] text-muted-foreground">© CASA {new Date().getFullYear()}</p>
          <div className="flex items-center gap-3">
            <a href="tel:+77075037160" className="text-[12px] text-muted-foreground hover:text-foreground transition-colors">8 707 503 71 60</a>
            <a href="https://wa.me/77075037160" target="_blank" rel="noopener noreferrer" className="text-[12px] text-muted-foreground hover:text-foreground transition-colors">WhatsApp</a>
          </div>
        </div>
      </footer>

      <FilterSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        filters={filters}
        onApply={handleApplyFilters}
        availableProperties={budgetFiltered}
      />
    </div>
  );
};

export default BuyerHome;
