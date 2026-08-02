export type ObjectStatus = 
  | 'Новая' 
  | 'Опубликован' 
  | 'Показ'
  | 'В сделке';

export type LeadStatus = 
  | 'Новая' 
  | 'Показ' 
  | 'В сделке';

export interface Property {
  id: string;
  status: ObjectStatus;
  price: number;
  district: string;
  address: string;
  houseNumber: string;
  residentialComplex?: string;
  rooms: number;
  area: number;
  layout?: string;
  renovationCondition?: string;
  floor: number;
  totalFloors: number;
  buildingType: string;
  yearBuilt?: number;
  balcony?: string;
  ceilingHeight?: number;
  negotiable: boolean;
  readyToMoveIn: boolean;
  description?: string;
  photos: string[];
  floorPlan?: string;
  verified: boolean;
  sellerName: string;
  sellerPhone: string;
  sellerWhatsApp: boolean;
  ownerFlag: boolean;
  bestContactTime?: string;
  nextStep?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Lead {
  id: string;
  propertyId: string;
  status: LeadStatus;
  buyerName: string;
  buyerPhone: string;
  viewingDatetime?: string;
  nextStep?: string;
  createdAt: string;
  updatedAt: string;
}
