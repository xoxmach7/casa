import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';

export interface DbLead {
  id: string;
  property_id: string;
  buyer_name: string;
  buyer_phone: string;
  status: string;
  comment: string | null;
  financing_type: string | null;
  financing_bank: string | null;
  pre_approved: boolean | null;
  mortgage_amount: number | null;
  expected_timeline: string | null;
  viewing_datetime: string | null;
  created_at: string;
  updated_at: string;
}

function adaptLead(raw: any): DbLead {
  return {
    id: raw.id,
    property_id: raw.propertyId,
    buyer_name: raw.buyerName,
    buyer_phone: raw.buyerPhone,
    status: raw.status ?? 'new',
    comment: raw.comment ?? null,
    financing_type: raw.financingType ?? null,
    financing_bank: raw.financingBank ?? null,
    pre_approved: raw.preApproved ?? null,
    mortgage_amount: raw.mortgageAmount != null ? Number(raw.mortgageAmount) : null,
    expected_timeline: raw.expectedTimeline ?? null,
    viewing_datetime: raw.viewingDatetime ?? null,
    created_at: raw.createdAt,
    updated_at: raw.updatedAt,
  };
}

const statusToLabel: Record<string, string> = {
  new: 'Новая',
  showing: 'Показ',
  in_deal: 'В сделке',
};

const labelToStatus: Record<string, string> = {
  'Новая': 'new',
  'Показ': 'showing',
  'В сделке': 'in_deal',
};

export const mapLeadStatus = (dbStatus: string) => statusToLabel[dbStatus] || dbStatus;
export const unmapLeadStatus = (uiStatus: string) => labelToStatus[uiStatus] || uiStatus;

export function useLeads() {
  return useQuery({
    queryKey: ['leads'],
    queryFn: async () => {
      const { leads } = await api.get<{ leads: any[] }>('/api/admin/listings/leads/all');
      return leads.map(adaptLead);
    },
  });
}

export function useLeadsByProperty(propertyId: string | undefined) {
  return useQuery({
    queryKey: ['leads', 'property', propertyId],
    queryFn: async () => {
      if (!propertyId) return [];
      const property = await api.get<any>(`/api/admin/listings/${propertyId}`);
      return (property.publicListingLeads ?? []).map(adaptLead);
    },
    enabled: !!propertyId,
  });
}

// Публичная заявка "Записаться на просмотр" — POST /api/public/listings/:propertyId/leads.
export function useCreateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      property_id: string;
      buyer_name: string;
      buyer_phone: string;
      comment?: string | null;
      status?: string;
    }) => {
      await api.post(`/api/public/listings/${input.property_id}/leads`, {
        buyerName: input.buyer_name,
        buyerPhone: input.buyer_phone,
        comment: input.comment ?? undefined,
      });
      return null;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
    },
  });
}

// Ручное добавление лида из админки — POST /api/admin/listings/leads.
export function useCreateLeadAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      property_id: string;
      buyer_name: string;
      buyer_phone: string;
      comment?: string | null;
      status?: string;
    }) => {
      const lead = await api.post<any>('/api/admin/listings/leads', {
        propertyId: input.property_id,
        buyerName: input.buyer_name,
        buyerPhone: input.buyer_phone,
        comment: input.comment ?? undefined,
      });
      return adaptLead(lead);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
    },
  });
}

export function useUpdateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<DbLead> & { id: string }) => {
      const payload: Record<string, any> = {};
      if (updates.buyer_name !== undefined) payload.buyerName = updates.buyer_name;
      if (updates.buyer_phone !== undefined) payload.buyerPhone = updates.buyer_phone;
      if (updates.status !== undefined) payload.status = updates.status;
      if (updates.comment !== undefined) payload.comment = updates.comment;
      if (updates.financing_type !== undefined) payload.financingType = updates.financing_type;
      if (updates.financing_bank !== undefined) payload.financingBank = updates.financing_bank;
      if (updates.pre_approved !== undefined) payload.preApproved = updates.pre_approved;
      if (updates.mortgage_amount !== undefined) payload.mortgageAmount = Number(updates.mortgage_amount);
      if (updates.expected_timeline !== undefined) payload.expectedTimeline = updates.expected_timeline;
      if (updates.viewing_datetime !== undefined) payload.viewingDatetime = updates.viewing_datetime;

      const lead = await api.patch<any>(`/api/admin/listings/leads/${id}`, payload);
      return adaptLead(lead);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['properties'] });
    },
  });
}
