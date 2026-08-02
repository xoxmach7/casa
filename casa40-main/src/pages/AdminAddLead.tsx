import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Loader2 } from 'lucide-react';
import { useAllProperties, mapPropertyStatus } from '@/hooks/useProperties';
import { useCreateLeadAdmin } from '@/hooks/useLeads';
import { formatPrice } from '@/components/PropertyCard';
import { toast } from 'sonner';
import { parsePhoneRaw } from '@/lib/formatters';
import PhoneInput, { validatePhone } from '@/components/PhoneInput';

type AdminLeadForm = {
  buyerName: string;
  buyerPhone: string;
  propertyId: string;
  comment: string;
};

const LeadTextField = ({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) => (
  <div className="flex justify-between items-center py-2.5 border-b border-border/30 gap-3">
    <span className="text-[11px] text-muted-foreground shrink-0">{label}</span>
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="text-[13px] font-medium text-foreground text-right bg-transparent outline-none border-b border-primary/20 focus:border-primary/50 transition-colors min-w-0 flex-1 max-w-[60%] placeholder:text-muted-foreground/30"
    />
  </div>
);

const AdminAddLead = () => {
  const navigate = useNavigate();
  const { data: properties = [] } = useAllProperties();
  const createLead = useCreateLeadAdmin();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<AdminLeadForm>({
    buyerName: '',
    buyerPhone: '',
    propertyId: '',
    comment: '',
  });

  const set = <K extends keyof AdminLeadForm>(key: K, value: AdminLeadForm[K]) => setForm(p => ({ ...p, [key]: value }));

  // Only show published / showing properties as targets
  const availableProperties = properties.filter(p => p.status === 'published' || p.status === 'showing');

  const canSubmit = form.buyerName && form.buyerPhone && !validatePhone(form.buyerPhone) && form.propertyId;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await createLead.mutateAsync({
        buyer_name: form.buyerName,
        buyer_phone: parsePhoneRaw(form.buyerPhone),
        property_id: form.propertyId,
        comment: form.comment || null,
        status: 'new',
      });
      toast.success('Заявка создана');
      navigate('/admin/leads');
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
        <button onClick={() => navigate('/admin/leads')} className="p-1 -ml-1 active:scale-90 transition-transform">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <h1 className="text-[15px] font-bold text-foreground tracking-tight">Новая заявка</h1>
      </header>

      <div className="px-4 pt-4 space-y-4">
        <div className="space-y-1.5">
          <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-0.5">Покупатель</h3>
          <div className="casa-card px-4 py-1">
            <LeadTextField label="Имя" value={form.buyerName} onChange={value => set('buyerName', value)} placeholder="Айдана" />
            <div className="py-2.5 border-b border-border/30 gap-3">
              <span className="text-[11px] text-muted-foreground">Телефон</span>
              <PhoneInput
                value={form.buyerPhone}
                onChange={value => set('buyerPhone', value)}
                className="text-[13px] font-medium text-foreground text-right bg-transparent outline-none border-b border-primary/20 focus:border-primary/50 transition-colors w-full mt-1"
                placeholder="+7 (7XX) XXX-XX-XX"
              />
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-0.5">Квартира</h3>
          <div className="space-y-1">
            {availableProperties.map(p => {
              const selected = form.propertyId === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => set('propertyId', p.id)}
                  className={`casa-card w-full p-3 flex items-center gap-3 text-left transition-all active:scale-[0.99] ${
                    selected ? 'ring-1 ring-primary bg-primary/5' : ''
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-foreground truncate">{p.district}, {p.address} {p.house_number}</p>
                    <p className="text-[11px] text-muted-foreground">{p.rooms} комн. · {p.area} м² · {formatPrice(p.price ?? 0)}</p>
                  </div>
                  <div className={`w-4 h-4 rounded-full border shrink-0 flex items-center justify-center transition-colors ${
                    selected ? 'bg-primary border-primary' : 'border-muted-foreground/30'
                  }`}>
                    {selected && (
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-primary-foreground">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                </button>
              );
            })}
            {availableProperties.length === 0 && (
              <p className="text-[11px] text-muted-foreground/50 text-center py-6">Нет доступных квартир</p>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-0.5">Комментарий <span className="text-muted-foreground/40 normal-case">(необязательно)</span></h3>
          <div className="casa-card px-4 py-3">
            <textarea
              value={form.comment}
              onChange={e => set('comment', e.target.value)}
              rows={2}
              placeholder="Дополнительная информация"
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
          Создать заявку
        </button>
      </div>
    </div>
  );
};

export default AdminAddLead;
