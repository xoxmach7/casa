import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface MapProperty {
  id: string;
  lat: number;
  lng: number;
  priceLabel: string;       // e.g. "25 млн ₸"
  popupPrice: string;       // e.g. "25 000 000 ₸"
  popupRooms?: number | null;
  popupArea?: number | null;
  popupLocation: string;    // e.g. "ЖК GreenLine" or "ул. Сарайшык 12"
}

interface Props {
  properties: MapProperty[];
  onMarkerClick?: (id: string) => void;
  selectedId?: string | null;
  onFitAllRef?: React.MutableRefObject<(() => void) | null>;
}

const ASTANA_CENTER: [number, number] = [51.1284, 71.4306];

function createPriceIcon(label: string, isSelected: boolean) {
  const cls = isSelected ? 'casa-map-pin casa-map-pin--active' : 'casa-map-pin';
  return L.divIcon({
    className: 'casa-map-pin-container',
    html: `<div class="${cls}">${label}</div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
    popupAnchor: [0, -32],
  });
}


const PublicMap = ({ properties, onMarkerClick, selectedId, onFitAllRef }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const propsRef = useRef<Map<string, MapProperty>>(new Map());
  const initialFitDone = useRef(false);

  // Expose fitAll function to parent
  useEffect(() => {
    if (onFitAllRef) {
      onFitAllRef.current = () => {
        const map = mapRef.current;
        if (!map || markersRef.current.size === 0) return;
        const group = L.featureGroup(Array.from(markersRef.current.values()));
        map.fitBounds(group.getBounds().pad(0.1), { maxZoom: 14, animate: true });
      };
    }
    return () => { if (onFitAllRef) onFitAllRef.current = null; };
  }, [onFitAllRef]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: ASTANA_CENTER,
      zoom: 13,
      zoomControl: false,
      attributionControl: false,
    });

    L.control.zoom({ position: 'topleft' }).addTo(map);

    // TomTom's key (TOMTOM_API_KEY) is referer-restricted to a domain that
    // isn't this deployment — every tile request 403s with InvalidReferer.
    // Fixing that requires access to the TomTom account dashboard, which
    // isn't available here. OSM's public tile server needs no key and has
    // no referer restriction, so it's used as the stopgap until either the
    // TomTom key's allowed referrers are updated or a paid provider is set up.
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    // Leaflet measures its container's pixel size exactly once at init. If
    // that size is wrong or changes afterward (sibling content loading
    // async, a fullscreen toggle, a card above resizing once react-query
    // data arrives), the map keeps rendering at the stale size until told
    // otherwise — this is what caused the map to appear to "bleed" out of
    // its rounded container. A ResizeObserver + invalidateSize keeps it
    // correct whenever the container's actual size changes.
    const resizeObserver = new ResizeObserver(() => {
      mapRef.current?.invalidateSize();
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
      propsRef.current.clear();
    };
  }, []);

  // Sync markers — NO viewport changes here except initial fit
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const currentIds = new Set(properties.map(p => p.id));

    // Remove stale
    markersRef.current.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
        propsRef.current.delete(id);
      }
    });

    // Add/update
    properties.forEach((p) => {
      propsRef.current.set(p.id, p);
      const isSelected = p.id === selectedId;
      const existing = markersRef.current.get(p.id);

      if (existing) {
        existing.setLatLng([p.lat, p.lng]);
        existing.setIcon(createPriceIcon(p.priceLabel, isSelected));
      } else {
        const marker = L.marker([p.lat, p.lng], {
          icon: createPriceIcon(p.priceLabel, isSelected),
          zIndexOffset: isSelected ? 1000 : 0,
        }).addTo(map);

        marker.on('click', () => {
          onMarkerClick?.(p.id);
        });
        markersRef.current.set(p.id, marker);
      }
    });

    // Only fit bounds on very first load
    if (!initialFitDone.current && properties.length > 0) {
      const group = L.featureGroup(Array.from(markersRef.current.values()));
      map.fitBounds(group.getBounds().pad(0.1), { maxZoom: 14 });
      initialFitDone.current = true;
    }
  }, [properties, onMarkerClick, selectedId]);

  // Handle selection changes — update icon highlight only
  useEffect(() => {
    markersRef.current.forEach((marker, id) => {
      const p = propsRef.current.get(id);
      const isSelected = id === selectedId;
      if (p) marker.setIcon(createPriceIcon(p.priceLabel, isSelected));
      marker.setZIndexOffset(isSelected ? 1000 : 0);
    });
  }, [selectedId]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
    />
  );
};

export default PublicMap;
