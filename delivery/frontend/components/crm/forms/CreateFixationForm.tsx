'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api-client';
import { toast } from 'sonner';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { PriceInput } from '@/components/ui/price-input';

interface CreateFixationFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  apartmentId: string;
  apartmentNumber: string;
  apartmentPrice: string;
  onSuccess: (fixationId: string) => void;
}

const PAYMENT_METHODS = [
  { value: 'FULL', label: '100%' },
  { value: 'MORTGAGE', label: 'Ипотека' },
  { value: 'INSTALLMENT', label: 'Рассрочка' },
] as const;

function stripPhone(phone: string) {
  return phone.replace(/\D/g, '');
}

export function CreateFixationForm({
  open,
  onOpenChange,
  projectId,
  projectName,
  apartmentId,
  apartmentNumber,
  apartmentPrice,
  onSuccess,
}: CreateFixationFormProps) {
  const queryClient = useQueryClient();
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [phone, setPhone] = useState('+7');
  const [paymentMethod, setPaymentMethod] = useState<(typeof PAYMENT_METHODS)[number]['value']>('FULL');
  const [dealAmount, setDealAmount] = useState(apartmentPrice);

  const mutation = useMutation({
    mutationFn: async () => {
      // 1. Найти или создать клиента по телефону
      const searchRes = await api.get('/clients', { params: { search: phone, limit: 50 } });
      const normalized = stripPhone(phone);
      const existing = searchRes.data.clients.find((c: any) => stripPhone(c.phone) === normalized);

      let clientId: string;
      if (existing) {
        clientId = existing.id;
      } else {
        const created = await api.post('/clients', {
          firstName,
          lastName,
          phone,
          clientType: 'NEW_BUILDING',
        });
        clientId = created.data.id;
      }

      // 2. Создать фиксацию (DRAFT)
      const fixationRes = await api.post('/fixations', {
        clientId,
        projectId,
        apartmentId,
        paymentMethod,
        dealAmount: Number(dealAmount),
      });
      const fixationId = fixationRes.data.id as string;

      // 3. Отправить (DRAFT -> SENT), затем сразу пройти автоматическую проверку (SENT -> DUPLICATE_CHECK) —
      // в MVP это мгновенный пропуск, реальную проверку дублей не строим (см. спеку).
      await api.patch(`/fixations/${fixationId}/status`, { status: 'SENT' });
      await api.patch(`/fixations/${fixationId}/status`, { status: 'DUPLICATE_CHECK' });

      return fixationId;
    },
    onSuccess: (fixationId) => {
      toast.success('Фиксация отправлена');
      queryClient.invalidateQueries({ queryKey: ['apartments'] });
      onOpenChange(false);
      onSuccess(fixationId);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Ошибка создания фиксации');
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!lastName.trim() || !firstName.trim() || !phone.trim() || !dealAmount) return;
    mutation.mutate();
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Фиксировать клиента</SheetTitle>
          <SheetDescription>{projectName} · №{apartmentNumber}</SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label>Фамилия</Label>
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Имя</Label>
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Телефон</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} required />
            <p className="text-xs text-muted-foreground">Если телефон уже есть в базе — привяжем существующего клиента.</p>
          </div>

          <div className="space-y-2">
            <Label>Способ оплаты</Label>
            <div className="flex gap-2">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setPaymentMethod(m.value)}
                  className={`flex-1 rounded-md border p-2 text-sm ${
                    paymentMethod === m.value ? 'border-primary bg-primary/10 font-medium text-primary' : ''
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Сумма ДДУ (₸)</Label>
            <PriceInput value={dealAmount} onChange={setDealAmount} />
          </div>

          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending ? 'Отправка...' : 'Создать и отправить фиксацию'}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
