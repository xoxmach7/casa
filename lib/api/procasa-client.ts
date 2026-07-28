const API_BASE_URL = process.env.NEXT_PUBLIC_PROCASA_API_URL ?? "http://localhost:3001";

export interface ValuationRequest {
  district: string;
  rooms: number;
  area: number;
}

export type ValuationResponse =
  | {
      status: "ready";
      marketValue: number;
      urgentPrice: number;
      marketPrice: number;
      comparablesCount: number;
    }
  | { status: "insufficient_data" }
  | { status: "error" };

export async function getValuation(request: ValuationRequest): Promise<ValuationResponse> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/public/valuation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });

    if (res.status === 422) {
      return { status: "insufficient_data" };
    }

    if (!res.ok) {
      return { status: "error" };
    }

    const data = await res.json();
    return { status: "ready", ...data };
  } catch {
    return { status: "error" };
  }
}

export interface PropertyCard {
  id: string;
  district: string;
  residentialComplex: string;
  address: string;
  lat: number;
  lng: number;
  rooms: number;
  area: number;
  price: number;
  images: string[];
}

export interface PropertyDetail extends PropertyCard {
  floor: number;
  totalFloors: number;
  buildingType: string;
  repairState: string;
  balconyType: string | null;
}

export async function getProperties(district?: string): Promise<PropertyCard[]> {
  const url = new URL(`${API_BASE_URL}/api/public/properties`);
  if (district) url.searchParams.set("district", district);

  const res = await fetch(url.toString());
  if (!res.ok) return [];

  const data = await res.json();
  return data.properties;
}

export async function getProperty(id: string): Promise<PropertyDetail | null> {
  const res = await fetch(`${API_BASE_URL}/api/public/properties/${id}`);
  if (!res.ok) return null;
  return res.json();
}

export interface ViewingRequestInput {
  propertyId: string;
  name: string;
  phone: string;
}

export async function submitViewingRequest(input: ViewingRequestInput): Promise<boolean> {
  const res = await fetch(`${API_BASE_URL}/api/public/viewing-requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return res.ok;
}

export interface PropertyLeadInput {
  district: string;
  residentialComplex: string;
  address: string;
  houseNumber: string;
  price: number;
  negotiable: boolean;
  moveInReady: boolean;
  furnished: boolean;
  hasAppliances: boolean;
  rooms: number;
  area: number;
  contactName: string;
  contactPhone: string;
  photoUrls?: string[];
}

export type PropertyLeadResult =
  | { success: true; sellerId: string }
  | { success: false };

export async function submitPropertyLead(input: PropertyLeadInput): Promise<PropertyLeadResult> {
  const res = await fetch(`${API_BASE_URL}/api/public/property-leads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) return { success: false };
  return res.json();
}

export async function uploadPhotos(files: File[]): Promise<string[]> {
  if (files.length === 0) return [];

  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file);
  }

  const res = await fetch(`${API_BASE_URL}/api/public/uploads`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) return [];

  const data = await res.json();
  return data.urls;
}

export interface BuyerLeadInput {
  name: string;
  phone: string;
  district?: string;
  rooms?: number[];
  minBudget?: number;
  maxBudget?: number;
  notes?: string;
}

export type BuyerLeadResult = { success: true; buyerId: string } | { success: false };

export async function submitBuyerLead(input: BuyerLeadInput): Promise<BuyerLeadResult> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/public/buyer-leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) return { success: false };
    return res.json();
  } catch {
    return { success: false };
  }
}

export async function submitLeadForm(formId: string, formData: Record<string, string>): Promise<boolean> {
  const res = await fetch(`${API_BASE_URL}/api/public/forms/${formId}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(formData),
  });
  return res.ok;
}
