import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CasaHeader from '@/components/CasaHeader';
import { districts, roomOptions, buildingTypes, layoutOptions, renovationOptions, balconyOptions, bathroomOptions, layoutToDb, bathroomToDb } from '@/data/constants';
import { Camera, ImagePlus, Loader2 } from 'lucide-react';
import { useCreateProperty } from '@/hooks/useProperties';
import { formatPriceDisplay, parsePriceRaw, parsePhoneRaw, sanitizeHouseNumber } from '@/lib/formatters';
import PhoneInput, { validatePhone } from '@/components/PhoneInput';
import { uploadFloorPlan, uploadPropertyPhoto } from '@/hooks/useStorage';
import { toast } from 'sonner';

const totalSteps = 4;

type SellerListingForm = Record<string, any>;

const Toggle = ({ value, onChange }: { value: boolean; onChange: () => void }) => (
  <button
    onClick={onChange}
    className={`relative w-11 h-[26px] rounded-full transition-colors duration-200 ${value ? 'bg-primary' : 'bg-border'}`}
  >
    <div className={`absolute top-[3px] w-5 h-5 bg-card rounded-full shadow-sm transition-transform duration-200 ${value ? 'left-[23px]' : 'left-[3px]'}`} />
  </button>
);

const ListingField = ({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <label className="text-sm font-medium text-foreground">{label}</label>
    {children}
    {error && <p className="text-xs text-destructive">{error}</p>}
  </div>
);

const ToggleRow = ({ label, value, onChange }: { label: string; value: boolean; onChange: () => void }) => (
  <div className="flex items-center justify-between py-3 border-b border-border/40 last:border-0">
    <span className="text-sm text-foreground">{label}</span>
    <Toggle value={value} onChange={onChange} />
  </div>
);

const AddListing = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<SellerListingForm>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploadedPhotos, setUploadedPhotos] = useState<{ url: string; path: string }[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [floorPlanFile, setFloorPlanFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const createProperty = useCreateProperty();

  const update = (key: string, value: any) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setErrors(prev => ({ ...prev, [key]: '' }));
  };

  const validateStep = () => {
    const e: Record<string, string> = {};
    if (step === 1) {
      if (!form.district) e.district = 'Обязательное поле';
      if (!String(form.address || '').trim()) e.address = 'Обязательное поле';
      const price = Number(form.price);
      if (!form.price || !Number.isFinite(price) || price <= 0) e.price = 'Введите корректную цену';
    }
    if (step === 2) {
      if (!form.rooms) e.rooms = 'Обязательное поле';
      const area = Number(form.area);
      if (!form.area || !Number.isFinite(area) || area <= 0) e.area = 'Введите корректное значение';
      const floor = Number(form.floor);
      if (!form.floor || !Number.isFinite(floor) || floor <= 0) e.floor = 'Введите корректное значение';
      const totalFloors = Number(form.totalFloors);
      if (!form.totalFloors || !Number.isFinite(totalFloors) || totalFloors <= 0) e.totalFloors = 'Введите корректное значение';
      if (!form.buildingType) e.buildingType = 'Обязательное поле';
    }
    if (step === 3) {
      if (uploadedPhotos.length === 0) e.photos = 'Добавьте хотя бы 1 фото';
    }
    if (step === 4) {
      if (!String(form.sellerName || '').trim()) e.sellerName = 'Обязательное поле';
      const phoneErr = validatePhone(form.sellerPhoneDisplay || '');
      if (phoneErr) e.sellerPhone = phoneErr;
      if (!form.agreement) e.agreement = 'Необходимо согласие';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  /** Return a positive number or null */
  const toPositiveNum = (val: any): number | null => {
    if (val === '' || val === undefined || val === null) return null;
    const n = Number(val);
    if (!Number.isFinite(n) || n <= 0) return null;
    return n;
  };

  /** Return a trimmed non-empty string or null */
  const toText = (val: any): string | null => {
    if (val === undefined || val === null) return null;
    const s = String(val).trim();
    return s.length > 0 ? s : null;
  };

  const handleSubmit = async () => {
    if (!validateStep()) return;
    setSubmitting(true);

    try {
      // Photos already uploaded — collect URLs
      const photoUrls = uploadedPhotos.map(p => p.url);

      // Upload floor plan if provided
      let floorPlanUrl: string | null = null;
      if (floorPlanFile) {
        floorPlanUrl = await uploadFloorPlan('', floorPlanFile);
      }

      // Build payload field-by-field with strict normalization
      const payload = {
        // Required text fields
        seller_name: String(form.sellerName || '').trim(),
        seller_phone: String(form.sellerPhone || '').trim(),

        // Optional text fields
        seller_whatsapp: form.whatsapp ? String(form.sellerPhone || '').trim() : null,
        district: toText(form.district),
        address: toText(form.address),
        house_number: toText(form.houseNumber),
        residential_complex: toText(form.residentialComplex),
        building_type: toText(form.buildingType),
        layout: form.layout ? (layoutToDb[form.layout] || toText(form.layout)) : null,
        renovation_condition: toText(form.renovation),
        bathroom_type: form.bathroomType ? (bathroomToDb[form.bathroomType] || toText(form.bathroomType)) : null,
        best_contact_time: toText(form.contactTime),

        // Positive numeric fields
        price: toPositiveNum(form.price),
        rooms: toPositiveNum(form.rooms),
        area: toPositiveNum(form.area),
        floor: toPositiveNum(form.floor),
        total_floors: toPositiveNum(form.totalFloors),
        year_built: toPositiveNum(form.yearBuilt),
        ceiling_height: toPositiveNum(form.ceilingHeight),

        // Boolean fields
        negotiable: form.negotiable || false,
        ready_to_move_in: form.readyToMoveIn || false,
        has_furniture: form.hasFurniture || false,
        has_appliances: form.hasAppliances || false,
        owner_flag: form.owner || false,
        balcony: form.balcony ? form.balcony !== 'Нет' : false,

        // Arrays / URLs
        photo_urls: photoUrls,
        floor_plan_url: floorPlanUrl,

        // Fixed status
        status: 'new' as const,

        // Explicit nulls required by RLS policy (DB defaults would violate it)
        payment_status: null,
        verification_checklist: null,
        payment_amount: null,
        payment_receipt_url: null,
        payment_comment: null,
        selected_lead_id: null,
      };

      await createProperty.mutateAsync(payload);
      navigate('/sell/success');
    } catch (err: any) {
      console.error('Submit error:', err);
      toast.error('Ошибка при отправке. Попробуйте ещё раз.');
    } finally {
      setSubmitting(false);
    }
  };

  const next = () => {
    if (!validateStep()) return;
    if (step < totalSteps) setStep(step + 1);
    else handleSubmit();
  };

  const back = () => {
    if (step > 1) setStep(step - 1);
    else navigate('/sell');
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    e.target.value = '';

    setUploadingPhotos(true);
    setErrors(prev => ({ ...prev, photos: '' }));

    for (const file of Array.from(files)) {
      try {
        const url = await uploadPropertyPhoto('', file);
        setUploadedPhotos(prev => [...prev, { url, path: url }]);
      } catch (err) {
        console.error('Photo upload error:', err);
        toast.error(`Ошибка загрузки: ${file.name}`);
      }
    }
    setUploadingPhotos(false);
  };

  const handleFloorPlanSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setFloorPlanFile(file);
    e.target.value = '';
  };

  return (
    <div className="min-h-screen bg-background">
      <CasaHeader variant="form" title="Добавить квартиру" onBack={back} />

      {/* Progress */}
      <div className="px-4 pt-1 pb-5">
        <div className="flex gap-1.5">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i < step ? 'bg-primary' : 'bg-border'}`}
            />
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-2">Шаг {step} из {totalSteps}</p>
      </div>

      <div className="px-4 space-y-4 pb-8">
        {step === 1 && (
          <>
            <ListingField label="Район" error={errors.district}>
              <select value={form.district || ''} onChange={e => update('district', e.target.value)} className="casa-select">
                <option value="">Выберите район</option>
                {districts.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </ListingField>
            <ListingField label="ЖК" error={errors.residentialComplex}>
              <input value={form.residentialComplex || ''} onChange={e => update('residentialComplex', e.target.value)} placeholder="Название ЖК" className="casa-input" />
            </ListingField>
            <ListingField label="Адрес" error={errors.address}>
              <input value={form.address || ''} onChange={e => update('address', e.target.value)} placeholder="Улица" className="casa-input" />
            </ListingField>
            <ListingField label="Номер дома" error={errors.houseNumber}>
              <input value={form.houseNumber || ''} onChange={e => update('houseNumber', sanitizeHouseNumber(e.target.value))} placeholder="Номер дома" className="casa-input" />
            </ListingField>

            <div className="casa-card p-4 space-y-2">
              <label className="text-sm font-bold text-foreground">Цена продажи</label>
              <div className="relative">
                 <input
                   type="text"
                   inputMode="numeric"
                   value={form.priceDisplay || ''}
                   onChange={e => {
                     const display = formatPriceDisplay(e.target.value);
                     update('priceDisplay', display);
                     setForm(prev => ({ ...prev, price: parsePriceRaw(e.target.value) }));
                   }}
                   placeholder="0"
                   className="casa-input text-xl font-bold tabular-nums h-14 pr-10"
                 />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">₸</span>
              </div>
              {errors.price && <p className="text-xs text-destructive">{errors.price}</p>}
            </div>

            <div className="casa-card px-4">
              <ToggleRow label="Торг возможен" value={form.negotiable || false} onChange={() => update('negotiable', !form.negotiable)} />
              <ToggleRow label="Можно заселиться сразу" value={form.readyToMoveIn || false} onChange={() => update('readyToMoveIn', !form.readyToMoveIn)} />
              <ToggleRow label="С мебелью" value={form.hasFurniture || false} onChange={() => update('hasFurniture', !form.hasFurniture)} />
              <ToggleRow label="С техникой" value={form.hasAppliances || false} onChange={() => update('hasAppliances', !form.hasAppliances)} />
            </div>
          </>
        )}

        {step === 2 && (
          <div className="space-y-3.5">
            <div className="grid grid-cols-2 gap-3">
              <ListingField label="Комнаты" error={errors.rooms}>
                <select value={form.rooms || ''} onChange={e => update('rooms', e.target.value)} className="casa-select">
                  <option value="">—</option>
                  {roomOptions.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </ListingField>
              <ListingField label="Площадь, м²" error={errors.area}>
                <input type="text" inputMode="decimal" value={form.area || ''} onChange={e => update('area', e.target.value)} placeholder="0" className="casa-input tabular-nums" />
              </ListingField>
            </div>
            <ListingField label="Планировка" error={errors.layout}>
              <select value={form.layout || ''} onChange={e => update('layout', e.target.value)} className="casa-select">
                <option value="">Выберите</option>
                {layoutOptions.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </ListingField>
            <ListingField label="Состояние ремонта" error={errors.renovation}>
              <select value={form.renovation || ''} onChange={e => update('renovation', e.target.value)} className="casa-select">
                <option value="">Выберите</option>
                {renovationOptions.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </ListingField>
            <div className="grid grid-cols-2 gap-3">
              <ListingField label="Этаж" error={errors.floor}>
                <input type="text" inputMode="numeric" value={form.floor || ''} onChange={e => update('floor', e.target.value)} placeholder="0" className="casa-input tabular-nums" />
              </ListingField>
              <ListingField label="Этажность дома" error={errors.totalFloors}>
                <input type="text" inputMode="numeric" value={form.totalFloors || ''} onChange={e => update('totalFloors', e.target.value)} placeholder="0" className="casa-input tabular-nums" />
              </ListingField>
            </div>
            <ListingField label="Тип дома" error={errors.buildingType}>
              <select value={form.buildingType || ''} onChange={e => update('buildingType', e.target.value)} className="casa-select">
                <option value="">Выберите</option>
                {buildingTypes.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </ListingField>
            <div className="grid grid-cols-2 gap-3">
              <ListingField label="Год постройки" error={errors.yearBuilt}>
                <input type="text" inputMode="numeric" value={form.yearBuilt || ''} onChange={e => update('yearBuilt', e.target.value)} placeholder="2020" className="casa-input tabular-nums" />
              </ListingField>
              <ListingField label="Потолки, м" error={errors.ceilingHeight}>
                <input type="text" inputMode="decimal" value={form.ceilingHeight || ''} onChange={e => update('ceilingHeight', e.target.value)} placeholder="2.7" className="casa-input tabular-nums" />
              </ListingField>
            </div>
            <ListingField label="Балкон / лоджия" error={errors.balcony}>
              <select value={form.balcony || ''} onChange={e => update('balcony', e.target.value)} className="casa-select">
                <option value="">Выберите</option>
                {balconyOptions.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </ListingField>
            <ListingField label="Санузлы" error={errors.bathroomType}>
              <select value={form.bathroomType || ''} onChange={e => update('bathroomType', e.target.value)} className="casa-select">
                <option value="">Выберите</option>
                {bathroomOptions.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </ListingField>
          </div>
        )}

        {step === 3 && (
          <>
            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Фото квартиры</p>
                <p className="text-xs text-muted-foreground mt-1">Минимум 1 фото. Рекомендуем 5–12.</p>
              </div>
              <label className={`w-full h-32 border-2 border-dashed border-primary/20 bg-accent/40 rounded-2xl flex flex-col items-center justify-center gap-2 text-primary hover:bg-accent transition-colors cursor-pointer ${uploadingPhotos ? 'pointer-events-none opacity-60' : ''}`}>
                {uploadingPhotos ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span className="text-sm font-medium">Загрузка...</span>
                  </>
                ) : (
                  <>
                    <Camera className="w-6 h-6" />
                    <span className="text-sm font-medium">Добавить фото</span>
                  </>
                )}
                <input type="file" accept="image/*" multiple onChange={handlePhotoSelect} className="hidden" disabled={uploadingPhotos} />
              </label>
              {uploadedPhotos.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {uploadedPhotos.map((photo, i) => (
                    <div key={photo.path} className="w-18 h-18 bg-accent rounded-xl flex items-center justify-center relative border border-border/50 overflow-hidden">
                      <img src={photo.url} alt="" className="w-full h-full object-cover" />
                      <button
                        onClick={() => {
                          // No delete endpoint on the anonymous public upload
                          // API by design (see public-uploads.routes.ts) —
                          // removing from the form is enough; the orphaned
                          // file is an acceptable minor storage cost.
                          setUploadedPhotos(prev => prev.filter((_, j) => j !== i));
                        }}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-destructive text-destructive-foreground rounded-full text-xs flex items-center justify-center shadow-sm"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {errors.photos && <p className="text-xs text-destructive">{errors.photos}</p>}
            </div>
            <div className="space-y-2 pt-2">
              <p className="text-sm font-medium text-foreground">Планировка <span className="text-muted-foreground font-normal">(необязательно)</span></p>
              <label className="w-full h-12 border border-dashed border-border rounded-xl text-sm text-muted-foreground hover:bg-accent transition-colors flex items-center justify-center gap-2 cursor-pointer">
                <ImagePlus className="w-4 h-4" />
                {floorPlanFile ? floorPlanFile.name : 'Добавить планировку'}
                <input type="file" accept="image/*" onChange={handleFloorPlanSelect} className="hidden" />
              </label>
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <ListingField label="Имя" error={errors.sellerName}>
              <input value={form.sellerName || ''} onChange={e => update('sellerName', e.target.value)} placeholder="Ваше имя" className="casa-input" />
            </ListingField>
            <ListingField label="Телефон" error={errors.sellerPhone}>
              <PhoneInput
                value={form.sellerPhoneDisplay || ''}
                onChange={v => {
                  update('sellerPhoneDisplay', v);
                  setForm(prev => ({ ...prev, sellerPhone: parsePhoneRaw(v) }));
                }}
              />
            </ListingField>
            <div className="casa-card px-4">
              <ToggleRow label="WhatsApp на этом номере" value={form.whatsapp || false} onChange={() => update('whatsapp', !form.whatsapp)} />
              <ToggleRow label="Вы собственник" value={form.owner || false} onChange={() => update('owner', !form.owner)} />
            </div>
            <ListingField label="Удобное время для связи" error={errors.contactTime}>
              <input value={form.contactTime || ''} onChange={e => update('contactTime', e.target.value)} placeholder="с 10:00 до 18:00" className="casa-input" />
            </ListingField>

            <div className="casa-card p-4 space-y-2">
              <p className="text-xs font-bold text-foreground">Как работает CASA</p>
              <div className="space-y-1 text-xs text-muted-foreground">
                <p>• Принимает обращения от покупателей</p>
                <p>• Записывает на просмотры</p>
                <p>• Сопровождает сделку</p>
                <p>• Вы только показываете квартиру</p>
              </div>
              <div className="border-t border-border/40 pt-2.5 mt-2.5">
                <p className="text-xs font-bold text-foreground">Стоимость: 200 000 ₸ за покупателя</p>
              </div>
            </div>

            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={form.agreement || false}
                onChange={e => update('agreement', e.target.checked)}
                className="w-5 h-5 mt-0.5 rounded border-2 border-border bg-card text-primary accent-primary cursor-pointer shrink-0"
              />
              <span className="text-xs text-muted-foreground leading-relaxed">
                Я согласен с условиями сервиса CASA и стоимостью услуги
              </span>
            </label>
            {errors.agreement && <p className="text-xs text-destructive">{errors.agreement}</p>}
          </>
        )}

        <div className="flex gap-3 pt-3">
          {step > 1 && (
            <button onClick={back} className="casa-btn-secondary flex-1" disabled={submitting}>
              Назад
            </button>
          )}
          <button onClick={next} className="casa-btn-primary flex-1" disabled={submitting}>
            {submitting ? (
              <Loader2 className="w-5 h-5 animate-spin mx-auto" />
            ) : step === totalSteps ? 'Отправить квартиру' : 'Продолжить'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddListing;
