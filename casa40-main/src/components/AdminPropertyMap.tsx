import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin } from 'lucide-react';
import { TOMTOM_API_KEY, LEAFLET_MARKER_ICON_URL, LEAFLET_MARKER_ICON_RETINA_URL, LEAFLET_MARKER_SHADOW_URL } from '@/data/constants';

// Fix default marker icon for Vite/production builds
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: LEAFLET_MARKER_ICON_URL,
  iconRetinaUrl: LEAFLET_MARKER_ICON_RETINA_URL,
  shadowUrl: LEAFLET_MARKER_SHADOW_URL,
});

interface Props {
  lat?: number | null;
  lng?: number | null;
  onCoordinateChange?: (lat: number, lng: number) => void;
}

const ASTANA_CENTER: [number, number] = [51.1694, 71.4491];

function LeafletMap({ lat, lng, onCoordinateChange }: Props) {
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const hasPin = lat != null && lng != null;
    const center: [number, number] = hasPin ? [lat, lng] : ASTANA_CENTER;

    const map = L.map(containerRef.current, {
      center,
      zoom: hasPin ? 16 : 12,
      zoomControl: true,
    });

    L.tileLayer(
      `https://api.tomtom.com/map/1/tile/basic/main/{z}/{x}/{y}.png?key=${TOMTOM_API_KEY}`,
      {
        attribution: '&copy; <a href="https://www.tomtom.com">TomTom</a>',
        maxZoom: 19,
      },
    ).addTo(map);

    if (hasPin) {
      markerRef.current = L.marker([lat, lng]).addTo(map);
    }

    map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat: clickLat, lng: clickLng } = e.latlng;
      if (markerRef.current) {
        markerRef.current.setLatLng([clickLat, clickLng]);
      } else {
        markerRef.current = L.marker([clickLat, clickLng]).addTo(map);
      }
      onCoordinateChange?.(clickLat, clickLng);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    const hasPin = lat != null && lng != null;
    if (hasPin) {
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else {
        markerRef.current = L.marker([lat, lng]).addTo(mapRef.current);
      }
      mapRef.current.setView([lat, lng], mapRef.current.getZoom());
    }
  }, [lat, lng]);

  return (
    <div
      ref={containerRef}
      className="rounded-xl overflow-hidden border border-border/30"
      style={{ height: 240 }}
    />
  );
}

const AdminPropertyMap = ({ lat, lng, onCoordinateChange }: Props) => {
  if (!TOMTOM_API_KEY) {
    return (
      <div className="rounded-xl bg-accent/50 border border-border/30 flex flex-col items-center justify-center gap-1.5 py-8 px-4 text-center">
        <MapPin className="w-5 h-5 text-muted-foreground/40" />
        <p className="text-[11px] text-muted-foreground/60">
          Карта недоступна — не задан VITE_TOMTOM_API_KEY
        </p>
      </div>
    );
  }

  return <LeafletMap lat={lat} lng={lng} onCoordinateChange={onCoordinateChange} />;
};

export default AdminPropertyMap;
