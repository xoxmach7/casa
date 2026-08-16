import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Phone } from 'lucide-react';
import { usePublicProject } from '@/hooks/useProjects';
import { formatPrice } from '@/components/PropertyCard';
import Seo from '@/components/Seo';

const buildingStatusLabel: Record<string, string> = {
  UNDER_CONSTRUCTION: 'Строится',
  COMPLETED: 'Сдан',
  READY_TO_MOVE: 'Сдан, можно въехать',
};

const NewBuildingDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: project, isLoading } = usePublicProject(id);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-foreground font-medium">Не удалось загрузить жилой комплекс</p>
          <button onClick={() => navigate('/novostroyki')} className="text-secondary font-medium text-sm">
            К списку новостроек
          </button>
        </div>
      </div>
    );
  }

  const photos = project.images?.length > 0 ? project.images : ['/placeholder.svg'];
  const phone = project.developerPhone || '+77075037160';
  const phoneDigits = phone.replace(/[^\d+]/g, '');

  const apartmentsByRooms = project.apartments.reduce<Record<number, typeof project.apartments>>((acc, apt) => {
    (acc[apt.rooms] ??= []).push(apt);
    return acc;
  }, {});

  const seoCity = project.city || 'Казахстан';

  return (
    <div className="min-h-screen bg-background pb-8">
      <Seo
        title={`ЖК ${project.name} — новостройка, ${seoCity}`}
        description={`ЖК ${project.name}${project.district ? `, ${project.district}` : ''}, ${seoCity}. Квартиры от ${formatPrice(project.minPrice)}, планировки и запись на просмотр в CASA.`}
        path={`/novostroyki/${id}`}
        image={project.images?.[0]}
      />
      <header className="flex items-center h-[52px] px-4">
        <button onClick={() => navigate('/novostroyki')} className="w-9 h-9 flex items-center justify-center -ml-2 rounded-full hover:bg-accent transition-colors">
          <ArrowLeft className="w-5 h-5 text-foreground" strokeWidth={1.5} />
        </button>
      </header>

      <div className="aspect-[4/3] w-full bg-accent overflow-hidden">
        <img src={photos[0]} alt={project.name} className="w-full h-full object-cover" />
      </div>

      <div className="px-4 pt-4 space-y-4">
        <div>
          <span className="inline-block px-2.5 py-1 rounded-full bg-accent text-[11px] font-medium text-foreground mb-2">
            {buildingStatusLabel[project.buildingStatus] ?? project.buildingStatus}
          </span>
          <h1 className="text-2xl font-bold text-foreground">{project.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {project.city}{project.district ? `, ${project.district}` : ''} · {project.address}
          </p>
        </div>

        {project.minPrice != null && (
          <p className="text-2xl font-semibold text-primary tabular-nums tracking-tight">
            от {formatPrice(project.minPrice)}
          </p>
        )}

        {project.description && (
          <p className="text-sm text-foreground/80 leading-relaxed">{project.description}</p>
        )}

        <div className="grid grid-cols-2 gap-3 text-sm">
          {project.developerName && (
            <div className="casa-card p-3">
              <p className="text-muted-foreground text-[12px]">Застройщик</p>
              <p className="font-medium text-foreground">{project.developerName}</p>
            </div>
          )}
          {project.deliveryDate && (
            <div className="casa-card p-3">
              <p className="text-muted-foreground text-[12px]">Срок сдачи</p>
              <p className="font-medium text-foreground">
                {new Date(project.deliveryDate).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}
              </p>
            </div>
          )}
        </div>

        {project.mortgagePrograms?.length > 0 && (
          <div className="casa-card p-4">
            <p className="text-sm font-medium text-foreground mb-2">Ипотечные программы</p>
            <div className="flex flex-wrap gap-2">
              {project.mortgagePrograms.map((program) => (
                <span key={program} className="px-2.5 py-1 rounded-full bg-accent text-[12px] text-foreground">
                  {program}
                </span>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="text-lg font-semibold text-foreground mb-2">
            Квартиры в продаже ({project.apartments.length})
          </p>

          {project.apartments.length === 0 && (
            <p className="text-sm text-muted-foreground py-4">Нет доступных квартир</p>
          )}

          <div className="space-y-4">
            {Object.entries(apartmentsByRooms)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([rooms, apartments]) => (
                <div key={rooms}>
                  <p className="text-sm font-medium text-muted-foreground mb-2">{rooms}-комнатные</p>
                  <div className="space-y-2">
                    {apartments.map((apt) => (
                      <div key={apt.id} className="casa-card p-3.5 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            №{apt.number} · {apt.area} м² · {apt.floor} этаж
                          </p>
                        </div>
                        <p className="text-base font-semibold text-primary tabular-nums">
                          {formatPrice(apt.price)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </div>

        <a
          href={`tel:${phoneDigits}`}
          className="casa-btn-primary flex items-center justify-center gap-2"
        >
          <Phone className="w-4 h-4" />
          Позвонить застройщику
        </a>
      </div>
    </div>
  );
};

export default NewBuildingDetail;
