/**
 * Клиент портала вторички.
 *
 * Ключевое, что видно прямо в типах: объект из витрины может прийти
 * МАСКИРОВАННЫМ. `address`, `lat`/`lng`, контакты собственника и ссылки на
 * внешние площадки отсутствуют, пока агент не зафиксировал покупателя, и
 * `isMasked` говорит об этом прямо, а не оставляет догадываться по
 * отсутствию поля.
 */

import { API_URL } from "@/lib/api-client";

export class MarketplaceApiError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message);
    this.name = "MarketplaceApiError";
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      ...init,
    });
  } catch {
    throw new MarketplaceApiError("Сервер недоступен", 0, "network_error");
  }

  const parsed = await response.json().catch(() => ({}));
  if (!response.ok) {
    const body = parsed as { error?: string; code?: string };
    throw new MarketplaceApiError(
      typeof body?.error === "string" ? body.error : `Ошибка сервера (${response.status})`,
      response.status,
      body?.code,
    );
  }
  return parsed as T;
}

export type ListingTier = "BASIC" | "EXCLUSIVE";

export interface CatalogListing {
  id: string;
  rooms: number;
  residentialComplex: string;
  district: string;
  /** Отсутствует, пока покупатель не зафиксирован. */
  address?: string;
  lat: number | null;
  lng: number | null;
  coordinatesApproximate?: boolean;
  area: number | string;
  floor: number;
  totalFloors: number;
  yearBuilt: number;
  price: string;
  images: string[];
  description?: string | null;
  isMasked: boolean;
  maskedFields: string[];
  tier: ListingTier | null;
  declaredSharePercent: string | null;
  expectedReward: string | null;
  fixation: { id: string; status: string; expiresAt: string } | null;
  seller?: { id: string; firstName: string; lastName: string; phone: string };
  krishaUrl?: string | null;
}

export interface CatalogResponse {
  listings: CatalogListing[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

export interface MarketplaceSubscription {
  subscription: {
    id: string;
    plan: "TRIAL" | "START" | "PRO" | "ENTERPRISE";
    status: string;
    maxActiveFixations: number;
    maxAgents: number;
    expiresAt: string | null;
  } | null;
  liveFixations: number;
  remainingFixations: number;
}

export interface Fixation {
  id: string;
  status: string;
  createdAt: string;
  expiresAt: string;
  protectionUntil: string;
  declaredSharePercent: string;
  property: {
    id: string;
    residentialComplex: string;
    district: string;
    rooms: number;
    area: string | number;
    price: string;
    images: string[];
  };
  buyer: { id: string; firstName: string; lastName: string | null; phone: string };
}

export interface Buyer {
  id: string;
  firstName: string;
  lastName?: string | null;
  phone: string;
  minBudget?: string | null;
  maxBudget?: string | null;
}

export function getCatalog(params: {
  page?: number;
  district?: string;
  rooms?: number;
  minPrice?: string;
  maxPrice?: string;
}): Promise<CatalogResponse> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.district) query.set("district", params.district);
  if (params.rooms) query.set("rooms", String(params.rooms));
  if (params.minPrice) query.set("minPrice", params.minPrice);
  if (params.maxPrice) query.set("maxPrice", params.maxPrice);
  return call<CatalogResponse>(`/marketplace/listings?${query.toString()}`);
}

export function getListing(id: string): Promise<CatalogListing> {
  return call<CatalogListing>(`/marketplace/listings/${id}`);
}

export function getSubscription(): Promise<MarketplaceSubscription> {
  return call<MarketplaceSubscription>("/marketplace/subscription");
}

export function fixBuyer(propertyId: string, buyerId: string) {
  return call<Fixation>(`/marketplace/listings/${propertyId}/fixations`, {
    method: "POST",
    body: JSON.stringify({ buyerId }),
  });
}

export function getFixations(): Promise<{ fixations: Fixation[] }> {
  return call<{ fixations: Fixation[] }>("/marketplace/fixations");
}

export function advanceFixation(id: string, status: string, note?: string) {
  return call<Fixation>(`/marketplace/fixations/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status, note }),
  });
}

// === Кабинет собственника ===

export interface TierTerms {
  commissionPercent: string;
  buyerAgentSharePercent: string;
  protectionPeriodDays: number;
  fixationDays: number;
  includedServices: string[];
}

export interface OwnerListing {
  id: string;
  rooms: number;
  residentialComplex: string;
  district: string;
  address: string | null;
  area: string | number;
  floor: number;
  totalFloors: number;
  price: string;
  status: string;
  funnelStage: string;
  images: string[];
  listingAgreements: Array<{
    id: string;
    tier: ListingTier;
    status: string;
    commissionPercent: string;
    buyerAgentSharePercent: string;
    protectionPeriodDays: number;
  }>;
  _count: { secondaryFixations: number; shows: number; offers: number };
}

export function getTiers(): Promise<Record<ListingTier, TierTerms>> {
  return call<Record<ListingTier, TierTerms>>("/marketplace/owner/tiers");
}

export function getOwnerListings(): Promise<{ listings: OwnerListing[] }> {
  return call<{ listings: OwnerListing[] }>("/marketplace/owner/listings");
}

export function createOwnerListing(data: Record<string, unknown>) {
  return call<OwnerListing>("/marketplace/owner/listings", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function chooseTier(propertyId: string, tier: ListingTier) {
  return call<{ id: string; status: string }>(
    `/marketplace/owner/listings/${propertyId}/agreement`,
    { method: "POST", body: JSON.stringify({ tier }) },
  );
}

export function acceptAgreement(agreementId: string) {
  return call<{ id: string; status: string }>(
    `/marketplace/owner/agreements/${agreementId}/accept`,
    { method: "POST", body: JSON.stringify({}) },
  );
}

export function getListingInterest(propertyId: string) {
  return call<{
    fixations: Array<{
      id: string;
      status: string;
      createdAt: string;
      expiresAt: string;
      agent: { id: string; firstName: string; lastName: string; phone: string };
      agency: { id: string; companyName: string | null } | null;
    }>;
  }>(`/marketplace/owner/listings/${propertyId}/interest`);
}

export function declareExit(
  propertyId: string,
  data: { outcome: string; buyerPhone?: string; declaredPrice?: string; comment?: string },
) {
  return call<{ exit: { id: string; outcome: string }; message: string }>(
    `/marketplace/owner/listings/${propertyId}/exit`,
    { method: "POST", body: JSON.stringify(data) },
  );
}

// === Административный контур ===

export interface ModerationListing {
  id: string;
  residentialComplex: string;
  district: string;
  address: string | null;
  rooms: number;
  area: string | number;
  price: string;
  createdAt: string;
  seller: { id: string; firstName: string; lastName: string; phone: string } | null;
  listingAgreements: Array<{ id: string; tier: ListingTier; status: string }>;
}

export interface AgencySubscriptionRow {
  id: string;
  plan: string;
  status: string;
  maxActiveFixations: number;
  maxAgents: number;
  expiresAt: string | null;
  amount: string | null;
  agency: { id: string; email: string; companyName: string | null; firstName: string; lastName: string; role: string };
}

export interface DisputeRow {
  id: string;
  outcome: string;
  declaredPrice: string | null;
  createdAt: string;
  comment: string | null;
  matchedFixationId: string | null;
  property: { id: string; residentialComplex: string; district: string; rooms: number; area: string | number };
}

export function getModerationQueue(): Promise<{ listings: ModerationListing[] }> {
  return call<{ listings: ModerationListing[] }>("/admin/marketplace/moderation");
}

export function approveListing(id: string) {
  return call<{ id: string; status: string }>(`/admin/marketplace/listings/${id}/approve`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function rejectListing(id: string, reason: string) {
  return call<{ id: string; status: string }>(`/admin/marketplace/listings/${id}/reject`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function getAgencySubscriptions(): Promise<{ subscriptions: AgencySubscriptionRow[] }> {
  return call<{ subscriptions: AgencySubscriptionRow[] }>("/admin/marketplace/subscriptions");
}

export function grantSubscription(agencyId: string, plan: string, expiresAt?: string) {
  return call<AgencySubscriptionRow>("/admin/marketplace/subscriptions", {
    method: "POST",
    body: JSON.stringify({ agencyId, plan, expiresAt }),
  });
}

export function cancelSubscription(id: string) {
  return call<AgencySubscriptionRow>(`/admin/marketplace/subscriptions/${id}/cancel`, {
    method: "PATCH",
    body: JSON.stringify({}),
  });
}

export function getDisputes(): Promise<{ disputes: DisputeRow[] }> {
  return call<{ disputes: DisputeRow[] }>("/admin/marketplace/disputes");
}
