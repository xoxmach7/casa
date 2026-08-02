import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, Loader2 } from 'lucide-react';
import CasaHeader from '@/components/CasaHeader';
import { formatPrice } from '@/components/PropertyCard';
import { usePublicProperty } from '@/hooks/useProperties';
import { useCreateLead } from '@/hooks/useLeads';
import { toast } from 'sonner';
import { parsePhoneRaw } from '@/lib/formatters';
import PhoneInput, { validatePhone } from '@/components/PhoneInput';

const ViewingRequest = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: property, isLoading: loadingProperty } = usePublicProperty(id);
  const createLead = useCreateLead();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  if (loadingProperty) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!property) return null;

  const heroPhoto = property.photo_urls && property.photo_urls.length > 0
    ? property.photo_urls[0]
    : '/placeholder.svg';

  const handleSubmit = async () => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'Введите имя';
    const phoneErr = validatePhone(phone);
    if (phoneErr) newErrors.phone = phoneErr;
    if (Object.keys(newErrors).length) {
      setErrors(newErrors);
      return;
    }

    setSubmitting(true);
    try {
      await createLead.mutateAsync({
        buyer_name: name.trim(),
        buyer_phone: parsePhoneRaw(phone),
        property_id: property.id,
        status: 'new',
      });
      setSubmitted(true);
    } catch (err) {
      console.error('Lead creation error:', err);
      toast.error('Ошибка при отправке. Попробуйте ещё раз.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background">
        <CasaHeader variant="form" />
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.35, ease: [0.2, 0, 0, 1] }}
          className="px-4 pt-20 text-center space-y-4"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
          >
            <CheckCircle className="w-14 h-14 mx-auto text-casa-success" />
          </motion.div>
          <h1 className="text-xl font-bold text-foreground">Заявка отправлена</h1>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-[260px] mx-auto">
            CASA свяжется с вами, чтобы согласовать удобное время просмотра
          </p>
          <button
            onClick={() => navigate(`/property/${id}`)}
            className="casa-btn-primary mt-6"
          >
            Вернуться к квартире
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <CasaHeader variant="form" title="Заявка на просмотр" />

      <div className="px-4 space-y-5 pt-3">
        <div className="flex items-center gap-3 p-3 casa-card">
          <img
            src={heroPhoto || '/placeholder.svg'}
            alt=""
            className="w-14 h-14 rounded-xl object-cover shrink-0"
          />
          <div>
            <p className="text-sm font-bold text-foreground tabular-nums">{formatPrice(property.price ?? 0)}</p>
            <p className="text-xs text-muted-foreground">{property.district}, {property.address}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Имя</label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setErrors(prev => ({ ...prev, name: '' })); }}
              placeholder="Ваше имя"
              className="casa-input"
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Номер телефона</label>
            <PhoneInput
              value={phone}
              onChange={(v) => { setPhone(v); setErrors(prev => ({ ...prev, phone: '' })); }}
              error={errors.phone}
            />
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center leading-relaxed">
          Без звонков. CASA сама согласует удобное время.
        </p>

        <button onClick={handleSubmit} className="casa-btn-primary" disabled={submitting}>
          {submitting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Записаться на просмотр'}
        </button>
      </div>
    </div>
  );
};

export default ViewingRequest;
