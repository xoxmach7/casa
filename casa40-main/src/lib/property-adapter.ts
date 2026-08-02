// Adapts the real backend's CrmProperty(+PublicListingOps+Seller) shape to
// the exact snake_case `DbProperty` shape the existing UI components read
// (property.seller_name, property.payment_status, etc.) — this keeps every
// page/component unchanged while swapping the data source underneath.

export interface AdaptedProperty {
  id: string;
  address: string | null;
  area: number | null;
  balcony: boolean | null;
  bathroom_type: string | null;
  best_contact_time: string | null;
  building_type: string | null;
  ceiling_height: number | null;
  created_at: string;
  description: string | null;
  district: string | null;
  floor: number | null;
  floor_plan_url: string | null;
  has_appliances: boolean | null;
  has_furniture: boolean | null;
  house_number: string | null;
  is_archived: boolean;
  lat: number | null;
  layout: string | null;
  lng: number | null;
  negotiable: boolean | null;
  owner_flag: boolean | null;
  payment_amount: number | null;
  payment_comment: string | null;
  payment_receipt_url: string | null;
  payment_status: string | null;
  photo_urls: string[] | null;
  price: number | null;
  ready_to_move_in: boolean | null;
  renovation_condition: string | null;
  residential_complex: string | null;
  rooms: number | null;
  selected_lead_id: string | null;
  seller_name: string;
  seller_phone: string;
  seller_whatsapp: string | null;
  status: 'new' | 'published' | 'showing' | 'in_deal';
  title: string | null;
  total_floors: number | null;
  updated_at: string;
  verification_checklist: unknown;
  year_built: number | null;
}

const OPS_STATUS_TO_UI: Record<string, AdaptedProperty['status']> = {
  NEW: 'new',
  PUBLISHED: 'published',
  SHOWING: 'showing',
  IN_DEAL: 'in_deal',
  // ARCHIVED has no direct UI status equivalent — is_archived carries that
  // instead, so an archived listing keeps showing its last working status.
  ARCHIVED: 'in_deal',
};

export function adaptProperty(raw: any): AdaptedProperty {
  const ops = raw.publicListingOps ?? null;
  const seller = raw.seller ?? null;

  return {
    id: raw.id,
    address: raw.address ?? null,
    area: raw.area != null ? Number(raw.area) : null,
    balcony: raw.balconyType != null,
    bathroom_type: raw.bathroomType ?? null,
    best_contact_time: seller?.preferredTime ?? null,
    building_type: raw.buildingType ?? null,
    ceiling_height: raw.ceilingHeight != null ? Number(raw.ceilingHeight) : null,
    created_at: raw.createdAt,
    description: raw.description ?? null,
    district: raw.district ?? null,
    floor: raw.floor ?? null,
    floor_plan_url: raw.layoutImage ?? null,
    has_appliances: raw.hasBuiltInAppliances ?? null,
    has_furniture: raw.furnitureLevel != null && raw.furnitureLevel !== 'NONE',
    house_number: null,
    is_archived: raw.status === 'ARCHIVED' || ops?.status === 'ARCHIVED',
    lat: raw.lat ?? null,
    layout: raw.layoutType ?? null,
    lng: raw.lng ?? null,
    negotiable: raw.negotiable ?? null,
    owner_flag: null,
    payment_amount: ops?.paymentAmount != null ? Number(ops.paymentAmount) : null,
    payment_comment: ops?.paymentComment ?? null,
    payment_receipt_url: ops?.paymentReceiptFileId ?? null,
    payment_status: ops?.paymentStatus ? ops.paymentStatus.toLowerCase() : 'unpaid',
    photo_urls: raw.images ?? [],
    price: raw.price != null ? Number(raw.price) : null,
    ready_to_move_in: raw.readyToMoveIn ?? null,
    renovation_condition: raw.repairState ?? null,
    residential_complex: raw.residentialComplex ?? null,
    rooms: raw.rooms ?? null,
    selected_lead_id: ops?.selectedLeadId ?? null,
    seller_name: seller ? `${seller.firstName ?? ''} ${seller.lastName ?? ''}`.trim() : '',
    seller_phone: seller?.phone ?? '',
    seller_whatsapp: null,
    status: OPS_STATUS_TO_UI[ops?.status ?? 'NEW'] ?? 'new',
    title: raw.residentialComplex ? `${raw.residentialComplex}, ${raw.district ?? ''}`.trim() : null,
    total_floors: raw.totalFloors ?? null,
    updated_at: raw.updatedAt,
    verification_checklist: ops?.verificationChecklist ?? null,
    year_built: raw.yearBuilt ?? null,
  };
}

// Best-effort mapping from casa40's free-text UI values onto the backend's
// strict enums — unmatched values fall back to the backend default rather
// than failing the request, and the original text is preserved in notes.
const BUILDING_TYPE_MAP: Record<string, string> = {
  монолит: 'MONOLITH',
  кирпич: 'BRICK',
  панель: 'PANEL',
  'монолит-кирпич': 'MONOLITH_BRICK',
  блочный: 'BLOCK',
};

const REPAIR_STATE_MAP: Record<string, string> = {
  'без ремонта': 'NONE',
  косметический: 'COSMETIC',
  капитальный: 'CAPITAL',
  евроремонт: 'EURO',
  дизайнерский: 'DESIGNER',
};

function mapFreeText(value: string | null | undefined, dict: Record<string, string>): string | undefined {
  if (!value) return undefined;
  return dict[value.trim().toLowerCase()];
}

// Converts the AddListing.tsx-shaped payload (snake_case, matches the old
// Supabase `properties` insert shape) into a POST /api/public/property-leads
// request body.
export function toPropertyLeadPayload(input: Record<string, any>) {
  return {
    district: input.district ?? '',
    residentialComplex: input.residential_complex ?? '',
    address: input.address ?? '',
    houseNumber: input.house_number ?? '-',
    price: Number(input.price) || 0,
    negotiable: !!input.negotiable,
    moveInReady: !!input.ready_to_move_in,
    furnished: !!input.has_furniture,
    hasAppliances: !!input.has_appliances,
    rooms: Number(input.rooms) || 1,
    area: Number(input.area) || 0,
    contactName: input.seller_name ?? '',
    contactPhone: input.seller_phone ?? '',
    photoUrls: input.photo_urls ?? [],
    floor: input.floor != null ? Number(input.floor) : undefined,
    totalFloors: input.total_floors != null ? Number(input.total_floors) : undefined,
    yearBuilt: input.year_built != null ? Number(input.year_built) : undefined,
    ceilingHeight: input.ceiling_height != null ? Number(input.ceiling_height) : undefined,
    buildingType: mapFreeText(input.building_type, BUILDING_TYPE_MAP),
    repairState: mapFreeText(input.renovation_condition, REPAIR_STATE_MAP),
    bathroomType: input.bathroom_type ?? undefined,
    balconyType: input.balcony ? 'Есть' : undefined,
    description: input.description ?? undefined,
    floorPlanUrl: input.floor_plan_url ?? undefined,
  };
}

// Converts a UpdateProperty (snake_case, partial) payload into the admin
// PATCH /api/admin/listings/:id request body.
export function toAdminUpdatePayload(input: Record<string, any>) {
  const out: Record<string, any> = {};
  if (input.district !== undefined) out.district = input.district;
  if (input.residential_complex !== undefined) out.residentialComplex = input.residential_complex;
  if (input.address !== undefined) out.address = input.address;
  if (input.rooms !== undefined) out.rooms = Number(input.rooms);
  if (input.area !== undefined) out.area = Number(input.area);
  if (input.price !== undefined) out.price = Number(input.price);
  if (input.floor !== undefined) out.floor = Number(input.floor);
  if (input.total_floors !== undefined) out.totalFloors = Number(input.total_floors);
  if (input.year_built !== undefined) out.yearBuilt = Number(input.year_built);
  if (input.description !== undefined) out.description = input.description;
  if (input.negotiable !== undefined) out.negotiable = input.negotiable;
  if (input.ready_to_move_in !== undefined) out.readyToMoveIn = input.ready_to_move_in;
  if (input.photo_urls !== undefined) out.images = input.photo_urls;
  if (input.floor_plan_url !== undefined) out.layoutImage = input.floor_plan_url;
  if (input.lat !== undefined) out.lat = input.lat;
  if (input.lng !== undefined) out.lng = input.lng;
  return out;
}
