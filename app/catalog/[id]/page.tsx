import { notFound } from "next/navigation";
import { getProperty } from "@/lib/api/procasa-client";
import { ViewingRequestForm } from "@/components/catalog/ViewingRequestForm";
import { formatTenge } from "@/lib/format";

interface PropertyPageProps {
  params: { id: string };
}

export default async function PropertyPage({ params }: PropertyPageProps) {
  const property = await getProperty(params.id);

  if (!property) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <p className="text-3xl font-semibold">{formatTenge(property.price)}</p>
      <h1 className="mt-2 text-2xl font-semibold">{property.residentialComplex}</h1>
      <p className="text-ink/60">
        {property.district}, {property.address}
      </p>

      <dl className="mt-6 grid grid-cols-2 gap-4 rounded-card bg-white p-6 shadow-sm">
        <div>
          <dt className="text-sm text-ink/60">Комнат</dt>
          <dd className="text-lg">{property.rooms}</dd>
        </div>
        <div>
          <dt className="text-sm text-ink/60">Площадь</dt>
          <dd className="text-lg">{property.area} м²</dd>
        </div>
        <div>
          <dt className="text-sm text-ink/60">Этаж</dt>
          <dd className="text-lg">
            {property.floor} из {property.totalFloors}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-ink/60">Ремонт</dt>
          <dd className="text-lg">{property.repairState}</dd>
        </div>
      </dl>

      <div className="mt-6">
        <ViewingRequestForm propertyId={property.id} />
      </div>
    </main>
  );
}
