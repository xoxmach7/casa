import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';

// New-builds (новостройки) catalog — read-only public data sourced from the
// CRM's Project/Apartment ("ЖК") model, published via /api/public/projects.
// Unlike secondary-market listings, projects have no casa40 admin surface:
// publishing happens in the real CRM (delivery/frontend), not here.

export interface ProjectCard {
  id: string;
  name: string;
  city: string;
  district: string | null;
  address: string;
  lat: number | null;
  lng: number | null;
  class: string | null;
  buildingStatus: 'UNDER_CONSTRUCTION' | 'COMPLETED' | 'READY_TO_MOVE';
  deliveryDate: string | null;
  developerName: string | null;
  images: string[];
  minPrice: number | null;
  maxPrice: number | null;
  availableApartments: number;
}

export interface ProjectApartment {
  id: string;
  number: string;
  floor: number;
  rooms: number;
  area: number;
  price: number;
  status: 'AVAILABLE' | 'RESERVED' | 'SOLD';
  layoutImage: string | null;
  images: string[];
}

export interface ProjectDetail extends ProjectCard {
  description: string | null;
  developerPhone: string | null;
  bonus: string | null;
  promotions: string | null;
  mortgagePrograms: string[];
  videoUrl: string | null;
  apartments: ProjectApartment[];
}

export function usePublishedProjects() {
  return useQuery({
    queryKey: ['projects', 'public'],
    queryFn: async () => {
      const { projects } = await api.get<{ projects: ProjectCard[] }>('/api/public/projects?limit=100');
      return projects;
    },
  });
}

export function usePublicProject(id: string | undefined) {
  return useQuery({
    queryKey: ['projects', 'public', id],
    queryFn: async () => {
      if (!id) return null;
      return api.get<ProjectDetail>(`/api/public/projects/${id}`);
    },
    enabled: !!id,
  });
}
