import { useNavigate } from 'react-router-dom';
import { ChevronRight, LayoutGrid, Users, Banknote, Eye, Loader2, LogOut } from 'lucide-react';
import { logout } from '@/lib/api-client';
import { useAllProperties, mapPropertyStatus } from '@/hooks/useProperties';
import { useLeads, mapLeadStatus } from '@/hooks/useLeads';
import casaLogo from '@/assets/casa-logo.webp';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { data: properties = [], isLoading: loadingProps } = useAllProperties();
  const { data: leads = [], isLoading: loadingLeads } = useLeads();

  const active = properties.filter(p => !p.is_archived);
  const newLeads = leads.filter(l => l.status === 'new');
  const toPublish = active.filter(p => p.status === 'new');
  const showings = active.filter(p => p.status === 'showing');
  const inDeal = active.filter(p => p.status === 'in_deal');

  const isLoading = loadingProps || loadingLeads;

  const Item = ({ label, count, onClick, color = 'text-primary' }: { label: string; count: number; onClick: () => void; color?: string }) => (
    <button
      onClick={onClick}
      className="casa-card w-full px-4 py-3 flex items-center justify-between text-left active:scale-[0.99] transition-all"
    >
      <span className="text-sm text-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className={`text-base font-bold tabular-nums ${color}`}>{count}</span>
        <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
      </div>
    </button>
  );

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="space-y-1.5">
      <h2 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1">{title}</h2>
      <div className="space-y-1.5">{children}</div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 flex items-center justify-between h-13 px-4 bg-background/95 backdrop-blur-sm border-b border-border">
        <img src={casaLogo} alt="CASA" className="h-5 object-contain" />
        <div className="flex gap-1.5">
          <button
            onClick={() => navigate('/admin/objects')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent text-xs font-medium text-foreground active:scale-95 transition-transform"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            Квартиры
          </button>
          <button
            onClick={() => navigate('/admin/leads')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent text-xs font-medium text-foreground active:scale-95 transition-transform"
          >
            <Users className="w-3.5 h-3.5" />
            Заявки
          </button>
          <button
            onClick={async () => {
              await logout().catch(() => undefined);
              navigate('/admin/login', { replace: true });
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent text-xs font-medium text-muted-foreground active:scale-95 transition-transform"
          >
            <LogOut aria-label="Выйти" className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      <div className="px-4 py-5 space-y-5">
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Квартиры', value: active.length, icon: LayoutGrid, onClick: () => navigate('/admin/objects') },
            { label: 'Заявки', value: leads.length, icon: Users, onClick: () => navigate('/admin/leads') },
            { label: 'Показы', value: showings.length, icon: Eye, onClick: () => navigate('/admin/objects') },
            { label: 'Сделка', value: inDeal.length, icon: Banknote, onClick: () => navigate('/admin/objects') },
          ].map(stat => (
            <button
              key={stat.label}
              onClick={stat.onClick}
              className="casa-card px-2 py-3 text-center active:scale-[0.97] transition-transform"
            >
              <p className="text-lg font-bold text-primary tabular-nums">{stat.value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{stat.label}</p>
            </button>
          ))}
        </div>

        <Section title="Требует внимания">
          {newLeads.length > 0 && (
            <Item label="Новые заявки" count={newLeads.length} onClick={() => navigate('/admin/leads')} color="text-destructive" />
          )}
          {toPublish.length > 0 && (
            <Item label="Ждут публикации" count={toPublish.length} onClick={() => navigate('/admin/objects')} color="text-destructive" />
          )}
          {newLeads.length === 0 && toPublish.length === 0 && (
            <p className="text-sm text-muted-foreground px-1 py-2">Всё в порядке ✓</p>
          )}
        </Section>

        <Section title="Сегодня">
          <Item label="Показы" count={showings.length} onClick={() => navigate('/admin/objects')} />
        </Section>

        <Section title="В сделке">
          <Item label="Квартиры в сделке" count={inDeal.length} onClick={() => navigate('/admin/objects')} />
        </Section>
      </div>
    </div>
  );
};

export default AdminDashboard;
