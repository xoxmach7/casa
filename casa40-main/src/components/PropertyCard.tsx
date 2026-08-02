import { useNavigate } from 'react-router-dom';
import TrustLabel from './TrustLabel';
import { Property } from '@/types/casa';

const formatPrice = (price: number) => {
  return new Intl.NumberFormat('ru-RU').format(price) + ' ₸';
};

const PropertyCard = ({ property }: { property: Property }) => {
  const navigate = useNavigate();

  return (
    <div
      className="casa-card cursor-pointer active:scale-[0.98] transition-transform"
      onClick={() => navigate(`/property/${property.id}`)}
    >
      <div className="aspect-[4/3] w-full bg-accent relative">
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
          <svg className="w-16 h-16 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          </svg>
        </div>
      </div>
      <div className="p-5 space-y-3">
        <p className="text-xl font-semibold text-primary tabular-nums tracking-tight">
          {formatPrice(property.price)}
        </p>
        <p className="text-sm text-muted-foreground">
          Астана, {property.residentialComplex || property.district}
        </p>
        <div className="flex gap-3 text-sm text-muted-foreground">
          <span>{property.rooms} комн.</span>
          <span>{property.area} м²</span>
          <span>{property.floor}/{property.totalFloors} этаж</span>
        </div>
        {property.verified && <TrustLabel />}
        <button
          className="w-full h-14 bg-primary text-primary-foreground rounded-2xl font-medium active:scale-[0.98] transition-all mt-2"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/property/${property.id}`);
          }}
        >
          Смотреть квартиру
        </button>
      </div>
    </div>
  );
};

export { formatPrice };
export default PropertyCard;
