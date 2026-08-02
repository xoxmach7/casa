import { useState, useRef } from 'react';
import DocChecklist from '@/components/DocChecklist';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Phone, MessageCircle, ChevronRight, ArrowRight, ImageIcon, Pencil, Check, Clock, Banknote, Upload, CheckCircle2, Loader2, Archive, ArchiveRestore, Plus } from 'lucide-react';
import AdminPropertyMap from '@/components/AdminPropertyMap';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import StatusBadge from '@/components/StatusBadge';
import { formatPrice } from '@/components/PropertyCard';
import { districts, layoutOptions, renovationOptions, balconyOptions, buildingTypes, bathroomOptions, layoutFromDb, layoutToDb, bathroomFromDb, bathroomToDb } from '@/data/constants';
import { useProperty, useUpdateProperty, mapPropertyStatus } from '@/hooks/useProperties';
import { useLeadsByProperty, mapLeadStatus, useUpdateLead } from '@/hooks/useLeads';
import { uploadFloorPlanAdmin as uploadFloorPlan, uploadPaymentReceipt, uploadPropertyPhotoAdmin as uploadPropertyPhoto } from '@/hooks/useStorage';
import { toast } from 'sonner';
import type { DbProperty } from '@/hooks/useProperties';

// Normalize numeric fields before saving
const NUMERIC_FIELDS = ['price', 'area', 'rooms', 'floor', 'total_floors', 'year_built', 'ceiling_height'];

function normalizeFormForSave(raw: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (NUMERIC_FIELDS.includes(key)) {
      const cleaned = String(value ?? '').replace(/[\s₸,]/g, '');
      if (cleaned === '') {
        out[key] = null;
      } else {
        const num = Number(cleaned);
        if (!Number.isFinite(num) || num < 0) continue; // skip invalid
        out[key] = num;
      }
    } else if (typeof value === 'string') {
      out[key] = value.trim() === '' ? null : value.trim();
    } else {
      out[key] = value;
    }
  }
  return out;
}

const AdminPropertySectionTitle = ({ children, count }: { children: React.ReactNode; count?: number }) => (
  <div className="flex items-center gap-2 px-0.5">
    <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{children}</h3>
    {count !== undefined && (
      <span className="text-[10px] text-muted-foreground/60 tabular-nums">{count}</span>
    )}
  </div>
);

const AdminEditableText = ({
  label,
  value,
  editing,
  onChange,
  suffix,
  inputMode,
}: {
  label: string;
  value: string | number | boolean | null | undefined;
  editing: boolean;
  onChange: (value: string) => void;
  suffix?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
}) => {
  if (!editing && (value === undefined || value === null)) return null;
  const display = typeof value === 'boolean' ? (value ? 'Да' : 'Нет') : String(value ?? '');

  return (
    <div className="flex justify-between items-center py-2 border-b border-border/30 last:border-0 gap-3">
      <span className="text-[11px] text-muted-foreground shrink-0">{label}</span>
      {editing ? (
        <input
          value={String(value ?? '')}
          inputMode={inputMode}
          onChange={e => onChange(e.target.value)}
          className="text-[13px] font-medium text-foreground text-right bg-transparent outline-none border-b border-primary/20 focus:border-primary/50 transition-colors min-w-0 flex-1 max-w-[60%]"
        />
      ) : (
        <span className="text-[13px] font-medium text-foreground">{display}{suffix || ''}</span>
      )}
    </div>
  );
};

const AdminEditableSelect = ({
  label,
  value,
  editing,
  onChange,
  options,
  dbToUi,
  uiToDb,
}: {
  label: string;
  value: string | null | undefined;
  editing: boolean;
  onChange: (value: string) => void;
  options: string[];
  dbToUi?: Record<string, string>;
  uiToDb?: Record<string, string>;
}) => {
  const displayVal = dbToUi && value ? (dbToUi[value] || value) : value;
  if (!editing && (value === undefined || value === null)) return null;

  return (
    <div className="flex justify-between items-center py-2 border-b border-border/30 last:border-0 gap-3">
      <span className="text-[11px] text-muted-foreground shrink-0">{label}</span>
      {editing ? (
        <select
          value={displayVal ?? ''}
          onChange={e => {
            const uiVal = e.target.value;
            onChange(uiToDb && uiVal ? (uiToDb[uiVal] || uiVal) : uiVal);
          }}
          className="text-[13px] font-medium text-foreground text-right bg-transparent outline-none border-b border-primary/20 focus:border-primary/50 transition-colors min-w-0 appearance-none cursor-pointer"
        >
          <option value="">—</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <span className="text-[13px] font-medium text-foreground">{String(displayVal)}</span>
      )}
    </div>
  );
};

const AdminEditableBool = ({
  label,
  value,
  editing,
  onChange,
}: {
  label: string;
  value: boolean;
  editing: boolean;
  onChange: (value: boolean) => void;
}) => (
  <div className="flex justify-between items-center py-2 border-b border-border/30 last:border-0">
    <span className="text-[11px] text-muted-foreground">{label}</span>
    {editing ? (
      <button
        onClick={() => onChange(!value)}
        className={`text-[13px] font-medium transition-colors ${value ? 'text-foreground' : 'text-muted-foreground/40'}`}
      >
        {value ? 'Да' : 'Нет'}
      </button>
    ) : (
      <span className="text-[13px] font-medium text-foreground">{value ? 'Да' : 'Нет'}</span>
    )}
  </div>
);

const AdminObjectCard = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: property, isLoading } = useProperty(id);
  const { data: leads = [] } = useLeadsByProperty(id);
  const updateProperty = useUpdateProperty();
  const updateLead = useUpdateLead();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [viewingTimes, setViewingTimes] = useState<Record<string, Date>>(() => {
    const initial: Record<string, Date> = {};
    leads.forEach(l => {
      if (l.viewing_datetime) initial[l.id] = new Date(l.viewing_datetime);
    });
    return initial;
  });

  type BuyerFinancing = {
    method: 'Наличные' | 'Ипотека';
    bank?: 'Отбасы банк' | 'Другие БВУ';
    preApproved?: boolean;
    preApprovalAmount?: string;
  };
  const [financing, setFinancing] = useState<Record<string, BuyerFinancing>>({});

  const [showPayment, setShowPayment] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('200 000');
  const [paymentReceipt, setPaymentReceipt] = useState<File | null>(null);
  const [paymentComment, setPaymentComment] = useState('');
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [uploadingFloorPlan, setUploadingFloorPlan] = useState(false);
  const [replacingPhotoIndex, setReplacingPhotoIndex] = useState<number | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const replacePhotoInputRef = useRef<HTMLInputElement>(null);
  const floorPlanInputRef = useRef<HTMLInputElement>(null);

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
        <p className="text-muted-foreground text-sm">Квартира не найдена</p>
      </div>
    );
  }

  const uiStatus = mapPropertyStatus(property.status);
  const isSelectableLead = (property.status === 'published' || property.status === 'showing' || property.status === 'in_deal') && leads.length > 0;

  const dealLead = property.status === 'in_deal' ? leads.find(l => l.status === 'in_deal') : null;
  const effectiveSelectedId = property.status === 'in_deal' && !selectedLeadId && dealLead ? dealLead.id : selectedLeadId;

  const getNextStep = (): string => {
    if (property.is_archived) return 'Восстановить';
    if (property.status === 'new') return 'Опубликовать';
    if (property.status === 'published') {
      if (effectiveSelectedId) return 'Показ подтверждён';
      return 'Ждёт заявок';
    }
    if (property.status === 'showing') {
      if (effectiveSelectedId) return 'В сделку';
      return 'Выберите заявку';
    }
    if (property.status === 'in_deal') return 'Оплата';
    return 'Опубликовать';
  };

  const nextStep = getNextStep();
  const ctaDisabled = !property.is_archived && (property.status === 'published' || property.status === 'showing') && !effectiveSelectedId;

  const val = (key: string): any =>
    editing && key in form ? form[key] : (property as any)[key];

  const set = (key: string, value: any) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const toggleEdit = async () => {
    if (editing) {
      if (Object.keys(form).length > 0) {
        const payload = normalizeFormForSave(form);
        if (Object.keys(payload).length > 0) {
          try {
            await updateProperty.mutateAsync({ id: property.id, ...payload });
            toast.success('Сохранено');
          } catch (err) {
            console.error(err);
            toast.error('Ошибка сохранения');
          }
        }
      }
      setEditing(false);
      setForm({});
    } else {
      setForm({});
      setEditing(true);
    }
  };

  const handleCTA = async () => {
    if (property.is_archived) {
      // Restore from archive
      try {
        await updateProperty.mutateAsync({ id: property.id, is_archived: false });
        toast.success('Восстановлено из архива');
      } catch (err) {
        toast.error('Ошибка');
      }
      return;
    }

    if (property.status === 'new') {
      try {
        await updateProperty.mutateAsync({ id: property.id, status: 'published' });
        toast.success('Опубликовано');
      } catch (err) {
        toast.error('Ошибка');
      }
    } else if (property.status === 'published' && effectiveSelectedId) {
      try {
        await updateProperty.mutateAsync({ id: property.id, status: 'showing', selected_lead_id: effectiveSelectedId });
        await updateLead.mutateAsync({ id: effectiveSelectedId, status: 'showing' });
        toast.success('Показ подтверждён');
      } catch (err) {
        toast.error('Ошибка');
      }
    } else if (property.status === 'showing' && effectiveSelectedId) {
      try {
        await updateProperty.mutateAsync({ id: property.id, status: 'in_deal', selected_lead_id: effectiveSelectedId });
        await updateLead.mutateAsync({ id: effectiveSelectedId, status: 'in_deal' });
        toast.success('Переведено в сделку');
      } catch (err) {
        toast.error('Ошибка');
      }
    } else if (property.status === 'in_deal') {
      setShowPayment(true);
    }
  };

  const handleArchive = async () => {
    try {
      await updateProperty.mutateAsync({ id: property.id, is_archived: true });
      toast.success('Отправлено в архив');
      navigate('/admin/objects');
    } catch (err) {
      toast.error('Ошибка');
    }
  };

  const handlePaymentConfirm = async () => {
    try {
      let receiptUrl: string | null = null;
      if (paymentReceipt) {
        receiptUrl = await uploadPaymentReceipt(property.id, paymentReceipt);
      }
      await updateProperty.mutateAsync({
        id: property.id,
        payment_status: 'paid',
        payment_amount: Number(paymentAmount.replace(/\s/g, '')),
        payment_comment: paymentComment || null,
        payment_receipt_url: receiptUrl,
      });
      setPaymentConfirmed(true);
      setShowPayment(false);
      toast.success('Оплата подтверждена');
    } catch (err) {
      console.error(err);
      toast.error('Ошибка подтверждения оплаты');
    }
  };

  const handlePhotoUpload = async (files: FileList) => {
    if (!files.length) return;
    setUploadingPhotos(true);
    try {
      const currentUrls = [...(property.photo_urls || [])];
      const uploadPromises = Array.from(files).map(file => uploadPropertyPhoto(property.id, file));
      const newUrls = await Promise.all(uploadPromises);
      const allUrls = [...currentUrls, ...newUrls];
      await updateProperty.mutateAsync({ id: property.id, photo_urls: allUrls });
      toast.success(`${newUrls.length} фото загружено`);
    } catch (err) {
      console.error(err);
      toast.error('Ошибка загрузки фото');
    } finally {
      setUploadingPhotos(false);
    }
  };

  const handlePhotoReplace = async (index: number, file: File) => {
    try {
      const nextUrl = await uploadPropertyPhoto(property.id, file);
      const nextPhotos = [...(property.photo_urls || [])];
      nextPhotos[index] = nextUrl;
      await updateProperty.mutateAsync({ id: property.id, photo_urls: nextPhotos });
      toast.success('Фото заменено');
    } catch (err) {
      console.error(err);
      toast.error('Ошибка замены фото');
    } finally {
      setReplacingPhotoIndex(null);
    }
  };

  const handleFloorPlanUpload = async (file: File) => {
    setUploadingFloorPlan(true);
    try {
      const nextFloorPlanUrl = await uploadFloorPlan(property.id, file);
      await updateProperty.mutateAsync({ id: property.id, floor_plan_url: nextFloorPlanUrl });
      toast.success(property.floor_plan_url ? 'Планировка обновлена' : 'Планировка загружена');
    } catch (err) {
      console.error(err);
      toast.error('Ошибка загрузки планировки');
    } finally {
      setUploadingFloorPlan(false);
    }
  };

  const handleChecklistChange = async (checklist: Record<string, boolean>) => {
    try {
      await updateProperty.mutateAsync({ id: property.id, verification_checklist: checklist as any });
    } catch (err) {
      console.error(err);
      toast.error('Ошибка сохранения чеклиста');
    }
  };

  const photos = property.photo_urls || [];
  const checklistValue = (property.verification_checklist && typeof property.verification_checklist === 'object' && !Array.isArray(property.verification_checklist))
    ? property.verification_checklist as Record<string, boolean>
    : {};
  const checklistReadOnly = property.status !== 'new';

  return (
    <div className="min-h-screen bg-background pb-36">
      <header className="sticky top-0 z-50 flex items-center gap-3 h-13 px-4 bg-background/95 backdrop-blur-sm border-b border-border">
        <button onClick={() => navigate('/admin/objects')} className="p-1 -ml-1 active:scale-90 transition-transform">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-foreground truncate">
            {property.is_archived && <span className="text-muted-foreground">[Архив] </span>}
            {property.district}, {property.address} {property.house_number}
          </p>
        </div>
        {!property.is_archived && (
          <button
            onClick={toggleEdit}
            className={`p-1.5 rounded-lg transition-all active:scale-90 ${editing ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {editing ? <Check className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
          </button>
        )}
      </header>

      <div className="px-4 pt-4 space-y-4">
        {/* Hero Summary */}
        <div className="casa-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <StatusBadge status={uiStatus as any} />
            {property.is_archived && (
              <span className="text-[10px] font-medium text-muted-foreground bg-accent px-2 py-0.5 rounded-md">Архив</span>
            )}
            {val('negotiable') && !property.is_archived && (
              <span className="text-[10px] font-medium text-muted-foreground/70">Торг возможен</span>
            )}
          </div>
          <div>
            {editing ? (
              <input
                value={String(val('price') ?? '')}
                onChange={e => set('price', e.target.value)}
                className="text-2xl font-bold text-primary tabular-nums tracking-tight bg-transparent outline-none border-b border-primary/20 focus:border-primary/50 w-full"
                placeholder="Цена"
              />
            ) : (
              <p className="text-2xl font-bold text-primary tabular-nums tracking-tight">{formatPrice(val('price') ?? 0)}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">{val('rooms')} комн. · {val('area')} м² · {val('floor')}/{val('total_floors')} эт.</p>
          </div>
        </div>

        {/* Заявки */}
        <div className="space-y-1.5">
          <AdminPropertySectionTitle count={leads.length}>Заявки</AdminPropertySectionTitle>
          {leads.length === 0 ? (
            <div className="casa-card py-8 text-center">
              <p className="text-[11px] text-muted-foreground/30">
                {property.status === 'published' ? 'Ждёт заявок' : 'Нет заявок'}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {leads.map(lead => {
                const isSelected = effectiveSelectedId === lead.id;
                const isActiveLead = (property.status === 'showing' && lead.status === 'showing') || (property.status === 'in_deal' && lead.status === 'in_deal');
                return (
                  <div
                    key={lead.id}
                    className={`casa-card w-full p-3 text-left transition-all ${
                      isSelected ? 'ring-1 ring-primary bg-primary/5' : ''
                    } ${isActiveLead ? 'border-l-2 border-l-primary' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => {
                          if (isSelectableLead) {
                            setSelectedLeadId(isSelected ? null : lead.id);
                          }
                        }}
                        className={`flex-1 min-w-0 text-left ${isSelectableLead ? 'active:scale-[0.99] cursor-pointer' : ''}`}
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <p className="text-[13px] font-medium text-foreground">{lead.buyer_name}</p>
                            <StatusBadge status={mapLeadStatus(lead.status) as any} />
                            {isSelected && (
                              <span className="text-[10px] font-medium text-primary">✓ Выбран</span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground">{lead.buyer_phone}</p>
                        </div>
                      </button>
                      {isSelectableLead ? (
                        <div className={`w-4 h-4 rounded-full border shrink-0 flex items-center justify-center transition-colors ${
                          isSelected ? 'bg-primary border-primary' : 'border-muted-foreground/30'
                        }`}>
                          {isSelected && (
                            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-primary-foreground">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </div>
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground/30 shrink-0" />
                      )}
                    </div>

                    {/* Время показа */}
                    <div className="mt-2 pt-2 border-t border-border/30">
                      <Popover>
                        <PopoverTrigger asChild>
                          <button className={`flex items-center gap-1.5 text-[11px] active:opacity-70 transition-all ${
                            viewingTimes[lead.id]
                              ? 'font-medium text-primary'
                              : 'text-muted-foreground/50 hover:text-muted-foreground'
                          }`}>
                            <Clock className="w-3 h-3" />
                            {viewingTimes[lead.id]
                              ? `Показ: ${format(viewingTimes[lead.id], 'd MMM, HH:mm', { locale: ru })}`
                              : 'Назначить время показа'}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={viewingTimes[lead.id]}
                            onSelect={(date) => {
                              if (date) {
                                const prev = viewingTimes[lead.id];
                                if (prev) {
                                  date.setHours(prev.getHours(), prev.getMinutes());
                                }
                                setViewingTimes(p => ({ ...p, [lead.id]: new Date(date) }));
                                updateLead.mutate({ id: lead.id, viewing_datetime: date.toISOString() });
                              }
                            }}
                            initialFocus
                            className={cn("p-3 pointer-events-auto")}
                          />
                          <div className="px-4 pb-3 pt-1 border-t border-border/30">
                            <label className="text-[11px] text-muted-foreground block mb-1.5">Время</label>
                            <div className="flex items-center gap-1.5">
                              <select
                                value={viewingTimes[lead.id] ? viewingTimes[lead.id].getHours() : 10}
                                onChange={(e) => {
                                  const h = Number(e.target.value);
                                  const d = viewingTimes[lead.id] ? new Date(viewingTimes[lead.id]) : new Date();
                                  d.setHours(h);
                                  setViewingTimes(p => ({ ...p, [lead.id]: d }));
                                  updateLead.mutate({ id: lead.id, viewing_datetime: d.toISOString() });
                                }}
                                className="text-[13px] font-medium text-foreground bg-accent rounded-md px-2 py-1.5 outline-none appearance-none cursor-pointer text-center"
                              >
                                {Array.from({ length: 14 }, (_, i) => i + 8).map(h => (
                                  <option key={h} value={h}>{String(h).padStart(2, '0')}</option>
                                ))}
                              </select>
                              <span className="text-[13px] text-muted-foreground font-medium">:</span>
                              <select
                                value={viewingTimes[lead.id] ? viewingTimes[lead.id].getMinutes() : 0}
                                onChange={(e) => {
                                  const m = Number(e.target.value);
                                  const d = viewingTimes[lead.id] ? new Date(viewingTimes[lead.id]) : new Date();
                                  d.setMinutes(m);
                                  setViewingTimes(p => ({ ...p, [lead.id]: d }));
                                  updateLead.mutate({ id: lead.id, viewing_datetime: d.toISOString() });
                                }}
                                className="text-[13px] font-medium text-foreground bg-accent rounded-md px-2 py-1.5 outline-none appearance-none cursor-pointer text-center"
                              >
                                {[0, 15, 30, 45].map(m => (
                                  <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* Финансирование покупателя */}
                    {isSelected && (
                      <div className="mt-2 pt-2 border-t border-border/30 space-y-2">
                        <div className="flex items-center gap-1.5">
                          <Banknote className="w-3 h-3 text-muted-foreground/60" />
                          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Финансирование</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {(['Наличные', 'Ипотека'] as const).map(m => {
                            const fin = financing[lead.id];
                            const active = fin?.method === m;
                            return (
                              <button
                                key={m}
                                onClick={() => {
                                  setFinancing(p => ({
                                    ...p,
                                    [lead.id]: { method: m, ...(m === 'Ипотека' ? { bank: undefined, preApproved: undefined, preApprovalAmount: '' } : {}) }
                                  }));
                                  updateLead.mutate({
                                    id: lead.id,
                                    financing_type: m,
                                    financing_bank: null,
                                    pre_approved: null,
                                    mortgage_amount: null,
                                  });
                                }}
                                className={`text-[11px] px-2.5 py-1 rounded-md border transition-all ${
                                  active
                                    ? 'bg-primary/10 border-primary/30 text-primary font-medium'
                                    : 'border-border/50 text-muted-foreground hover:border-border'
                                }`}
                              >
                                {m}
                              </button>
                            );
                          })}
                        </div>

                        {financing[lead.id]?.method === 'Ипотека' && (
                          <div className="space-y-2 pl-0.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] text-muted-foreground shrink-0">Банк</span>
                              <div className="flex gap-1">
                                {(['Отбасы банк', 'Другие БВУ'] as const).map(b => {
                                  const active = financing[lead.id]?.bank === b;
                                  return (
                                    <button
                                      key={b}
                                      onClick={() => {
                                        setFinancing(p => ({
                                          ...p,
                                          [lead.id]: { ...p[lead.id], bank: b }
                                        }));
                                        updateLead.mutate({ id: lead.id, financing_bank: b });
                                      }}
                                      className={`text-[11px] px-2 py-0.5 rounded-md border transition-all ${
                                        active
                                          ? 'bg-primary/10 border-primary/30 text-primary font-medium'
                                          : 'border-border/50 text-muted-foreground hover:border-border'
                                      }`}
                                    >
                                      {b}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] text-muted-foreground shrink-0">Предодобрение</span>
                              <div className="flex gap-1">
                                {[true, false].map(v => {
                                  const active = financing[lead.id]?.preApproved === v;
                                  return (
                                    <button
                                      key={String(v)}
                                      onClick={() => {
                                        setFinancing(p => ({
                                          ...p,
                                          [lead.id]: { ...p[lead.id], preApproved: v }
                                        }));
                                        updateLead.mutate({ id: lead.id, pre_approved: v });
                                      }}
                                      className={`text-[11px] px-2 py-0.5 rounded-md border transition-all ${
                                        active
                                          ? 'bg-primary/10 border-primary/30 text-primary font-medium'
                                          : 'border-border/50 text-muted-foreground hover:border-border'
                                      }`}
                                    >
                                      {v ? 'Да' : 'Нет'}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {financing[lead.id]?.preApproved && (
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[11px] text-muted-foreground shrink-0">Сумма</span>
                                <input
                                  value={financing[lead.id]?.preApprovalAmount ?? ''}
                                  onChange={e => {
                                    setFinancing(p => ({
                                      ...p,
                                      [lead.id]: { ...p[lead.id], preApprovalAmount: e.target.value }
                                    }));
                                    const amount = Number(e.target.value.replace(/\s/g, ''));
                                    if (!isNaN(amount)) {
                                      updateLead.mutate({ id: lead.id, mortgage_amount: amount });
                                    }
                                  }}
                                  placeholder="₸"
                                  className="text-[11px] font-medium text-foreground text-right bg-transparent outline-none border-b border-primary/20 focus:border-primary/50 transition-colors w-28"
                                />
                              </div>
                            )}

                            {financing[lead.id]?.bank && (
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[11px] text-muted-foreground shrink-0">Ожидаемый срок</span>
                                <span className="text-[11px] font-medium text-foreground">
                                  {financing[lead.id]?.bank === 'Отбасы банк' ? 'до 3 недель' : 'до 3 дней'}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {isSelectableLead && !effectiveSelectedId && (
            <p className="text-[10px] text-primary/60 px-0.5">Выберите заявку для подтверждения показа</p>
          )}
        </div>

        {/* Продавец */}
        <div className="space-y-1.5">
          <AdminPropertySectionTitle>Продавец</AdminPropertySectionTitle>
          <div className="casa-card px-4 py-1">
            <AdminEditableText label="Имя" value={val('seller_name')} editing={editing} onChange={value => set('seller_name', value)} />
            <AdminEditableText label="Телефон" value={val('seller_phone')} editing={editing} onChange={value => set('seller_phone', value)} inputMode="tel" />
            <AdminEditableBool label="Собственник" value={Boolean(val('owner_flag'))} editing={editing} onChange={value => set('owner_flag', value)} />
            <AdminEditableText label="Удобное время" value={val('best_contact_time')} editing={editing} onChange={value => set('best_contact_time', value)} />
          </div>
          {!editing && (
            <div className="flex gap-1.5 px-0.5 pt-1">
              <a href={`tel:${property.seller_phone}`} className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center active:scale-90 transition-transform">
                <Phone className="w-4 h-4 text-primary" />
              </a>
              {property.seller_whatsapp && (
                <a href={`https://wa.me/${property.seller_whatsapp.replace(/\D/g, '')}`} className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center active:scale-90 transition-transform">
                  <MessageCircle className="w-4 h-4 text-muted-foreground" />
                </a>
              )}
            </div>
          )}
        </div>

        {/* Document Checklist */}
        <DocChecklist
          value={checklistValue}
          onChange={handleChecklistChange}
          readOnly={checklistReadOnly}
        />

        {/* Основное */}
        <div className="space-y-1.5">
          <AdminPropertySectionTitle>Основное</AdminPropertySectionTitle>
          <div className="casa-card px-4 py-1">
            <AdminEditableSelect label="Район" value={val('district')} editing={editing} onChange={value => set('district', value)} options={districts} />
            <AdminEditableText label="Адрес" value={val('address')} editing={editing} onChange={value => set('address', value)} />
            <AdminEditableText label="Номер дома" value={val('house_number')} editing={editing} onChange={value => set('house_number', value)} />
            <AdminEditableText label="ЖК" value={val('residential_complex')} editing={editing} onChange={value => set('residential_complex', value)} />
            <AdminEditableText label="Цена" value={val('price')} editing={editing} onChange={value => set('price', value)} inputMode="numeric" />
            <AdminEditableBool label="Торг возможен" value={Boolean(val('negotiable'))} editing={editing} onChange={value => set('negotiable', value)} />
            <AdminEditableBool label="Можно заселиться сразу" value={Boolean(val('ready_to_move_in'))} editing={editing} onChange={value => set('ready_to_move_in', value)} />
            <AdminEditableBool label="С мебелью" value={Boolean(val('has_furniture'))} editing={editing} onChange={value => set('has_furniture', value)} />
            <AdminEditableBool label="С техникой" value={Boolean(val('has_appliances'))} editing={editing} onChange={value => set('has_appliances', value)} />
          </div>
        </div>

        {/* Карта */}
        <div className="space-y-1.5">
          <AdminPropertySectionTitle>Расположение</AdminPropertySectionTitle>
          <AdminPropertyMap
            lat={val('lat')}
            lng={val('lng')}
            onCoordinateChange={(lat, lng) => {
              set('lat', lat);
              set('lng', lng);
              updateProperty.mutate({ id: property.id, lat, lng } as any);
            }}
          />
        </div>

        {/* Характеристики */}
        <div className="space-y-1.5">
          <AdminPropertySectionTitle>Характеристики квартиры</AdminPropertySectionTitle>
          <div className="casa-card px-4 py-1">
            <AdminEditableText label="Комнаты" value={val('rooms')} editing={editing} onChange={value => set('rooms', value)} inputMode="numeric" />
            <AdminEditableText label="Площадь" value={val('area')} editing={editing} onChange={value => set('area', value)} suffix=" м²" inputMode="decimal" />
            <AdminEditableSelect label="Планировка" value={val('layout')} editing={editing} onChange={value => set('layout', value)} options={layoutOptions} dbToUi={layoutFromDb} uiToDb={layoutToDb} />
            <AdminEditableSelect label="Санузлы" value={val('bathroom_type')} editing={editing} onChange={value => set('bathroom_type', value)} options={bathroomOptions} dbToUi={bathroomFromDb} uiToDb={bathroomToDb} />
            <AdminEditableSelect label="Ремонт" value={val('renovation_condition')} editing={editing} onChange={value => set('renovation_condition', value)} options={renovationOptions} />
            <AdminEditableText label="Этаж" value={val('floor')} editing={editing} onChange={value => set('floor', value)} inputMode="numeric" />
            <AdminEditableText label="Этажность дома" value={val('total_floors')} editing={editing} onChange={value => set('total_floors', value)} inputMode="numeric" />
            <AdminEditableSelect label="Тип дома" value={val('building_type')} editing={editing} onChange={value => set('building_type', value)} options={buildingTypes} />
            <AdminEditableText label="Год постройки" value={val('year_built')} editing={editing} onChange={value => set('year_built', value)} inputMode="numeric" />
            <AdminEditableText label="Потолки" value={val('ceiling_height')} editing={editing} onChange={value => set('ceiling_height', value)} suffix=" м" inputMode="decimal" />
          </div>
        </div>

        {/* Фото */}
        <div className="space-y-1.5">
          <AdminPropertySectionTitle count={photos.length}>Фото и планировка</AdminPropertySectionTitle>
          <div className="space-y-2">
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
              {photos.map((src, i) => (
                <div key={`${src}-${i}`} className="w-20 shrink-0 space-y-1">
                  <div className="w-20 h-16 rounded-lg bg-accent shrink-0 flex items-center justify-center overflow-hidden">
                    {src ? (
                      <img src={src} alt={`Фото ${i + 1}`} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[10px] text-muted-foreground/50">{i + 1}</span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <a href={src} download target="_blank" rel="noreferrer" className="text-[10px] text-primary text-center">Скачать</a>
                    <button onClick={() => { setReplacingPhotoIndex(i); replacePhotoInputRef.current?.click(); }} className="text-[10px] text-muted-foreground">Заменить</button>
                  </div>
                </div>
              ))}
              <div className="w-20 shrink-0 space-y-1">
                <button
                  onClick={() => photoInputRef.current?.click()}
                  disabled={uploadingPhotos}
                  className="w-20 h-16 rounded-lg border border-dashed border-border/50 shrink-0 flex flex-col items-center justify-center gap-0.5 hover:border-primary/30 transition-colors active:scale-95"
                >
                  {uploadingPhotos ? (
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground/50" />
                  ) : (
                    <>
                      <Plus className="w-4 h-4 text-muted-foreground/40" />
                      <span className="text-[9px] text-muted-foreground/40">Фото</span>
                    </>
                  )}
                </button>
                <span className="block text-[10px] text-muted-foreground text-center">Добавить</span>
              </div>
              <div className="w-20 shrink-0 space-y-1">
                <button
                  onClick={() => floorPlanInputRef.current?.click()}
                  disabled={uploadingFloorPlan}
                  className="w-20 h-16 rounded-lg border border-dashed border-border/50 bg-accent/40 shrink-0 flex flex-col items-center justify-center gap-0.5 hover:border-primary/30 transition-colors active:scale-95"
                >
                  {uploadingFloorPlan ? (
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground/50" />
                  ) : (
                    <>
                      <ImageIcon className="w-4 h-4 text-muted-foreground/50" />
                      <span className="text-[9px] text-muted-foreground/50">План</span>
                    </>
                  )}
                </button>
                {property.floor_plan_url ? (
                  <>
                    <a href={property.floor_plan_url} download target="_blank" rel="noreferrer" className="block text-[10px] text-primary text-center">Скачать</a>
                    <button onClick={() => floorPlanInputRef.current?.click()} className="block w-full text-[10px] text-muted-foreground text-center">Заменить</button>
                  </>
                ) : (
                  <span className="block text-[10px] text-muted-foreground text-center">Загрузить</span>
                )}
              </div>
            </div>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={e => {
                if (e.target.files) handlePhotoUpload(e.target.files);
                e.target.value = '';
              }}
            />
            <input
              ref={replacePhotoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file != null && replacingPhotoIndex != null) handlePhotoReplace(replacingPhotoIndex, file);
                e.target.value = '';
              }}
            />
            <input
              ref={floorPlanInputRef}
              type="file"
              accept="image/*,.pdf"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) handleFloorPlanUpload(file);
                e.target.value = '';
              }}
            />
          </div>
          {!property.floor_plan_url && (
            <p className="text-[10px] text-muted-foreground/30 px-0.5">Планировка не загружена</p>
          )}
        </div>

        {/* Описание */}
        {(property.description || editing) && (
          <div className="space-y-1.5">
            <AdminPropertySectionTitle>Описание</AdminPropertySectionTitle>
            <div className="casa-card px-4 py-3">
              {editing ? (
                <textarea
                  value={String(val('description') ?? '')}
                  onChange={e => set('description', e.target.value)}
                  rows={3}
                  className="w-full text-[12px] text-foreground leading-relaxed bg-transparent outline-none border-b border-primary/20 focus:border-primary/50 transition-colors resize-none"
                />
              ) : (
                <p className="text-[12px] text-muted-foreground leading-relaxed">{property.description}</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Payment panel */}
      {showPayment && property.status === 'in_deal' && !paymentConfirmed && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 backdrop-blur-sm" onClick={() => setShowPayment(false)}>
          <div className="w-full max-w-lg bg-background rounded-t-2xl p-5 space-y-4 animate-in slide-in-from-bottom-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-[13px] font-semibold text-foreground">Подтверждение оплаты</h3>
              <button onClick={() => setShowPayment(false)} className="text-muted-foreground/50 text-[18px] leading-none">&times;</button>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">Сумма оплаты</label>
              <div className="flex items-center gap-1">
                <input
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(e.target.value)}
                  className="flex-1 text-[13px] font-medium text-foreground bg-accent/50 rounded-lg px-3 py-2 outline-none border border-border/30 focus:border-primary/40 transition-colors"
                />
                <span className="text-[13px] text-muted-foreground shrink-0">₸</span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">Чек об оплате</label>
              <label className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-dashed border-border/50 bg-accent/30 cursor-pointer hover:border-primary/30 transition-colors">
                <Upload className="w-4 h-4 text-muted-foreground/50" />
                <span className="text-[12px] text-muted-foreground/70 flex-1 truncate">
                  {paymentReceipt ? paymentReceipt.name : 'Загрузить фото или файл'}
                </span>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) setPaymentReceipt(file);
                  }}
                />
              </label>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">Комментарий <span className="text-muted-foreground/40">(необязательно)</span></label>
              <input
                value={paymentComment}
                onChange={e => setPaymentComment(e.target.value)}
                placeholder="Например: оплата через Kaspi"
                className="w-full text-[12px] text-foreground bg-accent/50 rounded-lg px-3 py-2 outline-none border border-border/30 focus:border-primary/40 transition-colors placeholder:text-muted-foreground/30"
              />
            </div>

            <button
              onClick={handlePaymentConfirm}
              className="casa-btn-primary flex items-center justify-center gap-2 w-full"
            >
              <CheckCircle2 className="w-4 h-4" />
              Подтвердить оплату
            </button>
          </div>
        </div>
      )}

      {/* Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 pb-5 bg-background/95 backdrop-blur-sm casa-sticky-bar safe-area-bottom">
        {paymentConfirmed && property.status === 'in_deal' ? (
          <div className="flex items-center justify-center gap-2 py-3">
            <CheckCircle2 className="w-5 h-5 text-primary" />
            <span className="text-[13px] font-semibold text-primary">Оплата подтверждена</span>
          </div>
        ) : property.is_archived ? (
          <button
            onClick={handleCTA}
            className="casa-btn-primary flex items-center justify-center gap-2"
          >
            <ArchiveRestore className="w-4 h-4" />
            Восстановить из архива
          </button>
        ) : (
          <>
            <button
              disabled={ctaDisabled}
              onClick={handleCTA}
              className={`casa-btn-primary flex items-center justify-center gap-2 ${ctaDisabled ? 'opacity-40 pointer-events-none' : ''}`}
            >
              {nextStep}
              <ArrowRight className="w-4 h-4" />
            </button>
            <div className="flex mt-2.5 justify-center">
              <button
                onClick={handleArchive}
                className="text-[11px] font-medium text-muted-foreground/30 hover:text-muted-foreground/50 active:scale-95 transition-all flex items-center gap-1"
              >
                <Archive className="w-3 h-3" />
                В архив
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AdminObjectCard;
