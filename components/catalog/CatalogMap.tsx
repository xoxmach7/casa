"use client";

import { useEffect, useRef } from "react";
import type { PropertyCard as PropertyCardData } from "@/lib/api/procasa-client";
import { formatTenge } from "@/lib/format";

interface CatalogMapProps {
  properties: PropertyCardData[];
}

const TWOGIS_API_KEY = process.env.NEXT_PUBLIC_2GIS_API_KEY;
const ALMATY_CENTER: [number, number] = [76.9286, 43.2380];

export function CatalogMap({ properties }: CatalogMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!TWOGIS_API_KEY || !containerRef.current) return;

    let map: any;
    let destroyed = false;

    import("@2gis/mapgl").then(({ load }) => {
      load().then((mapglAPI: any) => {
        if (destroyed || !containerRef.current) return;
        map = new mapglAPI.Map(containerRef.current, {
          center: ALMATY_CENTER,
          zoom: 11,
          key: TWOGIS_API_KEY,
        });

        for (const property of properties) {
          new mapglAPI.Marker(map, {
            coordinates: [property.lng, property.lat],
            label: { text: formatTenge(property.price) },
          });
        }
      });
    });

    return () => {
      destroyed = true;
      map?.destroy?.();
    };
  }, [properties]);

  if (!TWOGIS_API_KEY) {
    return (
      <div className="flex h-64 items-center justify-center rounded-card bg-ink/5 text-sm text-ink/60">
        Карта недоступна (не задан NEXT_PUBLIC_2GIS_API_KEY)
      </div>
    );
  }

  return <div ref={containerRef} className="h-96 w-full rounded-card" data-testid="catalog-map" />;
}
