import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LEAFLET_MARKER_ICON_URL, LEAFLET_MARKER_ICON_RETINA_URL, LEAFLET_MARKER_SHADOW_URL } from '@/data/constants';

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

    // Same TomTom-key-is-referer-restricted issue as PublicMap.tsx — see
    // that file's comment. OSM tiles used here too until it's resolved.
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

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

    const resizeObserver = new ResizeObserver(() => {
      mapRef.current?.invalidateSize();
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
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
  return <LeafletMap lat={lat} lng={lng} onCoordinateChange={onCoordinateChange} />;
};

export default AdminPropertyMap;
