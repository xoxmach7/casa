import Link from "next/link";
import type { PropertyCard as PropertyCardData } from "@/lib/api/procasa-client";
import { formatTenge } from "@/lib/format";

interface PropertyCardProps {
  property: PropertyCardData;
}

export function PropertyCard({ property }: PropertyCardProps) {
  return (
    <Link
      href={`/catalog/${property.id}`}
      className="block rounded-card bg-white p-4 shadow-sm transition hover:shadow-md"
    >
      <p className="text-xl font-semibold">{formatTenge(property.price)}</p>
      <p className="mt-1 font-medium">{property.residentialComplex}</p>
      <p className="text-sm text-ink/60">
        {property.district}, {property.address}
      </p>
      <p className="mt-2 text-sm text-ink/70">
        {property.rooms} комн · {property.area} м²
      </p>
    </Link>
  );
}
