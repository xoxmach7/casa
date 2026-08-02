import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Loader2 } from 'lucide-react';
import { districts, buildingTypes, layoutOptions, renovationOptions, balconyOptions, bathroomOptions, layoutToDb, bathroomToDb } from '@/data/constants';
import { useCreateProperty } from '@/hooks/useProperties';
import { toast } from 'sonner';
import { formatPriceDisplay, parsePriceRaw, parsePhoneRaw, sanitizeHouseNumber } from '@/lib/formatters';
import PhoneInput from '@/components/PhoneInput';

type AdminObjectForm = {
  district: string;
  address: string;
  houseNumber: string;
  residentialComplex: string;
  rooms: string;
  area: string;
  floor: string;
  totalFloors: string;
  price: string;
  priceDisplay: string;
  buildingType: string;
  layout: string;
  renovationCondition: string;
  balcony: string;
  bathroomType: string;
  yearBuilt: string;
  ceilingHeight: string;
  sellerName: string;
  sellerPhone: string;
  sellerPhoneDisplay: string;
  description: string;
};

const AdminObjectField = ({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
}) => (
  <div className="flex justify-between items-center py-2.5 border-b border-border/30 last:border-0 gap-3">
    <span className="text-[11px] text-muted-foreground shrink-0">{label}</span>
    <input
      type={type}
      inputMode={inputMode}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder || '—'}
      className="text-[13px] font-medium text-foreground text-right bg-transparent outline-none border-b border-primary/20 focus:border-primary/50 transition-colors min-w-0 flex-1 max-w-[60%] placeholder:text-muted-foreground/30"
    />
  </div>
);

const AdminObjectSelectField = ({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) => (
  <div className="flex justify-between items-center py-2.5 border-b border-border/30 last:border-0 gap-3">
    <span className="text-[11px] text-muted-foreground shrink-0">{label}</span>
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="text-[13px] font-medium text-foreground text-right bg-transparent outline-none border-b border-primary/20 focus:border-primary/50 transition-colors min-w-0 appearance-none cursor-pointer"
    >
      <option value="">—</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  </div>
);

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-0.5">{children}</h3>
);

const AdminAddObject = () => {
  const navigate = useNavigate();
  const createProperty = useCreateProperty();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<AdminObjectForm>({
    district: '',
    address: '',
    houseNumber: '',
    residentialComplex: '',
    rooms: '',
    area: '',
    floor: '',
    totalFloors: '',
    price: '',
    priceDisplay: '',
    buildingType: '',
    layout: '',
    renovationCondition: '',
    balcony: '',
    bathroomType: '',
    yearBuilt: '',
    ceilingHeight: '',
    sellerName: '',
    sellerPhone: '',
    sellerPhoneDisplay: '',
    description: '',
  });

  const set = <K extends keyof AdminObjectForm>(key: K, value: AdminObjectForm[K]) => setForm(p => ({ ...p, [key]: value }));

  const canSubmit = form.district && form.address && form.rooms && form.area && form.price && form.sellerName && form.sellerPhone;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await createProperty.mutateAsync({
        seller_name: form.sellerName,
        seller_phone: form.sellerPhone,
        district: form.district,
        address: form.address,
        house_number: form.houseNumber || null,
        residential_complex: form.residentialComplex || null,
        price: Number(form.price),
        rooms: Number(form.rooms),
        area: Number(form.area),
        floor: form.floor ? Number(form.floor) : null,
        total_floors: form.totalFloors ? Number(form.totalFloors) : null,
        building_type: form.buildingType || null,
        layout: form.layout ? (layoutToDb[form.layout] || form.layout) : null,
        renovation_condition: form.renovationCondition || null,
        bathroom_type: form.bathroomType ? (bathroomToDb[form.bathroomType] || form.bathroomType) : null,
        balcony: form.balcony ? form.balcony !== 'Нет' : false,
        year_built: form.yearBuilt ? Number(form.yearBuilt) : null,
        ceiling_height: form.ceilingHeight ? Number(form.ceilingHeight) : null,
        description: form.description || null,
        status: 'new',
      });
      toast.success('Квартира создана');
      navigate('/admin/objects');
    } catch (err) {
      console.error(err);
      toast.error('Ошибка при создании');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-28">
      <header className="sticky top-0 z-50 flex items-center gap-3 h-13 px-4 bg-background/95 backdrop-blur-sm border-b border-border">
        <button onClick={() => navigate('/admin/objects')} className="p-1 -ml-1 active:scale-90 transition-transform">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <h1 className="text-[15px] font-bold text-foreground tracking-tight">Новая квартира</h1>
      </header>

      <div className="px-4 pt-4 space-y-4">
        <div className="space-y-1.5">
          <SectionTitle>Адрес</SectionTitle>
          <div className="casa-card px-4 py-1">
              <AdminObjectSelectField label="Район" value={form.district} onChange={value => set('district', value)} options={districts} />
              <AdminObjectField label="Адрес" value={form.address} onChange={value => set('address', value)} placeholder="ул. Сауран" />
              <AdminObjectField label="Дом" value={form.houseNumber} onChange={value => set('houseNumber', sanitizeHouseNumber(value))} placeholder="18" />
              <AdminObjectField label="ЖК" value={form.residentialComplex} onChange={value => set('residentialComplex', value)} placeholder="Название ЖК" />
          </div>
        </div>

        <div className="space-y-1.5">
          <SectionTitle>Основное</SectionTitle>
          <div className="casa-card px-4 py-1">
              <AdminObjectField label="Цена ₸" value={form.priceDisplay || ''} onChange={value => {
                const display = formatPriceDisplay(value);
                setForm(p => ({ ...p, priceDisplay: display, price: parsePriceRaw(value) }));
              }} placeholder="42 000 000" inputMode="numeric" />
              <AdminObjectField label="Комнаты" value={form.rooms} onChange={value => set('rooms', value)} placeholder="3" inputMode="numeric" />
              <AdminObjectField label="Площадь м²" value={form.area} onChange={value => set('area', value)} placeholder="95" inputMode="decimal" />
              <AdminObjectField label="Этаж" value={form.floor} onChange={value => set('floor', value)} placeholder="7" inputMode="numeric" />
              <AdminObjectField label="Этажность" value={form.totalFloors} onChange={value => set('totalFloors', value)} placeholder="16" inputMode="numeric" />
          </div>
        </div>

        <div className="space-y-1.5">
          <SectionTitle>Характеристики</SectionTitle>
          <div className="casa-card px-4 py-1">
              <AdminObjectSelectField label="Тип дома" value={form.buildingType} onChange={value => set('buildingType', value)} options={buildingTypes} />
              <AdminObjectSelectField label="Планировка" value={form.layout} onChange={value => set('layout', value)} options={layoutOptions} />
              <AdminObjectSelectField label="Ремонт" value={form.renovationCondition} onChange={value => set('renovationCondition', value)} options={renovationOptions} />
              <AdminObjectSelectField label="Балкон" value={form.balcony} onChange={value => set('balcony', value)} options={balconyOptions} />
              <AdminObjectSelectField label="Санузлы" value={form.bathroomType} onChange={value => set('bathroomType', value)} options={bathroomOptions} />
              <AdminObjectField label="Год постройки" value={form.yearBuilt} onChange={value => set('yearBuilt', value)} placeholder="2020" inputMode="numeric" />
              <AdminObjectField label="Потолки м" value={form.ceilingHeight} onChange={value => set('ceilingHeight', value)} placeholder="2.8" inputMode="decimal" />
          </div>
        </div>

        <div className="space-y-1.5">
          <SectionTitle>Продавец</SectionTitle>
          <div className="casa-card px-4 py-1">
              <AdminObjectField label="Имя" value={form.sellerName} onChange={value => set('sellerName', value)} placeholder="Алексей" />
              <div className="flex justify-between items-center py-2.5 border-b border-border/30 gap-3">
                <span className="text-[11px] text-muted-foreground shrink-0">Телефон</span>
                <PhoneInput
                  value={form.sellerPhoneDisplay || ''}
                  onChange={value => setForm(p => ({ ...p, sellerPhoneDisplay: value, sellerPhone: parsePhoneRaw(value) }))}
                  className="text-[13px] font-medium text-foreground text-right bg-transparent outline-none border-b border-primary/20 focus:border-primary/50 transition-colors min-w-0 flex-1 max-w-[60%]"
                  placeholder="+7 (7XX) XXX-XX-XX"
                />
              </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <SectionTitle>Описание</SectionTitle>
          <div className="casa-card px-4 py-3">
            <textarea
              value={form.description}
                onChange={e => set('description', e.target.value)}
              rows={3}
              placeholder="Краткое описание квартиры"
              className="w-full text-[12px] text-foreground leading-relaxed bg-transparent outline-none resize-none placeholder:text-muted-foreground/30"
            />
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 pb-5 bg-background/95 backdrop-blur-sm casa-sticky-bar safe-area-bottom">
        <button
          disabled={!canSubmit || submitting}
          onClick={handleSubmit}
          className={`casa-btn-primary flex items-center justify-center gap-2 ${!canSubmit ? 'opacity-40 pointer-events-none' : ''}`}
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Создать квартиру
        </button>
      </div>
    </div>
  );
};

export default AdminAddObject;
