import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Plus, Loader2, Archive } from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import { formatPrice } from '@/components/PropertyCard';
import { useAllProperties, mapPropertyStatus } from '@/hooks/useProperties';
import { useLeads, mapLeadStatus } from '@/hooks/useLeads';
import type { ObjectStatus } from '@/types/casa';

const statusTabs: (ObjectStatus | 'Все' | 'Архив')[] = ['Все', 'Новая', 'Опубликован', 'Показ', 'В сделке', 'Архив'];
const statusFilterMap: Record<string, string> = {
  'Новая': 'new',
  'Опубликован': 'published',
  'Показ': 'showing',
  'В сделке': 'in_deal',
};

const AdminObjects = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>('Все');
  const [search, setSearch] = useState('');

  const { data: properties = [], isLoading } = useAllProperties();
  const { data: leads = [] } = useLeads();

  const filtered = properties.filter(p => {
    const isArchiveTab = activeTab === 'Архив';

    // Archive tab shows only archived
    if (isArchiveTab) return p.is_archived === true;

    // All other tabs hide archived
    if (p.is_archived) return false;

    if (activeTab !== 'Все' && p.status !== statusFilterMap[activeTab]) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!(p.address || '').toLowerCase().includes(q) && !(p.district || '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const getLeadCount = (propertyId: string) => leads.filter(l => l.property_id === propertyId).length;
  const getShowingsCount = (propertyId: string) => leads.filter(l => l.property_id === propertyId && l.status === 'showing').length;

  const getActionLine = (p: typeof properties[0]): string => {
    if (p.is_archived) return 'В архиве';
    const lc = getLeadCount(p.id);
    const sc = getShowingsCount(p.id);
    if (p.status === 'new') return 'Готов к публикации';
    if (p.status === 'in_deal') return 'В сделке';
    if (p.status === 'showing') return 'Активные показы';
    if (p.status === 'published') {
      const parts: string[] = [];
      if (lc > 0) parts.push(`${lc} заяв.`);
      if (sc > 0) parts.push(`${sc} показ`);
      if (parts.length === 0) return 'Ждёт заявок';
      return parts.join(' · ');
    }
    return '';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 flex items-center gap-3 h-13 px-4 bg-background/95 backdrop-blur-sm border-b border-border">
        <button onClick={() => navigate('/admin')} className="p-1 -ml-1 active:scale-90 transition-transform">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <h1 className="text-[15px] font-bold text-foreground tracking-tight flex-1">Квартиры</h1>
        <span className="text-xs text-muted-foreground tabular-nums">{filtered.length}</span>
        <button
          onClick={() => navigate('/admin/objects/new')}
          className="p-1.5 rounded-lg bg-primary text-primary-foreground active:scale-90 transition-transform ml-1"
        >
          <Plus className="w-4 h-4" />
        </button>
      </header>

      <div className="px-4 py-3 space-y-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Поиск по адресу или району"
            className="casa-input pl-10 h-11 text-sm"
          />
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4 no-scrollbar">
          {statusTabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all active:scale-95 ${
                activeTab === tab
                  ? tab === 'Архив' ? 'bg-muted-foreground text-background' : 'bg-primary text-primary-foreground'
                  : 'bg-card text-muted-foreground border border-border'
              }`}
            >
              {tab === 'Архив' && <Archive className="w-3 h-3 inline mr-1" />}
              {tab}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-10">
              {activeTab === 'Архив' ? 'Архив пуст' : 'Нет квартир'}
            </p>
          )}
          {filtered.map(property => {
            const actionLine = getActionLine(property);
            return (
              <button
                key={property.id}
                onClick={() => navigate(`/admin/objects/${property.id}`)}
                className={`casa-card w-full p-3 flex gap-3 text-left active:scale-[0.99] transition-all ${property.is_archived ? 'opacity-60' : ''}`}
              >
                <div className="w-14 h-14 rounded-xl bg-accent shrink-0 flex items-center justify-center overflow-hidden">
                  {property.photo_urls && property.photo_urls[0] ? (
                    <img src={property.photo_urls[0]} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <svg className="w-5 h-5 text-muted-foreground/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold text-primary tabular-nums">{formatPrice(property.price ?? 0)}</p>
                    <StatusBadge status={mapPropertyStatus(property.status) as any} />
                  </div>
                  <p className="text-xs text-foreground truncate">{property.district}, {property.address} {property.house_number}</p>
                  <p className="text-[11px] text-muted-foreground">{property.rooms} комн. · {property.area} м² · {property.floor}/{property.total_floors} эт.</p>
                  {actionLine && (
                    <p className="text-[11px] font-medium text-primary mt-0.5">→ {actionLine}</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AdminObjects;
