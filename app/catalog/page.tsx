import { getProperties } from "@/lib/api/procasa-client";
import { PropertyCard } from "@/components/catalog/PropertyCard";
import { CatalogMap } from "@/components/catalog/CatalogMap";

export default async function CatalogPage() {
  const properties = await getProperties();

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-3xl font-semibold">Квартиры в Алматы</h1>

      <div className="mt-6">
        <CatalogMap properties={properties} />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {properties.map((property) => (
          <PropertyCard key={property.id} property={property} />
        ))}
      </div>

      {properties.length === 0 && (
        <p className="mt-6 text-ink/60">Пока нет опубликованных объявлений.</p>
      )}
    </main>
  );
}
