// Static option lists for forms and filters — no mock/demo data

// TomTom Map Display API key (domain-whitelisted, safe for client bundle)
export const TOMTOM_API_KEY = '40nH6NdVknh4cEQN9bAO3MI2rNiek0y7';

// Shared Leaflet marker icon config (fixes broken default icons in Vite builds)
export const LEAFLET_MARKER_ICON_URL = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png';
export const LEAFLET_MARKER_ICON_RETINA_URL = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png';
export const LEAFLET_MARKER_SHADOW_URL = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png';

export const districts = [
  'Алматы',
  'Байқоңыр',
  'Есіл',
  'Нұра',
  'Сарыарқа',
  'Сарайшық',
];

export const roomOptions = [1, 2, 3, 4, 5];

export const buildingTypes = [
  'Монолитный',
  'Кирпичный',
  'Панельный',
  'Каркасный',
];

export const layoutOptions = [
  'Студия',
  'Изолированные комнаты',
];

export const bathroomOptions = [
  'Раздельный',
  'Совмещенный',
  '2 и более',
];

// Layout: UI label → DB value
export const layoutToDb: Record<string, string> = {
  'Студия': 'studio',
  'Изолированные комнаты': 'isolated_rooms',
};
export const layoutFromDb: Record<string, string> = {
  'studio': 'Студия',
  'isolated_rooms': 'Изолированные комнаты',
};

// Bathroom: UI label → DB value
export const bathroomToDb: Record<string, string> = {
  'Раздельный': 'separate',
  'Совмещенный': 'combined',
  '2 и более': 'two_or_more',
};
export const bathroomFromDb: Record<string, string> = {
  'separate': 'Раздельный',
  'combined': 'Совмещенный',
  'two_or_more': '2 и более',
};

export const renovationOptions = [
  'Без ремонта',
  'Косметический',
  'Евроремонт',
  'Дизайнерский',
];

export const balconyOptions = [
  'Нет',
  'Балкон',
  'Лоджия',
  'Балкон и лоджия',
];
