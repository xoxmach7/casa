import { api } from '@/lib/api-client';

// Публичная форма продавца — анонимная загрузка фото (jpeg/png/webp только).
export async function uploadPropertyPhoto(_propertyId: string, file: File): Promise<string> {
  const formData = new FormData();
  formData.append('files', file);
  const { urls } = await api.upload<{ urls: string[] }>('/api/public/uploads', formData);
  return urls[0];
}

// Планировка на публичной форме — тот же анонимный upload (только изображения;
// PDF-планировки пока не поддерживаются публичным эндпоинтом — известное
// ограничение, см. гэп-аудит интеграции casa40-main).
export async function uploadFloorPlan(_propertyId: string, file: File): Promise<string> {
  const formData = new FormData();
  formData.append('files', file);
  const { urls } = await api.upload<{ urls: string[] }>('/api/public/uploads', formData);
  return urls[0];
}

// Из админки (авторизовано) — фото/документы/планировки привязываются к
// конкретному объекту сразу на сервере.
export async function uploadPropertyPhotoAdmin(propertyId: string, file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  const { url } = await api.upload<{ url: string }>(`/api/uploads/property/${propertyId}/images`, formData);
  return url;
}

export async function uploadFloorPlanAdmin(propertyId: string, file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  const { url } = await api.upload<{ url: string }>(`/api/uploads/property/${propertyId}/documents`, formData);
  return url;
}

// Приём подтверждения оплаты риелторского вознаграждения — авторизованная
// загрузка документа (pdf/doc/docx/через тот же эндпоинт документов).
export async function uploadPaymentReceipt(propertyId: string, file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  const { url } = await api.upload<{ url: string }>(`/api/uploads/property/${propertyId}/documents`, formData);
  return url;
}
