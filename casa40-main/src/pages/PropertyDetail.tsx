import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Share2, Loader2 } from 'lucide-react';
import TrustLabel from '@/components/TrustLabel';
import { formatPrice } from '@/components/PropertyCard';
import PhotoGallery from '@/components/PhotoGallery';
import { usePublicProperty } from '@/hooks/useProperties';
import { layoutFromDb, bathroomFromDb } from '@/data/constants';
import Seo from '@/components/Seo';
import { toast } from 'sonner';
import casaLogo from '@/assets/casa-logo.webp';

const PropertyDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: property, isLoading } = usePublicProperty(id);
  const [heroMode, setHeroMode] = useState<'photo' | 'plan'>('photo');
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [openPill, setOpenPill] = useState<string | null>(null);

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'CASA — квартира', url });
      } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(url);
      toast.success('Ссылка скопирована');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!property) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-foreground font-medium">Не удалось загрузить квартиру</p>
          <button onClick={() => navigate('/')} className="text-secondary font-medium text-sm">
            На главную
          </button>
        </div>
      </div>
    );
  }

  const photos = property.photo_urls && property.photo_urls.length > 0
    ? property.photo_urls.filter(Boolean) as string[]
    : ['/placeholder.svg'];
  const heroImage = photos[0];

  const safePrice = (property.price != null && Number.isFinite(property.price) && property.price > 0)
    ? property.price
    : null;

  // Steps
  const steps = [
    { n: '1', title: 'Оставьте заявку', desc: 'Имя и номер для связи.' },
    { n: '2', title: 'CASA согласует время', desc: 'Выбираем удобное время для просмотра.' },
    { n: '3', title: 'Смотрите квартиру', desc: 'Продавец проводит показ.' },
  ];

  // Key advantages (chips)
  const advantages: string[] = [];
  const hasDesignerRenovation = property.renovation_condition && /дизайн/i.test(property.renovation_condition);
  if (property.ready_to_move_in) advantages.push('Можно заселиться сразу');
  if (property.negotiable) advantages.push('Торг возможен');
  if (hasDesignerRenovation) advantages.push('Дизайнерский ремонт');
  if (property.has_furniture) advantages.push('С мебелью');
  if (property.has_appliances) advantages.push('С техникой');

  // Facts table — exclude fields already shown as advantages
  const facts = [
    { label: 'Тип дома', value: property.building_type },
    { label: 'Год постройки', value: property.year_built },
    { label: 'Этаж', value: (property.floor && property.total_floors) ? `${property.floor} из ${property.total_floors}` : undefined },
    { label: 'Высота потолков', value: property.ceiling_height ? `${property.ceiling_height} м` : undefined },
    { label: 'Балкон', value: property.balcony ? 'Есть' : undefined },
    { label: 'Планировка', value: property.layout ? (layoutFromDb[property.layout] || property.layout) : undefined },
    { label: 'Санузел', value: property.bathroom_type ? (bathroomFromDb[property.bathroom_type] || property.bathroom_type) : undefined },
    ...(!hasDesignerRenovation ? [{ label: 'Ремонт', value: property.renovation_condition || undefined }] : []),
    ...(!property.has_furniture ? [{ label: 'Мебель', value: 'Нет' as string | undefined }] : []),
    ...(!property.has_appliances ? [{ label: 'Техника', value: 'Нет' as string | undefined }] : []),
  ].filter(i => i.value);

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      transition={{ duration: 0.35, ease: [0.2, 0, 0, 1] }}
      className="min-h-screen bg-background pb-8"
    >
      <Seo
        title={`${property.rooms}-комн. квартира, ${property.area} м²${property.district ? ` — ${property.district}` : ''}`}
        description={`${property.rooms}-комнатная квартира ${property.area} м²${property.residential_complex ? `, ЖК ${property.residential_complex}` : ''}${property.district ? `, ${property.district}` : ''}. Цена ${formatPrice(property.price)}. Запись на просмотр через CASA.`}
        path={`/property/${id}`}
        image={property.photo_urls?.[0]}
      />
      {/* Header overlay */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between h-13 px-4">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-xl bg-card/80 backdrop-blur-sm flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <button onClick={() => navigate('/')} className="active:scale-95 transition-transform">
          <img src={casaLogo} alt="CASA" className="h-5 object-contain" />
        </button>
        <button
          onClick={handleShare}
          className="w-9 h-9 rounded-xl bg-card/80 backdrop-blur-sm flex items-center justify-center active:scale-90 transition-transform"
        >
          <Share2 className="w-4 h-4 text-foreground" />
        </button>
      </div>

      {/* 1. Photo / Gallery */}
      <div className="relative aspect-[4/3] w-full overflow-hidden">
        {heroMode === 'photo' ? (
          <img src={heroImage} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-card flex items-center justify-center">
            {property.floor_plan_url ? (
              <img src={property.floor_plan_url} alt="Floor plan" className="max-w-full max-h-full object-contain" />
            ) : (
              <svg viewBox="0 0 300 220" className="w-[70%] h-auto opacity-60">
                <rect x="10" y="10" width="130" height="90" rx="2" fill="none" stroke="hsl(var(--foreground))" strokeWidth="1.5" />
                <rect x="150" y="10" width="140" height="90" rx="2" fill="none" stroke="hsl(var(--foreground))" strokeWidth="1.5" />
                <rect x="10" y="110" width="90" height="100" rx="2" fill="none" stroke="hsl(var(--foreground))" strokeWidth="1.5" />
                <rect x="110" y="110" width="80" height="100" rx="2" fill="none" stroke="hsl(var(--foreground))" strokeWidth="1.5" />
                <rect x="200" y="110" width="90" height="100" rx="2" fill="none" stroke="hsl(var(--foreground))" strokeWidth="1.5" />
                <text x="75" y="60" textAnchor="middle" className="fill-muted-foreground text-[10px]">Гостиная</text>
                <text x="220" y="60" textAnchor="middle" className="fill-muted-foreground text-[10px]">Спальня</text>
                <text x="55" y="165" textAnchor="middle" className="fill-muted-foreground text-[10px]">Кухня</text>
                <text x="150" y="165" textAnchor="middle" className="fill-muted-foreground text-[10px]">С/У</text>
                <text x="245" y="165" textAnchor="middle" className="fill-muted-foreground text-[10px]">Спальня</text>
              </svg>
            )}
          </div>
        )}

        <div className="absolute bottom-3 right-3 flex gap-2">
          <button
            onClick={() => { setHeroMode('photo'); setGalleryOpen(true); }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors backdrop-blur-sm ${
              heroMode === 'photo' ? 'bg-card text-foreground shadow-md' : 'bg-card/60 text-foreground/70'
            }`}
          >
            {photos.length} фото
          </button>
          <button
            onClick={() => setHeroMode(heroMode === 'plan' ? 'photo' : 'plan')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors backdrop-blur-sm ${
              heroMode === 'plan' ? 'bg-card text-foreground shadow-md' : 'bg-card/60 text-foreground/70'
            }`}
          >
            Планировка
          </button>
        </div>
      </div>

      <div className="px-4 space-y-5 pt-5">
        {/* 2. Price + Address + Characteristics */}
        <div className="space-y-1.5">
          <p className="text-[1.65rem] font-bold text-foreground tabular-nums tracking-tight leading-none">
            {safePrice ? formatPrice(safePrice) : 'Цена по запросу'}
          </p>
          {(property.residential_complex || property.district) && (
            <p className="text-sm text-muted-foreground">
              Астана, {property.residential_complex || property.district}
              {property.address ? `, ${property.address}` : ''}
              {property.house_number ? ` ${property.house_number}` : ''}
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            {property.rooms} комнаты · {property.area} м² · {property.floor} этаж из {property.total_floors}
          </p>
        </div>

        {/* 3. Trust/Service pills (accordion) */}
        <div className="flex flex-col gap-2">
          <TrustLabel
            text="Проверенная квартира"
            icon="shield"
            content="Проверяем объект перед публикацией, а перед покупкой помогаем проверить документы и обременения."
            isOpen={openPill === 'verified'}
            onToggle={() => setOpenPill(openPill === 'verified' ? null : 'verified')}
          />
          <TrustLabel
            text="Помощь CASA в покупке"
            icon="briefcase"
            content={[
              'Мы поможем:',
              '— оценить шансы на ипотеку',
              '— подобрать подходящую ипотечную программу',
              '— проверить документы по квартире',
              '— оформить задаток',
              '— пройти покупку до получения ключей',
            ]}
            isOpen={openPill === 'help'}
            onToggle={() => setOpenPill(openPill === 'help' ? null : 'help')}
          />
        </div>

        {/* 4. CTA */}
        <button
          onClick={() => navigate(`/property/${property.id}/request`)}
          className="casa-btn-primary"
        >
          Записаться на просмотр
        </button>

        {/* 5. How to view */}
        <div className="space-y-3">
          <h3 className="text-base font-bold text-foreground">Как посмотреть квартиру</h3>
          <div className="space-y-3">
            {steps.map((s) => (
              <div key={s.n} className="flex gap-3 items-start">
                <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center text-xs font-bold text-foreground shrink-0 mt-0.5">
                  {s.n}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground leading-snug">{s.title}</p>
                  <p className="text-xs text-muted-foreground">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 6. Key advantages (chips) — only if any exist */}
        {advantages.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <h3 className="text-sm font-semibold text-secondary">Что важно по квартире</h3>
            <div className="flex flex-wrap gap-1.5">
              {advantages.map((adv) => (
                <span
                  key={adv}
                  className="inline-flex items-center px-3 py-1.5 rounded-lg bg-accent text-foreground/80 text-xs font-medium"
                >
                  {adv}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Description (if exists) */}
        {property.description && (
          <div className="space-y-2">
            <h3 className="text-base font-bold text-foreground">Описание</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{property.description}</p>
          </div>
        )}

        {/* 7. About the apartment (facts table) */}
        {facts.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-base font-bold text-foreground">О квартире</h3>
            <div className="casa-card p-4 space-y-0">
              {facts.map((f, i) => (
                <div key={f.label} className={`flex justify-between items-center py-2.5 ${i < facts.length - 1 ? 'border-b border-border/60' : ''}`}>
                  <span className="text-sm text-muted-foreground">{f.label}</span>
                  <span className="text-sm font-medium text-foreground">{f.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {galleryOpen && (
        <PhotoGallery images={photos} onClose={() => setGalleryOpen(false)} />
      )}
    </motion.div>
  );
};

export default PropertyDetail;
