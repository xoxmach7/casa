// Casa Adapter Layer — унифицированный формат данных для внешних интеграций
// Все внешние данные приводятся к стандартному JSON-формату Casa

export interface CasaProject {
  project_id: string;
  name: string;
  city: string;
  address: string;
  developer: string;
  status: 'under_construction' | 'completed' | 'ready_to_move';
  delivery_date: string | null;
}

export interface CasaApartment {
  project_id: string;
  apartment_id: string;
  number: string;
  floor: number;
  rooms: number;
  area: number;
  price: number;
  status: 'available' | 'reserved' | 'sold';
}

export interface CasaClient {
  client_id: string;
  iin: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string | null;
  status: 'new' | 'in_progress' | 'deal_closed' | 'rejected';
}

export interface CasaBooking {
  booking_id: string;
  client_id: string;
  apartment_id: string;
  project_id: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'expired';
  expires_at: string;
  created_at: string;
}

// Adapters: convert internal Prisma models to Casa format

export function toProject(p: any): CasaProject {
  return {
    project_id: p.id,
    name: p.name,
    city: p.city,
    address: p.address,
    developer: p.developerName || '',
    status: p.buildingStatus?.toLowerCase().replace(/_/g, '_') || 'under_construction',
    delivery_date: p.deliveryDate ? new Date(p.deliveryDate).toISOString() : null,
  };
}

export function toApartment(a: any): CasaApartment {
  return {
    project_id: a.projectId,
    apartment_id: a.id,
    number: a.number,
    floor: a.floor,
    rooms: a.rooms,
    area: Number(a.area),
    price: Number(a.price),
    status: a.status?.toLowerCase() || 'available',
  };
}

export function toClient(c: any): CasaClient {
  return {
    client_id: c.id,
    iin: c.iin,
    first_name: c.firstName,
    last_name: c.lastName,
    phone: c.phone,
    email: c.email || null,
    status: c.status?.toLowerCase().replace(/_/g, '_') || 'new',
  };
}

export function toBooking(b: any): CasaBooking {
  return {
    booking_id: b.id,
    client_id: b.clientId,
    apartment_id: b.apartmentId,
    project_id: b.apartment?.projectId || '',
    status: b.status?.toLowerCase() || 'pending',
    expires_at: new Date(b.expiresAt).toISOString(),
    created_at: new Date(b.createdAt).toISOString(),
  };
}
