import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { adaptProperty, toPropertyLeadPayload, toAdminUpdatePayload, type AdaptedProperty } from '@/lib/property-adapter';

// Kept for backward compatibility with existing component imports —
// DbProperty now means "the shape the UI reads", not a literal Supabase row.
export type DbProperty = AdaptedProperty;
export type PublicProperty = AdaptedProperty;

const statusToLabel: Record<string, string> = {
  new: 'Новая',
  published: 'Опубликован',
  showing: 'Показ',
  in_deal: 'В сделке',
};

const labelToStatus: Record<string, string> = {
  'Новая': 'new',
  'Опубликован': 'published',
  'Показ': 'showing',
  'В сделке': 'in_deal',
};

export const mapPropertyStatus = (dbStatus: string) => statusToLabel[dbStatus] || dbStatus;
export const unmapPropertyStatus = (uiStatus: string) => labelToStatus[uiStatus] || uiStatus;

export const PUBLIC_PROPERTY_STATUSES = ['published', 'showing'] as const;

const UI_TO_OPS_STATUS: Record<string, string> = {
  new: 'NEW',
  published: 'PUBLISHED',
  showing: 'SHOWING',
  in_deal: 'IN_DEAL',
};

// GET /api/public/properties — публичный каталог (только опубликованные).
export function usePublishedProperties() {
  return useQuery({
    queryKey: ['properties', 'public-active'],
    queryFn: async () => {
      const { properties } = await api.get<{ properties: any[] }>('/api/public/properties?limit=100');
      return properties.map((p) => adaptProperty({ ...p, publicListingOps: { status: 'PUBLISHED' } }));
    },
  });
}

export function usePublicProperty(id: string | undefined) {
  return useQuery({
    queryKey: ['properties', 'public', id],
    queryFn: async () => {
      if (!id) return null;
      const property = await api.get<any>(`/api/public/properties/${id}`);
      return adaptProperty({ ...property, publicListingOps: { status: 'PUBLISHED' } });
    },
    enabled: !!id,
  });
}

// GET /api/admin/listings — вся витрина для админки.
export function useAllProperties() {
  return useQuery({
    queryKey: ['properties', 'all'],
    queryFn: async () => {
      const { properties } = await api.get<{ properties: any[] }>('/api/admin/listings');
      return properties.map(adaptProperty);
    },
  });
}

export function useProperty(id: string | undefined) {
  return useQuery({
    queryKey: ['properties', id],
    queryFn: async () => {
      if (!id) return null;
      const property = await api.get<any>(`/api/admin/listings/${id}`);
      return adaptProperty(property);
    },
    enabled: !!id,
  });
}

// Публичная форма продавца ("Добавить квартиру") — POST /api/public/property-leads.
export function useCreateProperty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Record<string, any>) => {
      await api.post('/api/public/property-leads', toPropertyLeadPayload(input));
      return input;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['properties'] });
    },
  });
}

// Единая точка обновления объекта из админки — маршрутизирует по смыслу
// изменения на нужный backend-эндпоинт (статус / оплата / чек-лист / поля).
export function useUpdateProperty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Record<string, any> & { id: string }) => {
      if (updates.status !== undefined || updates.is_archived === true) {
        const status = updates.is_archived ? 'ARCHIVED' : UI_TO_OPS_STATUS[updates.status] ?? 'NEW';
        await api.post(`/api/admin/listings/${id}/status`, {
          status,
          ...(updates.selected_lead_id ? { selectedLeadId: updates.selected_lead_id } : {}),
        });
      }

      if (
        updates.payment_status !== undefined ||
        updates.payment_amount !== undefined ||
        updates.payment_comment !== undefined ||
        updates.payment_receipt_url !== undefined
      ) {
        await api.post(`/api/admin/listings/${id}/payment`, {
          paymentAmount: Number(updates.payment_amount) || 0,
          paymentReceiptFileId: updates.payment_receipt_url ?? undefined,
          paymentComment: updates.payment_comment ?? undefined,
        });
      }

      if (updates.verification_checklist !== undefined) {
        await api.patch(`/api/admin/listings/${id}/checklist`, updates.verification_checklist);
      }

      const fieldPayload = toAdminUpdatePayload(updates);
      if (Object.keys(fieldPayload).length > 0) {
        await api.patch(`/api/admin/listings/${id}`, fieldPayload);
      }

      const refreshed = await api.get<any>(`/api/admin/listings/${id}`);
      return adaptProperty(refreshed);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['properties'] });
    },
  });
}

// Файлы теперь отдаются нашим backend напрямую по URL из ответа загрузки —
// эти хелперы больше не нужны как отдельный шаг (оставлены как no-op для
// обратной совместимости импортов, если где-то ещё используются).
export function getPropertyPhotoUrl(path: string) {
  return path;
}

export function getFloorPlanUrl(path: string) {
  return path;
}
