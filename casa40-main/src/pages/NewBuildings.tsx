import { useNavigate } from 'react-router-dom';
import { Plus, Loader2 } from 'lucide-react';
import casaLogo from '@/assets/casa-logo.webp';
import { usePublishedProjects } from '@/hooks/useProjects';
import { formatPrice } from '@/components/PropertyCard';
import CategoryTabs from '@/components/CategoryTabs';

const buildingStatusLabel: Record<string, string> = {
  UNDER_CONSTRUCTION: 'Строится',
  COMPLETED: 'Сдан',
  READY_TO_MOVE: 'Сдан, можно въехать',
};

const NewBuildings = () => {
  const navigate = useNavigate();
  const { data: projects = [], isLoading } = usePublishedProjects();

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between h-[52px] px-4">
        <button onClick={() => navigate('/')} className="active:scale-95 transition-transform">
          <img src={casaLogo} alt="CASA" className="h-[22px] object-contain" />
        </button>
        <div className="flex items-center">
          <button
            onClick={() => navigate('/sell')}
            aria-label="Продать квартиру"
            className="w-9 h-9 flex items-center justify-center rounded-full bg-primary/10 hover:bg-primary/15 transition-colors"
          >
            <Plus className="w-5 h-5 text-primary" strokeWidth={2} />
          </button>
        </div>
      </header>

      <CategoryTabs active="new-builds" />

      <div className="px-4 pt-3 pb-6 space-y-3">
        {isLoading && (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Загрузка...
          </div>
        )}

        {!isLoading && projects.length === 0 && (
          <div className="text-center py-16 text-muted-foreground text-sm">
            Пока нет опубликованных новостроек
          </div>
        )}

        {projects.map((project) => (
          <div
            key={project.id}
            className="casa-card cursor-pointer active:scale-[0.98] transition-transform"
            onClick={() => navigate(`/novostroyki/${project.id}`)}
          >
            <div className="aspect-[4/3] w-full bg-accent relative overflow-hidden">
              {project.images?.[0] ? (
                <img src={project.images[0]} alt={project.name} className="w-full h-full object-cover" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                  <svg className="w-16 h-16 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                  </svg>
                </div>
              )}
              <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-card/90 backdrop-blur-sm text-[11px] font-medium text-foreground">
                {buildingStatusLabel[project.buildingStatus] ?? project.buildingStatus}
              </span>
            </div>
            <div className="p-5 space-y-2">
              <p className="text-lg font-semibold text-foreground">{project.name}</p>
              <p className="text-sm text-muted-foreground">
                {project.city}{project.district ? `, ${project.district}` : ''} · {project.address}
              </p>
              {project.minPrice != null && (
                <p className="text-xl font-semibold text-primary tabular-nums tracking-tight">
                  от {formatPrice(project.minPrice)}
                </p>
              )}
              {project.developerName && (
                <p className="text-sm text-muted-foreground">Застройщик: {project.developerName}</p>
              )}
              <button
                className="casa-btn-primary mt-2"
                onClick={(e) => { e.stopPropagation(); navigate(`/novostroyki/${project.id}`); }}
              >
                Смотреть квартиры
              </button>
            </div>
          </div>
        ))}
      </div>

      <footer className="px-4 py-6 border-t border-border/50">
        <div className="flex items-center justify-between">
          <p className="text-[12px] text-muted-foreground">© CASA {new Date().getFullYear()}</p>
          <div className="flex items-center gap-3">
            <a href="tel:+77075037160" className="text-[12px] text-muted-foreground hover:text-foreground transition-colors">8 707 503 71 60</a>
            <a href="https://wa.me/77075037160" target="_blank" rel="noopener noreferrer" className="text-[12px] text-muted-foreground hover:text-foreground transition-colors">WhatsApp</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default NewBuildings;
